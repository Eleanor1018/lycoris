package online.lycoris.android.feature.map

import kotlinx.coroutines.test.runTest
import online.lycoris.android.core.image.LocalImage
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
        val marker = marker(id = 1)

        val result = MarkerSubmitResult.PartialImageFailure(marker, "图片上传失败")

        assertEquals(marker, result.marker)
        assertTrue(result.message.contains("图片"))
    }

    @Test
    fun submitUploadsImageAfterCreate() = runTest {
        val createdMarker = marker(id = 1)
        val uploadedMarker = marker(id = 1, image = "/uploads/marker.jpg")
        val repository = FakeSubmitRepository(
            createdMarker = createdMarker,
            uploadedMarker = uploadedMarker,
        )
        val coordinator = MarkerSubmitCoordinator(idFactory = { "draft-1" })

        val result = coordinator.submit(
            repository = repository,
            draft = MarkerDraft(
                lat = 39.9,
                lng = 116.4,
                title = "A口",
                clientRequestId = "draft-1",
                selectedImage = image(),
            ),
        )

        assertEquals(MarkerSubmitResult.Success(uploadedMarker), result)
        assertEquals("draft-1", repository.createCalls.single().clientRequestId)
        assertEquals(1L, repository.uploadCalls.single().id)
    }

    @Test
    fun submitReturnsPartialSuccessWhenImageUploadFails() = runTest {
        val createdMarker = marker(id = 2)
        val repository = FakeSubmitRepository(
            createdMarker = createdMarker,
            uploadFailure = IllegalStateException("upload down"),
        )
        val coordinator = MarkerSubmitCoordinator(idFactory = { "draft-1" })

        val result = coordinator.submit(
            repository = repository,
            draft = MarkerDraft(
                lat = 39.9,
                lng = 116.4,
                title = "A口",
                clientRequestId = "draft-1",
                selectedImage = image(),
            ),
        )

        val partial = result as MarkerSubmitResult.PartialImageFailure
        assertEquals(createdMarker, partial.marker)
        assertTrue(partial.message.contains("图片"))
    }
}

private data class SubmitUploadCall(
    val id: Long,
    val image: LocalImage,
)

private class FakeSubmitRepository(
    private val createdMarker: Marker,
    private val uploadedMarker: Marker = createdMarker,
    private val uploadFailure: Throwable? = null,
) : MapRepository {
    val createCalls = mutableListOf<MarkerCreateRequest>()
    val uploadCalls = mutableListOf<SubmitUploadCall>()

    override suspend fun loadViewport(
        bounds: ViewportBounds,
        categories: List<MarkerCategory>,
    ): List<Marker> = emptyList()

    override suspend fun loadFavoriteIds(): List<Long> = emptyList()

    override suspend fun loadNearby(
        lat: Double,
        lng: Double,
        radius: Int,
        category: MarkerCategory,
    ): List<Marker> = emptyList()

    override suspend fun createMarker(request: MarkerCreateRequest): Marker {
        createCalls.add(request)
        return createdMarker
    }

    override suspend fun uploadMarkerImage(id: Long, image: LocalImage): Marker {
        uploadCalls.add(SubmitUploadCall(id, image))
        uploadFailure?.let { throw it }
        return uploadedMarker
    }

    override suspend fun deleteMarker(id: Long) = Unit

    override suspend fun setFavorite(id: Long, favorite: Boolean) = Unit
}

private fun marker(
    id: Long,
    image: String? = null,
): Marker = Marker(
    id = id,
    lat = 39.9,
    lng = 116.4,
    category = MarkerCategory.AccessibleToilet,
    title = "A口",
    description = "",
    isPublic = true,
    isActive = true,
    markImage = image,
)

private fun image(): LocalImage = LocalImage(
    fileName = "marker.jpg",
    mimeType = "image/jpeg",
    sizeBytes = 4,
    bytes = byteArrayOf(1, 2, 3, 4),
)
