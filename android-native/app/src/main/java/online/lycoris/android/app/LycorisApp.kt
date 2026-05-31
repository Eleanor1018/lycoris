package online.lycoris.android.app

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import online.lycoris.android.core.design.LycorisTheme
import online.lycoris.android.feature.auth.AuthViewModel
import online.lycoris.android.feature.auth.LoginScreen
import online.lycoris.android.feature.auth.RegisterScreen
import online.lycoris.android.feature.documents.DocumentsScreen
import online.lycoris.android.feature.map.MapScreen
import online.lycoris.android.feature.map.MapViewModel
import online.lycoris.android.feature.map.MarkerDraft
import online.lycoris.android.feature.map.MarkerEditorSheet
import online.lycoris.android.feature.map.MarkerSubmitCoordinator
import online.lycoris.android.feature.map.ViewportBounds
import online.lycoris.android.feature.profile.ProfileScreen
import online.lycoris.android.feature.profile.ProfileViewModel
import online.lycoris.android.feature.search.SearchScreen
import online.lycoris.android.feature.search.SearchViewModel

private val BeijingInitialBounds = ViewportBounds(
    minLat = 39.70,
    maxLat = 40.10,
    minLng = 116.10,
    maxLng = 116.70,
)

private const val BeijingMvpLat = 39.9042
private const val BeijingMvpLng = 116.4074

@Composable
fun LycorisApp(
    container: LycorisAppContainer,
) {
    LycorisTheme {
        val navController = rememberNavController()
        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentDestination = navBackStackEntry?.destination
        val authViewModel: AuthViewModel = viewModel(
            factory = AuthViewModelFactory(container),
        )
        val authState by authViewModel.state.collectAsStateWithLifecycle()
        val mapViewModel: MapViewModel = viewModel(
            factory = MapViewModelFactory(container),
        )
        val mapState by mapViewModel.state.collectAsStateWithLifecycle()
        val searchViewModel: SearchViewModel = viewModel(
            factory = SearchViewModelFactory(container),
        )
        val profileViewModel: ProfileViewModel = viewModel(
            factory = ProfileViewModelFactory(container),
        )
        val markerSubmitCoordinator = remember { MarkerSubmitCoordinator() }
        var addMarkerDraft by remember { mutableStateOf<MarkerDraft?>(null) }

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
                    LaunchedEffect(Unit) {
                        mapViewModel.loadViewport(BeijingInitialBounds)
                    }
                    MapScreen(
                        state = mapState,
                        onMarkerClick = mapViewModel::selectMarker,
                        onDismissMarker = { mapViewModel.selectMarker(null) },
                        onToggleFavorite = mapViewModel::toggleFavorite,
                        onAddClick = {
                            addMarkerDraft = newAddMarkerDraft(markerSubmitCoordinator)
                        },
                    )
                    addMarkerDraft?.let { draft ->
                        val submittingDraft = mapState.creatingClientRequestId == draft.clientRequestId
                        LaunchedEffect(mapState.completedCreateClientRequestId, draft.clientRequestId) {
                            if (mapState.completedCreateClientRequestId == draft.clientRequestId) {
                                addMarkerDraft = null
                            }
                        }
                        MarkerEditorSheet(
                            initialDraft = draft,
                            submitting = submittingDraft,
                            onDismiss = {
                                if (!submittingDraft) {
                                    addMarkerDraft = null
                                }
                            },
                            onSubmit = { submittedDraft ->
                                addMarkerDraft = submittedDraft
                                mapViewModel.createMarker(submittedDraft)
                            },
                        )
                    }
                }
                composable(LycorisDestination.Search.route) {
                    SearchScreen(viewModel = searchViewModel)
                }
                composable(LycorisDestination.Documents.route) {
                    DocumentsScreen(repository = container.documentRepository)
                }
                composable(LycorisDestination.Profile.route) {
                    ProfileScreen(
                        authState = authState,
                        viewModel = profileViewModel,
                        onOpenLogin = {
                            navController.navigate(LycorisDestination.Login.route)
                        },
                        onLogout = authViewModel::logout,
                    )
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

internal fun newAddMarkerDraft(
    markerSubmitCoordinator: MarkerSubmitCoordinator,
): MarkerDraft {
    // MVP fallback until Task 8 grows map press selection.
    return MarkerDraft(
        lat = BeijingMvpLat,
        lng = BeijingMvpLng,
        clientRequestId = markerSubmitCoordinator.newClientRequestId(),
    )
}

private class MapViewModelFactory(
    private val container: LycorisAppContainer,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(MapViewModel::class.java)) {
            return MapViewModel(container.markerRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}

private class AuthViewModelFactory(
    private val container: LycorisAppContainer,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AuthViewModel::class.java)) {
            return AuthViewModel(container.authRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}

private class SearchViewModelFactory(
    private val container: LycorisAppContainer,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(SearchViewModel::class.java)) {
            return SearchViewModel(container.searchRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}

private class ProfileViewModelFactory(
    private val container: LycorisAppContainer,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ProfileViewModel::class.java)) {
            return ProfileViewModel(container.profileRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
