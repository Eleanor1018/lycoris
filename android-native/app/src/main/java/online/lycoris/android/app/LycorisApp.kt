package online.lycoris.android.app

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import online.lycoris.android.core.config.BuildConstants
import online.lycoris.android.core.design.LycorisTheme
import online.lycoris.android.core.network.NetworkModule
import online.lycoris.android.core.session.InMemorySessionStore
import online.lycoris.android.core.session.PersistentCookieJar
import online.lycoris.android.feature.auth.AuthRepository
import online.lycoris.android.feature.auth.AuthViewModel
import online.lycoris.android.feature.auth.LoginScreen
import online.lycoris.android.feature.auth.RegisterScreen

@Composable
fun LycorisApp() {
    LycorisTheme {
        val navController = rememberNavController()
        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentDestination = navBackStackEntry?.destination
        val constants = remember { BuildConstants() }
        val sessionStore = remember { InMemorySessionStore() }
        val api = remember {
            NetworkModule.api(
                constants.apiBaseUrl,
                NetworkModule.okHttp(PersistentCookieJar(sessionStore)),
            )
        }
        val authViewModel = remember { AuthViewModel(AuthRepository(api)) }
        val authState by authViewModel.state.collectAsState()

        Scaffold(
            bottomBar = {
                NavigationBar {
                    LycorisDestination.bottomBarDestinations.forEach { destination ->
                        NavigationBarItem(
                            selected = currentDestination?.hierarchy?.any {
                                it.route == destination.route
                            } == true,
                            onClick = {
                                navController.navigate(destination.route) {
                                    popUpTo(navController.graph.startDestinationId) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                destination.icon?.let { icon ->
                                    Icon(imageVector = icon, contentDescription = destination.label)
                                }
                            },
                            label = { Text(destination.label) },
                        )
                    }
                }
            },
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = LycorisDestination.Map.route,
                modifier = Modifier.padding(innerPadding),
            ) {
                composable(LycorisDestination.Map.route) {
                    Text("地图")
                }
                composable(LycorisDestination.Search.route) {
                    Text("搜索")
                }
                composable(LycorisDestination.Documents.route) {
                    Text("文档")
                }
                composable(LycorisDestination.Profile.route) {
                    Text("我的")
                }
                composable(LycorisDestination.Login.route) {
                    LoginScreen(
                        state = authState,
                        onLogin = authViewModel::login,
                        onRegisterClick = {
                            navController.navigate(LycorisDestination.Register.route)
                        },
                    )
                }
                composable(LycorisDestination.Register.route) {
                    RegisterScreen(
                        state = authState,
                        onRegister = authViewModel::register,
                        onLoginClick = {
                            navController.navigate(LycorisDestination.Login.route) {
                                popUpTo(LycorisDestination.Login.route) {
                                    inclusive = true
                                }
                            }
                        },
                    )
                }
            }
        }
    }
}
