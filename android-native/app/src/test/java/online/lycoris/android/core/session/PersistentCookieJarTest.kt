package online.lycoris.android.core.session

import okhttp3.Cookie
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PersistentCookieJarTest {
    @Test
    fun storesAndReturnsMatchingCookies() {
        val store = InMemorySessionStore()
        val jar = PersistentCookieJar(store)
        val url = "https://api.lycoris.online/api/login".toHttpUrl()
        val cookie = Cookie.Builder()
            .name("JSESSIONID")
            .value("abc")
            .domain("api.lycoris.online")
            .path("/")
            .build()

        jar.saveFromResponse(url, listOf(cookie))

        assertEquals(listOf(cookie), jar.loadForRequest(url))
    }

    @Test
    fun deletionCookieRemovesStoredMatchingCookie() {
        val store = InMemorySessionStore()
        val jar = PersistentCookieJar(store)
        val url = "https://api.lycoris.online/api/login".toHttpUrl()
        val cookie = Cookie.Builder()
            .name("JSESSIONID")
            .value("abc")
            .domain("api.lycoris.online")
            .path("/")
            .build()
        val deletionCookie = Cookie.Builder()
            .name("JSESSIONID")
            .value("")
            .domain("api.lycoris.online")
            .path("/")
            .expiresAt(0)
            .build()

        jar.saveFromResponse(url, listOf(cookie))
        jar.saveFromResponse(url, listOf(deletionCookie))

        assertEquals(emptyList<Cookie>(), jar.loadForRequest(url))
    }

    @Test
    fun cookiePersistenceCodecRoundTripsCookieFields() {
        val cookie = Cookie.Builder()
            .name("JSESSIONID")
            .value("abc")
            .expiresAt(4_102_444_800_000)
            .hostOnlyDomain("api.lycoris.online")
            .path("/api")
            .secure()
            .httpOnly()
            .build()

        val decoded = CookiePersistenceCodec.decode(
            CookiePersistenceCodec.encode(listOf(cookie)),
        ).single()

        assertEquals(cookie.name, decoded.name)
        assertEquals(cookie.value, decoded.value)
        assertEquals(cookie.expiresAt, decoded.expiresAt)
        assertEquals(cookie.domain, decoded.domain)
        assertEquals(cookie.path, decoded.path)
        assertEquals(cookie.secure, decoded.secure)
        assertEquals(cookie.httpOnly, decoded.httpOnly)
        assertTrue(decoded.hostOnly)
    }
}
