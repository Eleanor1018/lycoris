package online.lycoris.android.feature.auth

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
)

@Serializable
data class RegisterRequest(
    val username: String,
    val nickname: String,
    val email: String,
    val password: String,
    val website: String = "",
)

@Serializable
data class UserDto(
    val publicId: String,
    val username: String,
    val nickname: String,
    val email: String,
    val avatarUrl: String? = null,
    val role: String? = null,
)

data class User(
    val publicId: String,
    val username: String,
    val nickname: String,
    val email: String,
    val avatarUrl: String? = null,
    val role: String? = null,
)

fun UserDto.toUser(): User = User(
    publicId = publicId,
    username = username,
    nickname = nickname,
    email = email,
    avatarUrl = avatarUrl,
    role = role,
)

sealed interface AuthResult {
    data class Authenticated(val user: User) : AuthResult
    data object Unauthenticated : AuthResult
    data class Failed(val message: String) : AuthResult
}
