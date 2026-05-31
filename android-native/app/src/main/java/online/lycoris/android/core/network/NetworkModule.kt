package online.lycoris.android.core.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import online.lycoris.android.core.session.PersistentCookieJar
import retrofit2.Retrofit

@Serializable
data class ApiEnvelope<T>(
    val code: Int? = null,
    val message: String? = null,
    val data: T? = null,
)

object NetworkModule {
    val json: Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    fun okHttp(cookieJar: PersistentCookieJar): OkHttpClient {
        return OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                },
            )
            .build()
    }

    fun retrofit(baseUrl: String, client: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl("${baseUrl.trim().trimEnd('/')}/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    fun api(baseUrl: String, client: OkHttpClient): LycorisApi {
        return retrofit(baseUrl, client).create(LycorisApi::class.java)
    }
}
