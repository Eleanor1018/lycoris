package online.lycoris.android.app

import org.junit.Assert.assertEquals
import org.junit.Test

class LycorisNavTest {
    @Test
    fun bottomBarDestinationsMatchWebNavigationRoutes() {
        val routes = LycorisDestination.bottomBarDestinations.map { it.route }

        assertEquals(listOf("map", "search", "documents", "profile"), routes)
    }

    @Test
    fun authenticatedUsersLeaveAuthRoutesForProfile() {
        assertEquals(
            LycorisDestination.Profile.route,
            LycorisDestination.routeAfterAuthStateChange(
                currentRoute = LycorisDestination.Login.route,
                isLoggedIn = true,
            ),
        )
        assertEquals(
            LycorisDestination.Profile.route,
            LycorisDestination.routeAfterAuthStateChange(
                currentRoute = LycorisDestination.Register.route,
                isLoggedIn = true,
            ),
        )
    }

    @Test
    fun authSuccessPopsFullAuthStackFromAuthRoutes() {
        assertEquals(
            LycorisDestination.Login.route,
            LycorisDestination.authSuccessPopUpRoute(
                currentRoute = LycorisDestination.Login.route,
            ),
        )
        assertEquals(
            LycorisDestination.Login.route,
            LycorisDestination.authSuccessPopUpRoute(
                currentRoute = LycorisDestination.Register.route,
            ),
        )
    }

    @Test
    fun authSuccessDoesNotPopMainRoutes() {
        assertEquals(
            null,
            LycorisDestination.authSuccessPopUpRoute(
                currentRoute = LycorisDestination.Map.route,
            ),
        )
    }

    @Test
    fun authRoutePolicyDoesNotRedirectLoggedOutUsersOrMainRoutes() {
        assertEquals(
            null,
            LycorisDestination.routeAfterAuthStateChange(
                currentRoute = LycorisDestination.Login.route,
                isLoggedIn = false,
            ),
        )
        assertEquals(
            null,
            LycorisDestination.routeAfterAuthStateChange(
                currentRoute = LycorisDestination.Map.route,
                isLoggedIn = true,
            ),
        )
    }
}
