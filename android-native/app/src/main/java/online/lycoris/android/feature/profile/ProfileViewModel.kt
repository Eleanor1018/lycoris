package online.lycoris.android.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import online.lycoris.android.feature.map.Marker

data class ProfileUiState(
    val loading: Boolean = false,
    val createdMarkers: List<Marker> = emptyList(),
    val favoriteMarkers: List<Marker> = emptyList(),
    val message: String? = null,
)

class ProfileViewModel(
    private val repository: ProfileRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()
    private var loadJob: Job? = null

    fun load() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _state.update { it.copy(loading = true, message = null) }
            try {
                val created = loadMarkersOrNull { repository.createdMarkers() }
                val favorites = loadMarkersOrNull { repository.favoriteMarkers() }
                _state.value = ProfileUiState(
                    createdMarkers = created.orEmpty(),
                    favoriteMarkers = favorites.orEmpty(),
                    message = if (created == null && favorites == null) "ç‚¹ä½åˆ—è¡¨åŠ è½½å¤±è´¥" else null,
                )
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                _state.value = ProfileUiState(message = "点位列表加载失败")
            }
        }
    }

    fun clear() {
        loadJob?.cancel()
        loadJob = null
        _state.value = ProfileUiState()
    }

    private suspend fun loadMarkersOrNull(block: suspend () -> List<Marker>): List<Marker>? {
        return try {
            block()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Throwable) {
            null
        }
    }
}
