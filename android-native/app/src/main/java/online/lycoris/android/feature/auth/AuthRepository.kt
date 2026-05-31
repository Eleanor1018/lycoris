package online.lycoris.android.feature.auth

import online.lycoris.android.core.network.LycorisApi

class AuthRepository(
    private val api: LycorisApi,
) {
    suspend fun login(username: String, password: String): AuthResult {
        val response = api.login(LoginRequest(username, password))
        if (!response.isSuccessful) {
            return AuthResult.Failed("登录失败")
        }

        val user = response.body()?.data ?: return AuthResult.Failed("登录响应为空")
        return AuthResult.Authenticated(user.toUser())
    }

    suspend fun register(request: RegisterRequest): AuthResult {
        val response = api.register(request)
        if (!response.isSuccessful) {
            return AuthResult.Failed("注册失败")
        }

        val user = response.body()?.data ?: return AuthResult.Failed("注册响应为空")
        return AuthResult.Authenticated(user.toUser())
    }

    suspend fun refreshMe(): AuthResult {
        val response = api.me()
        if (response.code() == 401) {
            return AuthResult.Unauthenticated
        }
        if (!response.isSuccessful) {
            return AuthResult.Failed("获取登录状态失败")
        }

        val user = response.body()?.data ?: return AuthResult.Unauthenticated
        return AuthResult.Authenticated(user.toUser())
    }

    suspend fun logout() {
        api.logout()
    }
}
