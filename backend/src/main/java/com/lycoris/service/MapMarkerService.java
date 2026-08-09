package com.lycoris.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lycoris.dto.MarkerCreateRequest;
import com.lycoris.entity.MapMarker;
import com.lycoris.repository.MapMarkerRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.ArrayList;
import java.util.Set;
import java.util.Comparator;
import java.util.concurrent.TimeUnit;

@Service
public class MapMarkerService {

    private final MapMarkerRepository repo;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final ZoneId availabilityZone;
    private final boolean markerCacheRedisEnabled;
    private final long nearbyCacheTtlSeconds;
    private final long viewportCacheTtlSeconds;
    private static final Set<String> SUPPORTED_CATEGORIES = Set.of(
            "accessible_toilet",
            "friendly_clinic",
            "baby_room",
            "self_definition"
    );
    private static final Set<String> LEGACY_TO_SELF_DEFINITION = Set.of(
            "safe_place",
            "dangerous_place"
    );
    // Stored-value compatibility for reads, filters, and approvals. conversion_therapy
    // intentionally remains absent from the accepted write aliases above.
    private static final Set<String> LEGACY_STORED_CATEGORIES = Set.of(
            "safe_place",
            "dangerous_place",
            "conversion_therapy"
    );
    private static final TypeReference<List<MapMarker>> MARKER_LIST_TYPE = new TypeReference<>() {};
    private static final String NEARBY_CACHE_PREFIX = "cache:marker:nearby:v1:";
    private static final String VIEWPORT_CACHE_PREFIX = "cache:marker:viewport:v1:";
    private static final int CLIENT_REQUEST_ID_MAX_LENGTH = 64;

    public MapMarkerService(
            MapMarkerRepository repo,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            ObjectMapper objectMapper,
            @Value("${app.availability-zone:Asia/Shanghai}") String availabilityZone,
            @Value("${cache.marker.redis-enabled:true}") boolean markerCacheRedisEnabled,
            @Value("${cache.marker.nearby-ttl-seconds:12}") long nearbyCacheTtlSeconds,
            @Value("${cache.marker.viewport-ttl-seconds:10}") long viewportCacheTtlSeconds
    ) {
        this.repo = repo;
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
        this.objectMapper = objectMapper;
        this.availabilityZone = ZoneId.of(availabilityZone);
        this.markerCacheRedisEnabled = markerCacheRedisEnabled;
        this.nearbyCacheTtlSeconds = Math.max(1, nearbyCacheTtlSeconds);
        this.viewportCacheTtlSeconds = Math.max(1, viewportCacheTtlSeconds);
    }

    public MapMarker create(String username, String userPublicId, MarkerCreateRequest req) {
        String clientRequestId = normalizeClientRequestId(req.getClientRequestId());
        if (clientRequestId != null) {
            Optional<MapMarker> existing = repo.findByUserPublicIdAndClientRequestId(userPublicId, clientRequestId);
            if (existing.isPresent()) {
                return normalizeOneForRead(existing.get());
            }
        }

        MapMarker m = new MapMarker();
        m.setLat(req.getLat());
        m.setLng(req.getLng());
        m.setCategory(normalizeCategoryForWrite(req.getCategory()));
        m.setTitle(req.getTitle());
        m.setDescription(req.getDescription());
        m.setIsPublic(req.getIsPublic() != null ? req.getIsPublic() : true);
        m.setIsActive(req.getIsActive() != null ? req.getIsActive() : true);
        applyOpenTimeWindow(m, req.getOpenTimeStart(), req.getOpenTimeEnd());
        m.setMarkImage(req.getMarkImage());
        m.setUsername(username);
        m.setUserPublicId(userPublicId);
        m.setClientRequestId(clientRequestId);
        m.setReviewStatus("PENDING");
        m.setLastEditedBy(username);
        m.setLastEditedByPublicId(userPublicId);
        m.setLastEditedByOwner(true);
        applyAvailabilityStatus(m);

        try {
            return repo.save(m);
        } catch (DataIntegrityViolationException e) {
            if (clientRequestId != null) {
                return repo.findByUserPublicIdAndClientRequestId(userPublicId, clientRequestId)
                        .map(this::normalizeOneForRead)
                        .orElseThrow(() -> e);
            }
            throw e;
        }
    }

    public List<MapMarker> listPublicActive() {
        return normalizeForRead(repo.findByIsPublicTrueAndReviewStatus("APPROVED"));
    }

    public List<MapMarker> searchPublicActive(String q) {
        String query = q == null ? "" : q.trim();
        if (query.isEmpty()) return List.of();
        Map<Long, MapMarker> merged = new LinkedHashMap<>();
        for (MapMarker m : repo.searchPublicActive(query)) {
            merged.put(m.getId(), m);
        }
        Optional<double[]> coords = parseLatLng(query);
        if (coords.isPresent()) {
            double[] c = coords.get();
            for (MapMarker m : repo.findByLatLngNear(c[0], c[1], 0.00015)) {
                merged.put(m.getId(), m);
            }
        }
        return normalizeForRead(merged.values().stream().toList());
    }

    public List<MapMarker> nearbyPublicActive(double lat, double lng, int radiusMeters, String category) {
        String normalizedCategory = normalizeCategoryForWrite(category);
        int safeRadius = Math.max(1, Math.min(radiusMeters, 50000));
        String cacheKey = buildNearbyCacheKey(lat, lng, safeRadius, normalizedCategory);
        List<MapMarker> cached = readMarkerListFromCache(cacheKey);
        if (cached != null) {
            return normalizeForRead(cached);
        }
        List<String> storedCategories = expandStoredCategories(normalizedCategory);
        List<MapMarker> computed = normalizeForRead(
                repo.findNearbyByCategories(lat, lng, safeRadius, storedCategories)
        );
        writeMarkerListToCache(cacheKey, computed, nearbyCacheTtlSeconds);
        return computed;
    }

    public List<MapMarker> listPublicActiveInBounds(
            double minLat,
            double maxLat,
            double minLng,
            double maxLng,
            List<String> categories
    ) {
        if (minLat > maxLat || minLng > maxLng) {
            throw new IllegalArgumentException("边界参数不合法");
        }
        if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
            throw new IllegalArgumentException("边界超出合法经纬度范围");
        }

        String cacheKey = buildViewportCacheKey(minLat, maxLat, minLng, maxLng, categories);
        List<MapMarker> cached = readMarkerListFromCache(cacheKey);
        if (cached != null) {
            return normalizeForRead(cached);
        }

        List<MapMarker> result;
        if (categories == null || categories.isEmpty()) {
            result = repo.findPublicActiveInBounds(minLat, maxLat, minLng, maxLng);
        } else {
            List<String> normalized = new ArrayList<>();
            for (String category : categories) {
                normalized.add(normalizeCategoryForWrite(category));
            }
            List<String> storedCategories = normalized.stream()
                    .flatMap(category -> expandStoredCategories(category).stream())
                    .distinct()
                    .toList();
            result = repo.findPublicActiveInBoundsAndCategoryIn(
                    minLat,
                    maxLat,
                    minLng,
                    maxLng,
                    storedCategories
            );
        }
        List<MapMarker> computed = normalizeForRead(result);
        writeMarkerListToCache(cacheKey, computed, viewportCacheTtlSeconds);
        return computed;
    }

    public List<MapMarker> listByUserPublicId(String userPublicId) {
        return normalizeForRead(repo.findByUserPublicId(userPublicId));
    }

    public List<MapMarker> listByIds(List<Long> ids) {
        return normalizeForRead(repo.findByIdIn(ids));
    }

    public List<MapMarker> listAll() {
        return normalizeForRead(repo.findAll());
    }

    public java.util.Optional<MapMarker> findById(Long id) {
        return repo.findById(id).map(this::normalizeOneForRead);
    }

    public MapMarker save(MapMarker marker) {
        applyAvailabilityStatus(marker);
        return repo.save(marker);
    }

    public void delete(MapMarker marker) {
        repo.delete(marker);
    }

    public List<MapMarker> listPendingReview() {
        return normalizeForRead(repo.findByReviewStatusOrderByUpdatedAtDesc("PENDING"));
    }

    public String normalizeOpenTime(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        if (normalized.isEmpty()) return null;
        try {
            LocalTime parsed = LocalTime.parse(normalized);
            return parsed.withSecond(0).withNano(0).toString().substring(0, 5);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("时间格式不合法，请使用 HH:mm");
        }
    }

    public void applyAvailabilityStatus(MapMarker marker) {
        if (marker == null) return;
        String startRaw = marker.getOpenTimeStart();
        String endRaw = marker.getOpenTimeEnd();
        if (startRaw == null || endRaw == null || startRaw.isBlank() || endRaw.isBlank()) {
            return;
        }
        LocalTime now = LocalTime.now(availabilityZone);
        LocalTime start = LocalTime.parse(startRaw);
        LocalTime end = LocalTime.parse(endRaw);
        boolean activeNow;
        if (start.equals(end)) {
            activeNow = true;
        } else if (start.isBefore(end)) {
            activeNow = !now.isBefore(start) && now.isBefore(end);
        } else {
            activeNow = !now.isBefore(start) || now.isBefore(end);
        }
        marker.setIsActive(activeNow);
    }

    public void applyOpenTimeWindow(MapMarker marker, String start, String end) {
        if (marker == null) return;
        String normalizedStart = normalizeOpenTime(start);
        String normalizedEnd = normalizeOpenTime(end);
        if ((normalizedStart == null) != (normalizedEnd == null)) {
            throw new IllegalArgumentException("请同时填写开始和结束时间，或都留空");
        }
        marker.setOpenTimeStart(normalizedStart);
        marker.setOpenTimeEnd(normalizedEnd);
    }

    public String normalizeCategoryForWrite(String category) {
        if (category == null) {
            throw new IllegalArgumentException("category 不能为空");
        }
        String normalized = category.trim().toLowerCase(Locale.ROOT);
        if (LEGACY_TO_SELF_DEFINITION.contains(normalized)) {
            return "self_definition";
        }
        if (SUPPORTED_CATEGORIES.contains(normalized)) {
            return normalized;
        }
        throw new IllegalArgumentException("不支持的 category：" + category + "，仅支持：" + String.join(", ", SUPPORTED_CATEGORIES));
    }

    public String normalizeStoredCategoryForRead(String category) {
        if (category == null) return "self_definition";
        String normalized = category.trim().toLowerCase(Locale.ROOT);
        if (SUPPORTED_CATEGORIES.contains(normalized)) {
            return normalized;
        }
        return "self_definition";
    }

    public String normalizeStoredCategoryForApproval(String category) {
        if (category == null) {
            throw new IllegalArgumentException("存量 category 不能为空");
        }
        String normalized = category.trim().toLowerCase(Locale.ROOT);
        if (SUPPORTED_CATEGORIES.contains(normalized)) {
            return normalized;
        }
        if (LEGACY_STORED_CATEGORIES.contains(normalized)) {
            return "self_definition";
        }
        throw new IllegalArgumentException("不支持的存量 category：" + category);
    }

    private String normalizeClientRequestId(String clientRequestId) {
        if (clientRequestId == null) return null;
        String normalized = clientRequestId.trim();
        if (normalized.isEmpty()) return null;
        if (normalized.length() > CLIENT_REQUEST_ID_MAX_LENGTH) {
            throw new IllegalArgumentException("clientRequestId 过长");
        }
        return normalized;
    }

    private List<MapMarker> normalizeForRead(List<MapMarker> markers) {
        return markers.stream().map(this::normalizeOneForRead).toList();
    }

    private MapMarker normalizeOneForRead(MapMarker marker) {
        if (marker == null) return null;
        marker.setCategory(normalizeStoredCategoryForRead(marker.getCategory()));
        applyAvailabilityStatus(marker);
        return marker;
    }

    private List<String> expandStoredCategories(String normalizedCategory) {
        if (!"self_definition".equals(normalizedCategory)) {
            return List.of(normalizedCategory);
        }
        List<String> categories = new ArrayList<>();
        categories.add("self_definition");
        categories.addAll(LEGACY_STORED_CATEGORIES);
        return categories;
    }

    private Optional<double[]> parseLatLng(String query) {
        if (query == null) return Optional.empty();
        String cleaned = query.trim().replaceAll("\\s+", " ");
        String[] parts = cleaned.split("[,\\s]+");
        if (parts.length != 2) return Optional.empty();
        try {
            double lat = Double.parseDouble(parts[0]);
            double lng = Double.parseDouble(parts[1]);
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return Optional.empty();
            return Optional.of(new double[] { lat, lng });
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private String buildNearbyCacheKey(double lat, double lng, int radiusMeters, String category) {
        return NEARBY_CACHE_PREFIX
                + "lat=" + roundKeyNumber(lat)
                + "|lng=" + roundKeyNumber(lng)
                + "|r=" + radiusMeters
                + "|c=" + category;
    }

    private String buildViewportCacheKey(
            double minLat,
            double maxLat,
            double minLng,
            double maxLng,
            List<String> categories
    ) {
        String categoryPart = "all";
        if (categories != null && !categories.isEmpty()) {
            categoryPart = categories.stream()
                    .map(this::normalizeCategoryForWrite)
                    .sorted(Comparator.naturalOrder())
                    .distinct()
                    .reduce((a, b) -> a + "," + b)
                    .orElse("all");
        }
        return VIEWPORT_CACHE_PREFIX
                + "minLat=" + roundKeyNumber(minLat)
                + "|maxLat=" + roundKeyNumber(maxLat)
                + "|minLng=" + roundKeyNumber(minLng)
                + "|maxLng=" + roundKeyNumber(maxLng)
                + "|cat=" + categoryPart;
    }

    private String roundKeyNumber(double value) {
        return String.format(Locale.ROOT, "%.4f", value);
    }

    private List<MapMarker> readMarkerListFromCache(String key) {
        if (!markerCacheRedisEnabled || redisTemplate == null) return null;
        try {
            String json = redisTemplate.opsForValue().get(key);
            if (json == null || json.isBlank()) return null;
            return objectMapper.readValue(json, MARKER_LIST_TYPE);
        } catch (Exception ignore) {
            return null;
        }
    }

    private void writeMarkerListToCache(String key, List<MapMarker> markers, long ttlSeconds) {
        if (!markerCacheRedisEnabled || redisTemplate == null || markers == null) return;
        try {
            String json = objectMapper.writeValueAsString(markers);
            redisTemplate.opsForValue().set(key, json, ttlSeconds, TimeUnit.SECONDS);
        } catch (Exception ignore) {
            // Cache write failure should not affect primary DB response.
        }
    }
}
