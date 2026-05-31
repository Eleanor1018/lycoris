package online.lycoris.android.core.network

import online.lycoris.android.feature.auth.LoginRequest
import online.lycoris.android.feature.auth.RegisterRequest
import online.lycoris.android.feature.auth.UserDto
import online.lycoris.android.feature.map.MarkerCreateRequest
import online.lycoris.android.feature.map.MarkerDto
import online.lycoris.android.feature.map.MarkerUpdateRequest
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.POST
import retrofit2.http.Query

interface LycorisApi {
    @POST("/api/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiEnvelope<UserDto>>

    @POST("/api/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiEnvelope<UserDto>>

    @GET("/api/me")
    suspend fun me(): Response<ApiEnvelope<UserDto>>

    @POST("/api/logout")
    suspend fun logout(): Response<ApiEnvelope<Unit>>

    @GET("/api/markers/viewport")
    suspend fun viewportMarkers(
        @Query("minLat") minLat: Double,
        @Query("maxLat") maxLat: Double,
        @Query("minLng") minLng: Double,
        @Query("maxLng") maxLng: Double,
        @Query("categories") categories: String,
    ): Response<List<MarkerDto>>

    @GET("/api/markers/nearby")
    suspend fun nearbyMarkers(
        @Query("lat") lat: Double,
        @Query("lng") lng: Double,
        @Query("radius") radius: Int,
        @Query("category") category: String,
    ): Response<List<MarkerDto>>

    @GET("/api/markers/search")
    suspend fun searchMarkers(@Query("q") keyword: String): Response<List<MarkerDto>>

    @GET("/api/markers/me/favorites")
    suspend fun favoriteMarkerIds(): Response<List<Long>>

    @POST("/api/markers")
    suspend fun createMarker(@Body request: MarkerCreateRequest): Response<MarkerDto>

    @PATCH("/api/markers/{id}")
    suspend fun updateMarker(
        @Path("id") id: Long,
        @Body request: MarkerUpdateRequest,
    ): Response<MarkerDto>

    @DELETE("/api/markers/{id}")
    suspend fun deleteMarker(@Path("id") id: Long): Response<Unit>

    @Multipart
    @POST("/api/markers/{id}/image")
    suspend fun uploadMarkerImage(
        @Path("id") id: Long,
        @Part image: MultipartBody.Part,
    ): Response<MarkerDto>

    @POST("/api/markers/{id}/favorite")
    suspend fun favoriteMarker(@Path("id") id: Long): Response<Unit>

    @DELETE("/api/markers/{id}/favorite")
    suspend fun unfavoriteMarker(@Path("id") id: Long): Response<Unit>

    @GET("/api/markers/me/created")
    suspend fun myCreatedMarkers(): Response<List<MarkerDto>>

    @GET("/api/markers/me/favorites/details")
    suspend fun myFavoriteMarkers(): Response<List<MarkerDto>>
}
