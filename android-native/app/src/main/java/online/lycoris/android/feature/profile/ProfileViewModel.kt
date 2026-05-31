package online.lycoris.android.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
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

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, message = null) }
            try {
                val created = async { repository.createdMarkers() }
                val favorites = async { repository.favoriteMarkers() }
                _state.value = ProfileUiState(
                    createdMarkers = created.await(),
                    favoriteMarkers = favorites.await(),
                )
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                _state.value = ProfileUiState(message = "点位列表加载失败")
            }
        }
    }

    fun clear() {
        _state.value = ProfileUiState()
    }
}
