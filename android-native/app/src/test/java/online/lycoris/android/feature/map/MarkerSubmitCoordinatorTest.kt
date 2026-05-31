package online.lycoris.android.feature.map

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerSubmitCoordinatorTest {
    @Test
    fun createsStableClientRequestIdForDraft() {
        val coordinator = MarkerSubmitCoordinator(idFactory = { "draft-1" })

        assertEquals("draft-1", coordinator.newClientRequestId())
    }

    @Test
    fun partialImageFailureKeepsCreatedMarker() {
        val marker = Marker(
            id = 1,
            lat = 39.9,
            lng = 116.4,
            category = MarkerCategory.AccessibleToilet,
            title = "A口",
            description = "",
            isPublic = true,
            isActive = true,
        )

        val result = MarkerSubmitResult.PartialImageFailure(marker, "图片上传失败")

        assertEquals(marker, result.marker)
        assertTrue(result.message.contains("图片"))
    }
}
