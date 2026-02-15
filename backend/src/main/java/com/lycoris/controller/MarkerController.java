package com.lycoris.controller;

import com.lycoris.dto.MarkerCreateRequest;
import com.lycoris.dto.MarkerUpdateRequest;
import com.lycoris.entity.MapMarker;
import com.lycoris.entity.MarkerEditProposal;
import com.lycoris.entity.MarkerImageProposal;
import com.lycoris.entity.MarkerFavorite;
import com.lycoris.repository.MarkerEditProposalRepository;
import com.lycoris.repository.MarkerImageProposalRepository;
import com.lycoris.service.MapMarkerService;
import com.lycoris.service.UserService;
import com.lycoris.repository.MarkerFavoriteRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/markers")
public class MarkerController {

    private final MapMarkerService markerService;
    private final UserService userService;
    private final MarkerFavoriteRepository favoriteRepo;
    private final MarkerImageProposalRepository imageProposalRepo;
    private final MarkerEditProposalRepository editProposalRepo;
    @Value("${app.upload-dir}")
    private String uploadDir;

    public MarkerController(
            MapMarkerService markerService,
            UserService userService,
            MarkerFavoriteRepository favoriteRepo,
            MarkerImageProposalRepository imageProposalRepo,
            MarkerEditProposalRepository editProposalRepo
    ) {
        this.markerService = markerService;
        this.userService = userService;
        this.favoriteRepo = favoriteRepo;
        this.imageProposalRepo = imageProposalRepo;
        this.editProposalRepo = editProposalRepo;
    }

    // 创建点（必须登录：靠 session）
    @PostMapping
    public ResponseEntity<?> create(@RequestBody MarkerCreateRequest req, HttpSession session) {
        Object u = session.getAttribute("username");
        Integer userId = (Integer) session.getAttribute("userId");
        if (u == null || userId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        String username = String.valueOf(u);
        String userPublicId = userService.findById(userId)
                .map(user -> String.valueOf(user.getPublicId()))
                .orElse(null);
        if (userPublicId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }

        // 最小校验
        if (req.getLat() == null || req.getLng() == null || req.getCategory() == null || req.getTitle() == null) {
            return ResponseEntity.badRequest().body("缺少必要字段");
        }

        try {
            MapMarker created = markerService.create(username, userPublicId, req);
            return ResponseEntity.ok(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 不登录也能看公共且有效的点（你以后再做“地图默认可看”）
    @GetMapping("/public")
    public List<MapMarker> listPublicActive() {
        return markerService.listPublicActive();
    }

    @GetMapping("/search")
    public List<MapMarker> searchPublic(@RequestParam("q") String q) {
        String query = q == null ? "" : q.trim();
        if (query.isEmpty()) return List.of();
        return markerService.searchPublicActive(query);
    }

    @GetMapping("/nearby")
    public ResponseEntity<?> nearbyPublic(
            @RequestParam("lat") Double lat,
            @RequestParam("lng") Double lng,
            @RequestParam(value = "radius", defaultValue = "1000") Integer radius,
            @RequestParam(value = "category", defaultValue = "accessible_toilet") String category
    ) {
        if (lat == null || lng == null) {
            return ResponseEntity.badRequest().body("缺少 lat/lng 参数");
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return ResponseEntity.badRequest().body("lat/lng 不合法");
        }
        try {
            return ResponseEntity.ok(markerService.nearbyPublicActive(lat, lng, radius == null ? 1000 : radius, category));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "" : e.getMessage().toLowerCase();
            if (msg.contains("st_dwithin") || msg.contains("postgis")) {
                return ResponseEntity.status(500).body("数据库未启用 PostGIS，请先执行：CREATE EXTENSION postgis;");
            }
            throw e;
        }
    }

    @GetMapping("/viewport")
    public ResponseEntity<?> listByViewport(
            @RequestParam("minLat") Double minLat,
            @RequestParam("maxLat") Double maxLat,
            @RequestParam("minLng") Double minLng,
            @RequestParam("maxLng") Double maxLng,
            @RequestParam(value = "categories", required = false) String categoriesCsv
    ) {
        if (minLat == null || maxLat == null || minLng == null || maxLng == null) {
            return ResponseEntity.badRequest().body("缺少视口边界参数");
        }
        try {
            List<String> categories = null;
            if (categoriesCsv != null && !categoriesCsv.isBlank()) {
                categories = Arrays.stream(categoriesCsv.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
            }
            return ResponseEntity.ok(
                    markerService.listPublicActiveInBounds(minLat, maxLat, minLng, maxLng, categories)
            );
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 你调试用：查看全部（上线前再关掉）
    @GetMapping("/all")
    public List<MapMarker> listAll() {
        return markerService.listAll();
    }

    @PostMapping(value = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadMarkerImage(
            @PathVariable("id") Long id,
            @RequestParam("file") MultipartFile file,
            HttpSession session
    ) {
        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("文件为空");
        }

        return markerService.findById(id).map(marker -> {
            String userPublicId = userService.findById(userId)
                    .map(user -> String.valueOf(user.getPublicId()))
                    .orElse(null);
            if (userPublicId == null) {
                return ResponseEntity.status(401).body("请先登录");
            }
            try {
                String ext = StringUtils.getFilenameExtension(file.getOriginalFilename());
                String safeExt = (ext == null || ext.isBlank()) ? "png" : ext.toLowerCase();
                String filename = "proposal-marker-" + id + "-" + UUID.randomUUID() + "." + safeExt;
                Path imageDir = Paths.get(uploadDir, "markers");
                Files.createDirectories(imageDir);
                Path target = imageDir.resolve(filename);
                Files.copy(file.getInputStream(), target);

                String url = "/uploads/markers/" + filename;
                MarkerImageProposal proposal = new MarkerImageProposal();
                proposal.setMarkerId(marker.getId());
                proposal.setMarkerTitle(marker.getTitle());
                proposal.setProposerUsername(String.valueOf(session.getAttribute("username")));
                proposal.setProposerPublicId(userPublicId);
                proposal.setImageUrl(url);
                proposal.setStatus("PENDING");
                imageProposalRepo.save(proposal);

                return ResponseEntity.ok(marker);
            } catch (Exception e) {
                return ResponseEntity.status(500).body("上传失败");
            }
        }).orElseGet(() -> ResponseEntity.status(404).body("点位不存在"));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> updateMarker(
            @PathVariable("id") Long id,
            @RequestBody MarkerUpdateRequest req,
            HttpSession session
    ) {
        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        String userPublicId = userService.findById(userId)
                .map(user -> String.valueOf(user.getPublicId()))
                .orElse(null);
        if (userPublicId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }

        return markerService.findById(id)
                .<ResponseEntity<?>>map(marker -> {
            String proposedCategory = marker.getCategory();
            if (req.getCategory() != null) {
                proposedCategory = markerService.normalizeCategoryForWrite(req.getCategory());
            }

            String proposedTitle = req.getTitle() != null ? req.getTitle() : marker.getTitle();
            String proposedDescription = req.getDescription() != null ? req.getDescription() : marker.getDescription();
            Boolean proposedIsPublic = req.getIsPublic() != null ? req.getIsPublic() : marker.getIsPublic();
            Boolean proposedIsActive = req.getIsActive() != null ? req.getIsActive() : marker.getIsActive();

            String proposedOpenStart = marker.getOpenTimeStart();
            String proposedOpenEnd = marker.getOpenTimeEnd();
            if (req.getOpenTimeStart() != null || req.getOpenTimeEnd() != null) {
                proposedOpenStart = markerService.normalizeOpenTime(req.getOpenTimeStart());
                proposedOpenEnd = markerService.normalizeOpenTime(req.getOpenTimeEnd());
                if ((proposedOpenStart == null) != (proposedOpenEnd == null)) {
                    throw new IllegalArgumentException("请同时填写开始和结束时间，或都留空");
                }
            }

            String username = String.valueOf(session.getAttribute("username"));
            boolean isOwner = marker.getUserPublicId() != null && marker.getUserPublicId().equals(userPublicId);

            MarkerEditProposal proposal = new MarkerEditProposal();
            proposal.setMarkerId(marker.getId());
            proposal.setMarkerTitle(marker.getTitle());
            proposal.setMarkerLat(marker.getLat());
            proposal.setMarkerLng(marker.getLng());
            proposal.setProposerUsername(username);
            proposal.setProposerPublicId(userPublicId);
            proposal.setProposerIsOwner(isOwner);
            proposal.setCategory(proposedCategory);
            proposal.setTitle(proposedTitle);
            proposal.setDescription(proposedDescription);
            proposal.setIsPublic(proposedIsPublic);
            proposal.setIsActive(proposedIsActive);
            proposal.setOpenTimeStart(proposedOpenStart);
            proposal.setOpenTimeEnd(proposedOpenEnd);
            proposal.setStatus("PENDING");
            editProposalRepo.save(proposal);

            return ResponseEntity.ok(marker);
        }).orElseGet(() -> ResponseEntity.status(404).body("点位不存在"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(e.getMessage());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteMarker(@PathVariable("id") Long id, HttpSession session) {
        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        String userPublicId = userService.findById(userId)
                .map(user -> String.valueOf(user.getPublicId()))
                .orElse(null);
        if (userPublicId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }

        return markerService.findById(id).map(marker -> {
            if (marker.getUserPublicId() == null || !userPublicId.equals(marker.getUserPublicId())) {
                return ResponseEntity.status(403).body("无权限");
            }
            favoriteRepo.deleteByMarkerId(id);
            markerService.delete(marker);
            return ResponseEntity.ok().build();
        }).orElseGet(() -> ResponseEntity.status(404).body("点位不存在"));
    }

    @PostMapping("/{id}/favorite")
    public ResponseEntity<?> favorite(@PathVariable("id") Long id, HttpSession session) {
        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        String userPublicId = userService.findById(userId)
                .map(user -> String.valueOf(user.getPublicId()))
                .orElse(null);
        if (userPublicId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }

        if (!markerService.findById(id).isPresent()) {
            return ResponseEntity.status(404).body("点位不存在");
        }
        if (!favoriteRepo.existsByUserPublicIdAndMarkerId(userPublicId, id)) {
            MarkerFavorite fav = new MarkerFavorite();
            fav.setUserPublicId(userPublicId);
            fav.setMarkerId(id);
            favoriteRepo.save(fav);
        }
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/favorite")
    public ResponseEntity<?> unfavorite(@PathVariable("id") Long id, HttpSession session) {
        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        String userPublicId = userService.findById(userId)
                .map(user -> String.valueOf(user.getPublicId()))
                .orElse(null);
        if (userPublicId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }

        favoriteRepo.deleteByUserPublicIdAndMarkerId(userPublicId, id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/me/favorites")
    public ResponseEntity<?> myFavorites(HttpSession session) {
        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        String userPublicId = userService.findById(userId)
                .map(user -> String.valueOf(user.getPublicId()))
                .orElse(null);
        if (userPublicId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }

        List<MarkerFavorite> favs = favoriteRepo.findByUserPublicId(userPublicId);
        List<Long> ids = favs.stream().map(MarkerFavorite::getMarkerId).toList();
        return ResponseEntity.ok(ids);
    }

    @GetMapping("/me/created")
    public ResponseEntity<?> myCreatedMarkers(HttpSession session) {
        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        String userPublicId = userService.findById(userId)
                .map(user -> String.valueOf(user.getPublicId()))
                .orElse(null);
        if (userPublicId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        return ResponseEntity.ok(markerService.listByUserPublicId(userPublicId));
    }

    @GetMapping("/me/favorites/details")
    public ResponseEntity<?> myFavoriteMarkers(HttpSession session) {
        Integer userId = (Integer) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }
        String userPublicId = userService.findById(userId)
                .map(user -> String.valueOf(user.getPublicId()))
                .orElse(null);
        if (userPublicId == null) {
            return ResponseEntity.status(401).body("请先登录");
        }

        List<Long> ids = favoriteRepo.findByUserPublicId(userPublicId)
                .stream()
                .map(MarkerFavorite::getMarkerId)
                .toList();
        if (ids.isEmpty()) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(markerService.listByIds(ids));
    }
}
