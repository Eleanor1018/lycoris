package online.lycoris.android.feature.map

import kotlinx.coroutines.CancellationException
import okhttp3.MultipartBody
import online.lycoris.android.core.network.LycorisApi
import retrofit2.Response

class MarkerRepository(
    private val api: LycorisApi,
) {
    suspend fun loadViewport(
        bounds: ViewportBounds,
        categories: List<MarkerCategory>,
    ): List<Marker> = repositoryCall("点位加载失败") {
        api.viewportMarkers(
            minLat = bounds.minLat,
            maxLat = bounds.maxLat,
            minLng = bounds.minLng,
            maxLng = bounds.maxLng,
            categories = categories.joinToString(",") { it.wireName },
        ).bodyOrThrow().map { it.toMarker() }
    }

    suspend fun loadFavoriteIds(): List<Long> = repositoryCall("收藏操作失败") {
        api.favoriteMarkerIds().bodyOrThrow()
    }

    suspend fun loadNearby(
        lat: Double,
        lng: Double,
        radius: Int,
        category: MarkerCategory,
    ): List<Marker> = repositoryCall("附近点位查询失败") {
        api.nearbyMarkers(
            lat = lat,
            lng = lng,
            radius = radius,
            category = category.wireName,
        ).bodyOrThrow().map { it.toMarker() }
    }

    suspend fun createMarker(request: MarkerCreateRequest): Marker = repositoryCall("点位提交失败") {
        api.createMarker(request).bodyOrThrow().toMarker()
    }

    suspend fun updateMarker(id: Long, request: MarkerUpdateRequest): Marker = repositoryCall("点位编辑提交失败") {
        api.updateMarker(id, request).bodyOrThrow().toMarker()
    }

    suspend fun deleteMarker(id: Long): Unit = repositoryCall("点位删除失败") {
        api.deleteMarker(id).throwIfUnsuccessful()
    }

    suspend fun uploadMarkerImage(id: Long, image: MultipartBody.Part): Marker = repositoryCall("图片上传失败") {
        api.uploadMarkerImage(id, image).bodyOrThrow().toMarker()
    }

    suspend fun setFavorite(id: Long, favorite: Boolean): Unit = repositoryCall("收藏操作失败") {
        val response = if (favorite) {
            api.favoriteMarker(id)
        } else {
            api.unfavoriteMarker(id)
        }
        response.throwIfUnsuccessful()
    }

    suspend fun myCreated(): List<Marker> = repositoryCall("点位加载失败") {
        api.myCreatedMarkers().bodyOrThrow().map { it.toMarker() }
    }

    suspend fun myFavorites(): List<Marker> = repositoryCall("收藏操作失败") {
        api.myFavoriteMarkers().bodyOrThrow().map { it.toMarker() }
    }

    private suspend fun <T> repositoryCall(
        fallbackMessage: String,
        block: suspend () -> T,
    ): T {
        return try {
            block()
        } catch (error: CancellationException) {
            throw error
        } catch (error: MarkerRepositoryException) {
            throw MarkerRepositoryException(error.statusCode, fallbackMessage)
        } catch (error: Throwable) {
            throw MarkerRepositoryException(null, fallbackMessage)
        }
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
) : Exception(message?.takeIf { it.isNotBlank() } ?: "点位加载失败")
