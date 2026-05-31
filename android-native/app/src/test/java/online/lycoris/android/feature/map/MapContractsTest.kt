package online.lycoris.android.feature.map

import org.junit.Assert.assertEquals
import org.junit.Test

class MapContractsTest {
    @Test
    fun markerPinUsesCategoryColors() {
        assertEquals(0xFF1E88E5.toInt(), MarkerPin.AccessibleToilet.color)
        assertEquals(0xFF43A047.toInt(), MarkerPin.FriendlyClinic.color)
        assertEquals(0xFFFB8C00.toInt(), MarkerPin.BabyRoom.color)
        assertEquals(0xFFF0BF2F.toInt(), MarkerPin.SelfDefinition.color)
    }

    @Test
    fun markerPinUsesInactiveForInactiveMarker() {
        val marker = Marker(
            id = 1,
            lat = 39.9,
            lng = 116.4,
            category = MarkerCategory.AccessibleToilet,
            title = "未命名点位",
            description = "",
            isPublic = true,
            isActive = false,
        )

        assertEquals(MarkerPin.Inactive, MarkerPin.from(marker))
        assertEquals(0xFF9E9E9E.toInt(), MarkerPin.Inactive.argb)
    }

    @Test
    fun nearbyRadiusClampsInput() {
        assertEquals(0, NearbyRadius.fromInput("-2").meters)
        assertEquals(10_000, NearbyRadius.fromInput("50000").meters)
        assertEquals(1_000, NearbyRadius.fromInput("abc").meters)
    }

    @Test
    fun selectedMarkerReturnsMarkerMatchingSelectedId() {
        val marker = Marker(
            id = 7,
            lat = 39.9,
            lng = 116.4,
            category = MarkerCategory.SelfDefinition,
            title = "测试点位",
            description = "",
            isPublic = true,
            isActive = true,
        )
        val state = MapUiState(
            markers = listOf(marker),
            selectedMarkerId = 7,
        )

        assertEquals(marker, state.selectedMarker)
    }
}
