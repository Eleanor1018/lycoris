package online.lycoris.android.feature.auth

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import online.lycoris.android.core.network.NetworkModule
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AuthRepositoryTest {
    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun loginPostsCredentialsAndReturnsAuthenticatedUser() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """
                    {"data":{"publicId":"u1","username":"nora","nickname":"Nora","email":"nora@example.com","avatarUrl":"/uploads/a.jpg","role":"USER"}}
                    """.trimIndent(),
                ),
        )
        val api = NetworkModule.api(
            server.url("/").toString(),
            OkHttpClient(),
        )
        val repository = AuthRepository(api)

        val result = repository.login("nora", "secret")
        val request = server.takeRequest()

        assertTrue(result is AuthResult.Authenticated)
        assertEquals("nora", (result as AuthResult.Authenticated).user.username)
        assertEquals("/api/login", request.path)
    }
}
