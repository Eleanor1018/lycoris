package online.lycoris.android.app

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Article
import androidx.compose.material.icons.outlined.Map
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Search
import androidx.compose.ui.graphics.vector.ImageVector

sealed class LycorisDestination(
    val route: String,
    val label: String,
    val icon: ImageVector? = null,
) {
    data object Map : LycorisDestination(
        route = "map",
        label = "地图",
        icon = Icons.Outlined.Map,
    )

    data object Search : LycorisDestination(
        route = "search",
        label = "搜索",
        icon = Icons.Outlined.Search,
    )

    data object Documents : LycorisDestination(
        route = "documents",
        label = "文档",
        icon = Icons.Outlined.Article,
    )

    data object Profile : LycorisDestination(
        route = "profile",
        label = "我的",
        icon = Icons.Outlined.Person,
    )

    data object Login : LycorisDestination(
        route = "login",
        label = "登录",
    )

    data object Register : LycorisDestination(
        route = "register",
        label = "注册",
    )

    companion object {
        val bottomBarDestinations = listOf(Map, Search, Documents, Profile)
    }
}
