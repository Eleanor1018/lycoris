package online.lycoris.android.app

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Article
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Search
import androidx.compose.ui.graphics.vector.ImageVector

sealed class LycorisDestination(
    val route: String,
    val label: String,
) {
    open val icon: ImageVector? = null

    data object Map : LycorisDestination(
        route = "map",
        label = "地图",
    ) {
        override val icon: ImageVector
            get() = Icons.Outlined.Map
    }

    data object Search : LycorisDestination(
        route = "search",
        label = "搜索",
    ) {
        override val icon: ImageVector
            get() = Icons.Outlined.Search
    }

    data object Documents : LycorisDestination(
        route = "documents",
        label = "文档",
    ) {
        override val icon: ImageVector
            get() = Icons.AutoMirrored.Outlined.Article
    }

    data object Profile : LycorisDestination(
        route = "profile",
        label = "我的",
    ) {
        override val icon: ImageVector
            get() = Icons.Outlined.Person
    }

    data object Login : LycorisDestination(
        route = "login",
        label = "登录",
    )

    data object Register : LycorisDestination(
        route = "register",
        label = "注册",
    )

    companion object {
        val bottomBarDestinations: List<LycorisDestination>
            get() = listOf(Map, Search, Documents, Profile)

        fun routeAfterAuthStateChange(
            currentRoute: String?,
            isLoggedIn: Boolean,
        ): String? {
            if (!isLoggedIn) return null
            return when (currentRoute) {
                Login.route,
                Register.route -> Profile.route
                else -> null
            }
        }

        fun authSuccessPopUpRoute(
            currentRoute: String?,
            hasLoginBackStackEntry: Boolean = true,
        ): String? {
            return when (currentRoute) {
                Login.route -> Login.route
                Register.route -> if (hasLoginBackStackEntry) Login.route else Register.route
                else -> null
            }
        }
    }
}
