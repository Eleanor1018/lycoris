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

    @Test
    fun loginReturnsFailedWhenNetworkRequestFails() = runTest {
        val repository = AuthRepository(createApi())
        server.shutdown()

        val result = repository.login("nora", "secret")

        assertTrue(result is AuthResult.Failed)
    }

    @Test
    fun loginReturnsFailedWhenResponseJsonIsMalformed() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody("{not-json"),
        )
        val repository = AuthRepository(createApi())

        val result = repository.login("nora", "secret")

        assertTrue(result is AuthResult.Failed)
    }

    @Test
    fun loginSurfacesErrorBodyMessageOnBadRequest() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(400)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"code":400,"message":"用户名或密码错误"}"""),
        )
        val repository = AuthRepository(createApi())

        val result = repository.login("nora", "wrong")

        assertTrue(result is AuthResult.Failed)
        assertEquals("用户名或密码错误", (result as AuthResult.Failed).message)
    }

    @Test
    fun loginReturnsFailedWhenSuccessfulHttpEnvelopeHasNonzeroCode() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"code":1001,"message":"账号未启用","data":null}"""),
        )
        val repository = AuthRepository(createApi())

        val result = repository.login("nora", "secret")

        assertTrue(result is AuthResult.Failed)
        assertEquals("账号未启用", (result as AuthResult.Failed).message)
    }

    @Test
    fun refreshMeReturnsUnauthenticatedOnUnauthorized() = runTest {
        server.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"code":401,"message":"未登录"}"""),
        )
        val repository = AuthRepository(createApi())

        val result = repository.refreshMe()

        assertEquals(AuthResult.Unauthenticated, result)
    }

    private fun createApi() = NetworkModule.api(
        server.url("/").toString(),
        OkHttpClient(),
    )
}
