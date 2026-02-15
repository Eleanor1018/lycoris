package com.lycoris.repository;

import com.lycoris.entity.MapMarker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MapMarkerRepository extends JpaRepository<MapMarker, Long> {

    List<MapMarker> findByIsPublicTrueAndReviewStatus(String reviewStatus);

    List<MapMarker> findByUsername(String username);

    List<MapMarker> findByUserPublicId(String userPublicId);

    List<MapMarker> findByIdIn(List<Long> ids);

    @Query("""
            select m from MapMarker m
            where m.isPublic = true
              and m.reviewStatus = 'APPROVED'
              and (
                lower(m.title) like lower(concat('%', :q, '%'))
                or lower(m.description) like lower(concat('%', :q, '%'))
                or lower(m.category) like lower(concat('%', :q, '%'))
                or str(m.lat) like concat('%', :q, '%')
                or str(m.lng) like concat('%', :q, '%')
              )
            """)
    List<MapMarker> searchPublicActive(@Param("q") String q);

    @Query(value = """
            select m.*
            from map_markers m
            where m.is_public = true
              and m.review_status = 'APPROVED'
              and m.category = :category
              and ST_DWithin(
                ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                :radius
              )
            order by ST_Distance(
                ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
            ) asc
            """, nativeQuery = true)
    List<MapMarker> findNearbyByCategory(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radius") int radius,
            @Param("category") String category
    );

    List<MapMarker> findByReviewStatusOrderByUpdatedAtDesc(String reviewStatus);

    @Query("""
            select m from MapMarker m
            where m.isPublic = true
              and m.reviewStatus = 'APPROVED'
              and m.lat between :minLat and :maxLat
              and m.lng between :minLng and :maxLng
            """)
    List<MapMarker> findPublicActiveInBounds(
            @Param("minLat") double minLat,
            @Param("maxLat") double maxLat,
            @Param("minLng") double minLng,
            @Param("maxLng") double maxLng
    );

    @Query("""
            select m from MapMarker m
            where m.isPublic = true
              and m.reviewStatus = 'APPROVED'
              and m.lat between :minLat and :maxLat
              and m.lng between :minLng and :maxLng
              and m.category in :categories
            """)
    List<MapMarker> findPublicActiveInBoundsAndCategoryIn(
            @Param("minLat") double minLat,
            @Param("maxLat") double maxLat,
            @Param("minLng") double minLng,
            @Param("maxLng") double maxLng,
            @Param("categories") List<String> categories
    );

    @Query("""
            select m from MapMarker m
            where m.isPublic = true
              and m.reviewStatus = 'APPROVED'
              and abs(m.lat - :lat) <= :eps
              and abs(m.lng - :lng) <= :eps
            """)
    List<MapMarker> findByLatLngNear(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("eps") double eps
    );

}
