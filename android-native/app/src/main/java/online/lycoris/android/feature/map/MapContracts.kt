package online.lycoris.android.feature.map

enum class MarkerPin(
    val argb: Int,
) {
    AccessibleToilet(0xFF1E88E5.toInt()),
    FriendlyClinic(0xFF43A047.toInt()),
    BabyRoom(0xFFFB8C00.toInt()),
    SelfDefinition(0xFFF0BF2F.toInt()),
    Inactive(0xFF9E9E9E.toInt()),
    ;

    val color: Int
        get() = argb

    companion object {
        fun from(marker: Marker): MarkerPin {
            if (!marker.isActive) {
                return Inactive
            }
            return when (marker.category) {
                MarkerCategory.AccessibleToilet -> AccessibleToilet
                MarkerCategory.FriendlyClinic -> FriendlyClinic
                MarkerCategory.BabyRoom -> BabyRoom
                MarkerCategory.SelfDefinition -> SelfDefinition
            }
        }
    }
}

data class NearbyRadius(
    val meters: Int,
) {
    companion object {
        private const val DefaultMeters = 1_000
        private const val MinMeters = 0
        private const val MaxMeters = 10_000

        fun fromInput(input: String): NearbyRadius {
            val parsed = input.toIntOrNull() ?: DefaultMeters
            return NearbyRadius(parsed.coerceIn(MinMeters, MaxMeters))
        }
    }
}

enum class OwnerFilter {
    All,
    Mine,
    Favorites,
}

data class MapUiState(
    val loading: Boolean = false,
    val markers: List<Marker> = emptyList(),
    val favoriteIds: Set<Long> = emptySet(),
    val selectedMarkerId: Long? = null,
    val visibleCategories: Set<MarkerCategory> = MarkerCategory.entries.toSet(),
    val ownerFilter: OwnerFilter = OwnerFilter.All,
    val message: String? = null,
)
