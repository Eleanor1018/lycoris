package online.lycoris.android.feature.map

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class MapViewModel(
    private val repository: MarkerRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(MapUiState())
    val state: StateFlow<MapUiState> = _state.asStateFlow()

    fun loadViewport(bounds: ViewportBounds) {
        viewModelScope.launch {
            val categories = state.value.visibleCategories.toList()
            _state.update { it.copy(loading = true, message = null) }

            runCatching {
                val markers = repository.loadViewport(bounds, categories)
                val favoriteIds = repository.loadFavoriteIds().toSet()
                markers to favoriteIds
            }.onSuccess { (markers, favoriteIds) ->
                _state.update {
                    it.copy(
                        loading = false,
                        markers = markers,
                        favoriteIds = favoriteIds,
                    )
                }
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        loading = false,
                        message = error.message?.takeIf { message -> message.isNotBlank() } ?: "点位加载失败",
                    )
                }
            }
        }
    }

    fun selectMarker(id: Long?) {
        _state.update { it.copy(selectedMarkerId = id) }
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
