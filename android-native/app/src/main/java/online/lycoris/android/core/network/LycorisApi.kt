package online.lycoris.android.core.network

import online.lycoris.android.feature.auth.LoginRequest
import online.lycoris.android.feature.auth.RegisterRequest
import online.lycoris.android.feature.auth.UserDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface LycorisApi {
    @POST("/api/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiEnvelope<UserDto>>

    @POST("/api/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiEnvelope<UserDto>>

    @GET("/api/me")
    suspend fun me(): Response<ApiEnvelope<UserDto>>

    @POST("/api/logout")
    suspend fun logout(): Response<ApiEnvelope<Unit>>
}
