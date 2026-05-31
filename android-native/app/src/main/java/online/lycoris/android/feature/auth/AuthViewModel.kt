package online.lycoris.android.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUiState(
    val user: User? = null,
    val loading: Boolean = false,
    val message: String? = null,
) {
    val isLoggedIn: Boolean = user != null
}

class AuthViewModel(
    private val repository: AuthRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState(loading = true))
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    val isLoggedIn: Boolean
        get() = state.value.isLoggedIn

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, message = null) }
            applyAuthResult(repository.refreshMe())
        }
    }

    fun login(username: String, password: String) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, message = null) }
            applyAuthResult(repository.login(username, password))
        }
    }

    fun register(request: RegisterRequest) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, message = null) }
            applyAuthResult(repository.register(request))
        }
    }

    fun logout() {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, message = null) }
            repository.logout()
            _state.value = AuthUiState(message = "已退出登录")
        }
    }

    private fun applyAuthResult(result: AuthResult) {
        _state.value = when (result) {
            is AuthResult.Authenticated -> AuthUiState(user = result.user)
            is AuthResult.Failed -> AuthUiState(message = result.message)
            AuthResult.Unauthenticated -> AuthUiState()
        }
    }
}
