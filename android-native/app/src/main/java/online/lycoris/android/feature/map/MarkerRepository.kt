package online.lycoris.android.feature.map

import okhttp3.MultipartBody
import online.lycoris.android.core.network.LycorisApi
import retrofit2.Response

class MarkerRepository(
    private val api: LycorisApi,
) {
    suspend fun loadViewport(
        bounds: ViewportBounds,
        categories: List<MarkerCategory>,
    ): List<Marker> {
        return api.viewportMarkers(
            minLat = bounds.minLat,
            maxLat = bounds.maxLat,
            minLng = bounds.minLng,
            maxLng = bounds.maxLng,
            categories = categories.joinToString(",") { it.wireName },
        ).bodyOrThrow().map { it.toMarker() }
    }

    suspend fun loadFavoriteIds(): List<Long> {
        return api.favoriteMarkerIds().bodyOrThrow()
    }

    suspend fun loadNearby(
        lat: Double,
        lng: Double,
        radius: Int,
        category: MarkerCategory,
    ): List<Marker> {
        return api.nearbyMarkers(
            lat = lat,
            lng = lng,
            radius = radius,
            category = category.wireName,
        ).bodyOrThrow().map { it.toMarker() }
    }

    suspend fun createMarker(request: MarkerCreateRequest): Marker {
        return api.createMarker(request).bodyOrThrow().toMarker()
    }

    suspend fun updateMarker(id: Long, request: MarkerUpdateRequest): Marker {
        return api.updateMarker(id, request).bodyOrThrow().toMarker()
    }

    suspend fun deleteMarker(id: Long) {
        api.deleteMarker(id).throwIfUnsuccessful()
    }

    suspend fun uploadMarkerImage(id: Long, image: MultipartBody.Part): Marker {
        return api.uploadMarkerImage(id, image).bodyOrThrow().toMarker()
    }

    suspend fun setFavorite(id: Long, favorite: Boolean) {
        val response = if (favorite) {
            api.favoriteMarker(id)
        } else {
            api.unfavoriteMarker(id)
        }
        response.throwIfUnsuccessful()
    }

    suspend fun myCreated(): List<Marker> {
        return api.myCreatedMarkers().bodyOrThrow().map { it.toMarker() }
    }

    suspend fun myFavorites(): List<Marker> {
        return api.myFavoriteMarkers().bodyOrThrow().map { it.toMarker() }
    }

    private fun <T> Response<T>.bodyOrThrow(): T {
        if (!isSuccessful) {
            throw MarkerRepositoryException(code(), errorBody()?.string())
        }
        return body() ?: throw MarkerRepositoryException(code(), "响应为空")
    }

    private fun Response<Unit>.throwIfUnsuccessful() {
        if (!isSuccessful) {
            throw MarkerRepositoryException(code(), errorBody()?.string())
        }
    }
}

class MarkerRepositoryException(
    val statusCode: Int?,
    message: String?,
) : Exception(message?.takeIf { it.isNotBlank() } ?: "点位请求失败")
