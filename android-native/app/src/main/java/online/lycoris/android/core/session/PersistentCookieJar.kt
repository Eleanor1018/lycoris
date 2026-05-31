package online.lycoris.android.core.session

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

class PersistentCookieJar(
    private val store: SessionStore,
) : CookieJar {
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val existing = store.readCookies()
            .filterNot { old ->
                cookies.any { new ->
                    old.name == new.name &&
                        old.domain == new.domain &&
                        old.path == new.path
                }
            }
        store.writeCookies(existing + cookies)
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        return store.readCookies().filter { it.matches(url) }
    }
}
