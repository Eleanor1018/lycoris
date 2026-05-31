package online.lycoris.android.feature.search

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SearchUiState(
    val query: String = "",
    val loading: Boolean = false,
    val markers: List<online.lycoris.android.feature.map.Marker> = emptyList(),
    val documents: List<online.lycoris.android.feature.documents.DocumentSearchResult> = emptyList(),
    val markerError: String? = null,
)

class SearchViewModel(
    private val repository: SearchRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = _state.asStateFlow()
    private var searchJob: Job? = null

    fun updateQuery(value: String) {
        _state.update { it.copy(query = value) }
    }

    fun search(context: Context) {
        val query = state.value.query.trim()
        searchJob?.cancel()
        if (query.isBlank()) {
            _state.value = SearchUiState()
            return
        }

        searchJob = viewModelScope.launch {
            _state.update { it.copy(loading = true, markerError = null) }
            try {
                val results = repository.search(context.applicationContext, query)
                _state.update {
                    it.copy(
                        loading = false,
                        markers = results.markers,
                        documents = results.documents,
                        markerError = results.markerError,
                    )
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                _state.update {
                    it.copy(
                        loading = false,
                        markers = emptyList(),
                        documents = emptyList(),
                        markerError = "搜索失败",
                    )
                }
            }
        }
    }
}
