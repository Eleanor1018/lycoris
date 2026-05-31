package online.lycoris.android.app

import org.junit.Assert.assertEquals
import org.junit.Test

class LycorisNavTest {
    @Test
    fun bottomBarDestinationsMatchWebNavigationRoutes() {
        val routes = LycorisDestination.bottomBarDestinations.map { it.route }

        assertEquals(listOf("map", "search", "documents", "profile"), routes)
    }
}
