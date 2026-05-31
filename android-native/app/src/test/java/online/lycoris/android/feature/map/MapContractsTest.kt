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
    fun nearbyRadiusClampsInput() {
        assertEquals(0, NearbyRadius.fromInput("-2").meters)
        assertEquals(10_000, NearbyRadius.fromInput("50000").meters)
        assertEquals(1_000, NearbyRadius.fromInput("abc").meters)
    }
}
