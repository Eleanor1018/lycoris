package com.lycoris.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lycoris.dto.MarkerCreateRequest;
import com.lycoris.entity.MapMarker;
import com.lycoris.repository.MapMarkerRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MapMarkerServiceTest {

    @Test
    void serviceValidationExceptionUsesRequestLocaleAndInterpolatesValues() {
        MapMarkerService service = serviceWith(mock(MapMarkerRepository.class));
        Locale previous = LocaleContextHolder.getLocale();
        try {
            LocaleContextHolder.setLocale(Locale.SIMPLIFIED_CHINESE);
            assertThatThrownBy(() -> service.normalizeCategoryForWrite("unknown_category"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageStartingWith("不支持的 category：unknown_category，仅支持：")
                    .hasMessageContaining("accessible_toilet");

            LocaleContextHolder.setLocale(Locale.ENGLISH);
            assertThatThrownBy(() -> service.normalizeStoredCategoryForApproval("unknown_category"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessage("Unsupported stored category: unknown_category");
        } finally {
            LocaleContextHolder.setLocale(previous);
        }
    }

    @Test
    void categoryContractAcceptsBabyRoomAndRejectsRemovedConversionTherapy() {
        MapMarkerService service = serviceWith(mock(MapMarkerRepository.class));

        assertThat(service.normalizeCategoryForWrite(" baby_room ")).isEqualTo("baby_room");
        assertThatThrownBy(() -> service.normalizeCategoryForWrite("conversion_therapy"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported category");
    }

    @Test
    void createPersistsBabyRoomCategory() {
        MapMarkerRepository repo = mock(MapMarkerRepository.class);
        MapMarkerService service = serviceWith(repo);
        MarkerCreateRequest request = validRequest();
        request.setCategory("baby_room");

        when(repo.save(any(MapMarker.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MapMarker saved = service.create("nora", "public-1", request);

        assertThat(saved.getCategory()).isEqualTo("baby_room");
        verify(repo, times(1)).save(any(MapMarker.class));
    }

    @Test
    void removedCategoryFromStoredMarkerReadsAsSelfDefinition() {
        MapMarkerRepository repo = mock(MapMarkerRepository.class);
        MapMarkerService service = serviceWith(repo);
        MapMarker stored = new MapMarker();
        stored.setId(7L);
        stored.setCategory("conversion_therapy");
        when(repo.findById(7L)).thenReturn(Optional.of(stored));

        MapMarker result = service.findById(7L).orElseThrow();

        assertThat(result.getCategory()).isEqualTo("self_definition");
        assertThat(service.normalizeStoredCategoryForApproval("conversion_therapy"))
                .isEqualTo("self_definition");
        assertThatThrownBy(() -> service.normalizeStoredCategoryForApproval("unknown_category"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported stored category");
    }

    @Test
    void selfDefinitionNearbyQueryIncludesLegacyStoredCategories() {
        MapMarkerRepository repo = mock(MapMarkerRepository.class);
        MapMarkerService service = serviceWith(repo);
        when(repo.findNearbyByCategories(anyDouble(), anyDouble(), anyInt(), anyList()))
                .thenReturn(List.of());

        service.nearbyPublicActive(31.2304, 121.4737, 1000, "self_definition");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<String>> categoriesCaptor = ArgumentCaptor.forClass(List.class);
        verify(repo).findNearbyByCategories(
                anyDouble(),
                anyDouble(),
                anyInt(),
                categoriesCaptor.capture()
        );
        assertThat(categoriesCaptor.getValue()).containsExactlyInAnyOrder(
                "self_definition",
                "safe_place",
                "dangerous_place",
                "conversion_therapy"
        );
    }

    @Test
    void createReturnsExistingMarkerForRepeatedClientRequestId() {
        MapMarkerRepository repo = mock(MapMarkerRepository.class);
        MapMarkerService service = serviceWith(repo);
        MarkerCreateRequest request = validRequest();
        request.setClientRequestId("draft-123");

        AtomicReference<MapMarker> savedMarker = new AtomicReference<>();
        when(repo.findByUserPublicIdAndClientRequestId("public-1", "draft-123"))
                .thenAnswer(invocation -> Optional.ofNullable(savedMarker.get()));
        when(repo.save(any(MapMarker.class))).thenAnswer(invocation -> {
            MapMarker marker = invocation.getArgument(0);
            marker.setId(42L);
            savedMarker.set(marker);
            return marker;
        });

        MapMarker first = service.create("nora", "public-1", request);
        MapMarker second = service.create("nora", "public-1", request);

        assertThat(first.getId()).isEqualTo(42L);
        assertThat(second.getId()).isEqualTo(42L);
        assertThat(second).isSameAs(first);
        assertThat(first.getClientRequestId()).isEqualTo("draft-123");
        verify(repo, times(1)).save(any(MapMarker.class));
    }

    @Test
    void createWithoutClientRequestIdSavesEachRequest() {
        MapMarkerRepository repo = mock(MapMarkerRepository.class);
        MapMarkerService service = serviceWith(repo);
        MarkerCreateRequest request = validRequest();
        request.setClientRequestId(" ");
        AtomicLong nextId = new AtomicLong(1);

        when(repo.save(any(MapMarker.class))).thenAnswer(invocation -> {
            MapMarker marker = invocation.getArgument(0);
            marker.setId(nextId.getAndIncrement());
            return marker;
        });

        MapMarker first = service.create("nora", "public-1", request);
        MapMarker second = service.create("nora", "public-1", request);

        assertThat(first.getId()).isEqualTo(1L);
        assertThat(second.getId()).isEqualTo(2L);
        verify(repo, never()).findByUserPublicIdAndClientRequestId(any(), any());
        verify(repo, times(2)).save(any(MapMarker.class));
    }

    private MapMarkerService serviceWith(MapMarkerRepository repo) {
        @SuppressWarnings("unchecked")
        ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
        when(redisProvider.getIfAvailable()).thenReturn(null);
        return new MapMarkerService(
                repo,
                redisProvider,
                new ObjectMapper(),
                "Asia/Shanghai",
                false,
                12,
                10
        );
    }

    private MarkerCreateRequest validRequest() {
        MarkerCreateRequest request = new MarkerCreateRequest();
        request.setLat(31.2304);
        request.setLng(121.4737);
        request.setCategory("accessible_toilet");
        request.setTitle("人民广场无障碍卫生间");
        request.setDescription("靠近地铁站出口");
        request.setIsPublic(true);
        request.setIsActive(true);
        return request;
    }
}
