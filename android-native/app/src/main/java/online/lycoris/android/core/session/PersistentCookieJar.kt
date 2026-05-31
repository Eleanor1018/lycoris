package online.lycoris.android.core.session

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class PersistentCookieJar(
    private val store: SessionStore,
) : CookieJar {
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val now = System.currentTimeMillis()
        val existing = store.readCookies()
            .filter { it.expiresAt > now }
            .filterNot { old ->
                cookies.any { new ->
                    old.name == new.name &&
                        old.domain == new.domain &&
                        old.path == new.path
                }
            }
        val freshIncoming = cookies.filter { it.expiresAt > now }
        store.writeCookies(existing + freshIncoming)
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        val freshCookies = store.readCookies().filter { it.expiresAt > now }
        store.writeCookies(freshCookies)
        return freshCookies.filter { it.matches(url) }
    }
}
