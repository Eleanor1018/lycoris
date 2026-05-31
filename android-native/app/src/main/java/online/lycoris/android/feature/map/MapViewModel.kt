package online.lycoris.android.feature.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class MapViewModel(
    private val repository: MapRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(MapUiState())
    val state: StateFlow<MapUiState> = _state.asStateFlow()
    private var loadViewportJob: Job? = null
    private var loadViewportRequestId = 0L
    private var loadNearbyJob: Job? = null
    private var loadNearbyRequestId = 0L
    private val favoriteMutex = Mutex()

    fun loadViewport(bounds: ViewportBounds) {
        loadViewportJob?.cancel()
        val requestId = ++loadViewportRequestId
        loadViewportJob = viewModelScope.launch {
            val categories = state.value.visibleCategories.toList()
            _state.update { it.copy(loading = true, message = null) }

            try {
                val markers = repository.loadViewport(bounds, categories)
                val favoriteIds = repository.loadFavoriteIds().toSet()
                if (requestId == loadViewportRequestId) {
                    _state.update {
                        it.copy(
                            loading = false,
                            markers = markers,
                            favoriteIds = favoriteIds,
                        )
                    }
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                if (requestId == loadViewportRequestId) {
                    _state.update {
                        it.copy(
                            loading = false,
                            message = error.message?.takeIf { message -> message.isNotBlank() } ?: "点位加载失败",
                        )
                    }
                }
            }
        }
    }

    fun selectMarker(id: Long?) {
        _state.update { it.copy(selectedMarkerId = id) }
    }

    fun loadFavorites() {
        viewModelScope.launch {
            try {
                val favoriteIds = repository.loadFavoriteIds().toSet()
                _state.update {
                    it.copy(
                        favoriteIds = favoriteIds,
                        message = null,
                    )
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                _state.update {
                    it.copy(message = error.message?.takeIf { message -> message.isNotBlank() } ?: "收藏加载失败")
                }
            }
        }
    }

    fun toggleFavorite(markerId: Long) {
        viewModelScope.launch {
            favoriteMutex.withLock {
                try {
                    val nextFavorite = markerId !in state.value.favoriteIds
                    repository.setFavorite(markerId, nextFavorite)
                    val favoriteIds = repository.loadFavoriteIds().toSet()
                    _state.update {
                        it.copy(
                            favoriteIds = favoriteIds,
                            message = null,
                        )
                    }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    _state.update {
                        it.copy(message = error.message?.takeIf { message -> message.isNotBlank() } ?: "收藏操作失败")
                    }
                }
            }
        }
    }

    fun loadNearby(
        lat: Double,
        lng: Double,
        radius: Int,
        category: MarkerCategory,
    ) {
        loadNearbyJob?.cancel()
        val requestId = ++loadNearbyRequestId
        loadNearbyJob = viewModelScope.launch {
            _state.update { it.copy(loading = true, message = null) }

            try {
                val nearbyMarkers = repository.loadNearby(lat, lng, radius, category)
                if (requestId == loadNearbyRequestId) {
                    _state.update { current ->
                        val markersById = current.markers.associateBy { it.id }.toMutableMap()
                        nearbyMarkers.forEach { marker ->
                            markersById[marker.id] = marker
                        }
                        current.copy(
                            loading = false,
                            markers = markersById.values.toList(),
                        )
                    }
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                if (requestId == loadNearbyRequestId) {
                    _state.update {
                        it.copy(
                            loading = false,
                            message = error.message?.takeIf { message -> message.isNotBlank() } ?: "附近点位查询失败",
                        )
                    }
                }
            }
        }
    }

    fun toggleCategory(category: MarkerCategory) {
        _state.update { current ->
            val categories = current.visibleCategories.toMutableSet()
            if (!categories.add(category)) {
                categories.remove(category)
            }
            current.copy(visibleCategories = categories)
        }
    }
}
