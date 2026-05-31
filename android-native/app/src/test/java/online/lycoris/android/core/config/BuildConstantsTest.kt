package online.lycoris.android.core.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BuildConstantsTest {
    @Test
    fun defaultsToProductionApiWhenBuildConfigIsBlank() {
        val constants = BuildConstants(rawApiBaseUrl = "")

        assertEquals("https://api.lycoris.online", constants.apiBaseUrl)
    }

    @Test
    fun trimsTrailingSlashFromCustomApiBaseUrl() {
        val constants = BuildConstants(rawApiBaseUrl = "http://10.0.2.2:8080///")

        assertEquals("http://10.0.2.2:8080", constants.apiBaseUrl)
        assertTrue(constants.isCustomApiBaseUrl)
    }
}
