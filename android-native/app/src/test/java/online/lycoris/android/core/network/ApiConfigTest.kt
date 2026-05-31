package online.lycoris.android.core.network

import org.junit.Assert.assertEquals
import org.junit.Test

class ApiConfigTest {
    @Test
    fun buildsAbsoluteApiUrl() {
        val config = ApiConfig(baseUrl = "https://api.lycoris.online")

        assertEquals("https://api.lycoris.online/api/me", config.url("/api/me"))
        assertEquals("https://api.lycoris.online/uploads/a.jpg", config.url("/uploads/a.jpg"))
    }

    @Test
    fun leavesAbsoluteAssetsUnchanged() {
        val config = ApiConfig(baseUrl = "https://api.lycoris.online")

        assertEquals("https://cdn.example/a.jpg", config.assetUrl("https://cdn.example/a.jpg"))
        assertEquals("https://api.lycoris.online/uploads/a.jpg", config.assetUrl("/uploads/a.jpg"))
    }
}
