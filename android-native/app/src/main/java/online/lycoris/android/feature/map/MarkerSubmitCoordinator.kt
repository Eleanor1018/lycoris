package online.lycoris.android.feature.map

import kotlinx.coroutines.CancellationException
import java.util.UUID

class MarkerSubmitCoordinator(
    private val idFactory: () -> String = { UUID.randomUUID().toString() },
) {
    fun newClientRequestId(): String = idFactory()

    suspend fun submit(
        repository: MapRepository,
        draft: MarkerDraft,
    ): MarkerSubmitResult {
        return try {
            val createdMarker = repository.createMarker(
                MarkerCreateRequest(
                    lat = draft.lat,
                    lng = draft.lng,
                    category = draft.category.wireName,
                    title = draft.title,
                    description = draft.description,
                    isPublic = draft.isPublic,
                    openTimeStart = draft.openTimeStart,
                    openTimeEnd = draft.openTimeEnd,
                    clientRequestId = draft.clientRequestId,
                ),
            )
            val image = draft.selectedImage
            if (image == null) {
                MarkerSubmitResult.Success(createdMarker)
            } else {
                try {
                    MarkerSubmitResult.Success(repository.uploadMarkerImage(createdMarker.id, image))
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    MarkerSubmitResult.PartialImageFailure(createdMarker, "图片上传失败，点位已提交")
                }
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            MarkerSubmitResult.Failure(error.message?.takeIf { it.isNotBlank() } ?: "点位提交失败")
        }
    }
}

sealed interface MarkerSubmitResult {
    data class Success(
        val marker: Marker,
    ) : MarkerSubmitResult

    data class PartialImageFailure(
        val marker: Marker,
        val message: String,
    ) : MarkerSubmitResult

    data class Failure(
        val message: String,
    ) : MarkerSubmitResult
}
