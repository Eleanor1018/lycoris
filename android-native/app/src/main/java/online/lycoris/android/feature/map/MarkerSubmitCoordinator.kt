package online.lycoris.android.feature.map

import java.util.UUID

class MarkerSubmitCoordinator(
    private val idFactory: () -> String = { UUID.randomUUID().toString() },
) {
    fun newClientRequestId(): String = idFactory()
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
