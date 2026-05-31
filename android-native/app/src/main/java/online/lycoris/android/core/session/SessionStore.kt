package online.lycoris.android.core.session

import okhttp3.Cookie

interface SessionStore {
    fun readCookies(): List<Cookie>
    fun writeCookies(cookies: List<Cookie>)
    fun clear()
}

class InMemorySessionStore : SessionStore {
    private var cookies: List<Cookie> = emptyList()

    override fun readCookies(): List<Cookie> = cookies

    override fun writeCookies(cookies: List<Cookie>) {
        this.cookies = cookies
    }

    override fun clear() {
        cookies = emptyList()
    }
}
