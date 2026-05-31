package online.lycoris.android.core.session

import android.content.Context
import android.content.SharedPreferences
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
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

class SharedPreferencesSessionStore(
    context: Context,
) : SessionStore {
    private val preferences: SharedPreferences = context.applicationContext.getSharedPreferences(
        PreferencesName,
        Context.MODE_PRIVATE,
    )

    override fun readCookies(): List<Cookie> {
        val encoded = preferences.getString(CookiesKey, null) ?: return emptyList()
        return CookiePersistenceCodec.decode(encoded)
    }

    override fun writeCookies(cookies: List<Cookie>) {
        preferences.edit()
            .putString(CookiesKey, CookiePersistenceCodec.encode(cookies))
            .apply()
    }

    override fun clear() {
        preferences.edit()
            .remove(CookiesKey)
            .apply()
    }

    private companion object {
        const val PreferencesName = "lycoris_session"
        const val CookiesKey = "cookies"
    }
}

object CookiePersistenceCodec {
    private val json = Json {
        ignoreUnknownKeys = true
    }

    fun encode(cookies: List<Cookie>): String {
        val storedCookies = cookies.map { cookie ->
            StoredCookie(
                name = cookie.name,
                value = cookie.value,
                expiresAt = cookie.expiresAt,
                domain = cookie.domain,
                path = cookie.path,
                secure = cookie.secure,
                httpOnly = cookie.httpOnly,
                hostOnly = cookie.hostOnly,
            )
        }
        return json.encodeToString(storedCookies)
    }

    fun decode(encoded: String): List<Cookie> {
        return try {
            json.decodeFromString<List<StoredCookie>>(encoded).mapNotNull { it.toCookieOrNull() }
        } catch (_: IllegalArgumentException) {
            emptyList()
        } catch (_: SerializationException) {
            emptyList()
        }
    }
}

@Serializable
private data class StoredCookie(
    val name: String,
    val value: String,
    val expiresAt: Long,
    val domain: String,
    val path: String,
    val secure: Boolean,
    val httpOnly: Boolean,
    val hostOnly: Boolean,
) {
    fun toCookieOrNull(): Cookie? {
        return try {
            Cookie.Builder()
                .name(name)
                .value(value)
                .expiresAt(expiresAt)
                .apply {
                    if (hostOnly) {
                        hostOnlyDomain(domain)
                    } else {
                        domain(domain)
                    }
                    path(path)
                    if (secure) {
                        secure()
                    }
                    if (httpOnly) {
                        httpOnly()
                    }
                }
                .build()
        } catch (_: IllegalArgumentException) {
            null
        }
    }
}
