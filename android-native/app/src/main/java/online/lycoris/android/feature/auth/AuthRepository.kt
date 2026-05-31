package online.lycoris.android.feature.auth

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import online.lycoris.android.core.network.ApiEnvelope
import online.lycoris.android.core.network.LycorisApi
import online.lycoris.android.core.network.NetworkModule
import retrofit2.Response

class AuthRepository(
    private val api: LycorisApi,
) {
    suspend fun login(username: String, password: String): AuthResult {
        return runAuthRequest("登录失败") {
            handleUserResponse(
                response = api.login(LoginRequest(username, password)),
                genericFailureMessage = "登录失败",
                emptyDataMessage = "登录响应为空",
                parseErrorBody = true,
            )
        }
    }

    suspend fun register(request: RegisterRequest): AuthResult {
        return runAuthRequest("注册失败") {
            handleUserResponse(
                response = api.register(request),
                genericFailureMessage = "注册失败",
                emptyDataMessage = "注册响应为空",
                parseErrorBody = true,
            )
        }
    }

    suspend fun refreshMe(): AuthResult {
        return runAuthRequest("获取登录状态失败") {
            val response = api.me()
            if (response.code() == 401) {
                AuthResult.Unauthenticated
            } else {
                handleUserResponse(
                    response = response,
                    genericFailureMessage = "获取登录状态失败",
                    emptyDataMessage = null,
                    parseErrorBody = false,
                )
            }
        }
    }

    suspend fun logout() {
        api.logout()
    }

    private suspend fun runAuthRequest(
        genericFailureMessage: String,
        block: suspend () -> AuthResult,
    ): AuthResult {
        return try {
            block()
        } catch (cancellation: CancellationException) {
            throw cancellation
        } catch (_: Exception) {
            AuthResult.Failed(genericFailureMessage)
        }
    }

    private fun handleUserResponse(
        response: Response<ApiEnvelope<UserDto>>,
        genericFailureMessage: String,
        emptyDataMessage: String?,
        parseErrorBody: Boolean,
    ): AuthResult {
        if (!response.isSuccessful) {
            val message = if (parseErrorBody) {
                response.errorBodyMessage() ?: genericFailureMessage
            } else {
                genericFailureMessage
            }
            return AuthResult.Failed(message)
        }

        val envelope = response.body() ?: return emptyDataMessage?.let(AuthResult::Failed)
            ?: AuthResult.Unauthenticated
        if (envelope.code != null && envelope.code != 0) {
            return AuthResult.Failed(envelope.message.validMessage() ?: genericFailureMessage)
        }

        val user = envelope.data ?: return emptyDataMessage?.let(AuthResult::Failed)
            ?: AuthResult.Unauthenticated
        return AuthResult.Authenticated(user.toUser())
    }

    private fun Response<*>.errorBodyMessage(): String? {
        val errorJson = errorBody()?.string() ?: return null
        return try {
            NetworkModule.json.decodeFromString<ApiEnvelope<Unit>>(errorJson).message.validMessage()
        } catch (_: SerializationException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun String?.validMessage(): String? = this?.takeIf { it.isNotBlank() }
}
