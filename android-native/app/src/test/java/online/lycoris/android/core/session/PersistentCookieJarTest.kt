package online.lycoris.android.core.session

import okhttp3.Cookie
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
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
}
