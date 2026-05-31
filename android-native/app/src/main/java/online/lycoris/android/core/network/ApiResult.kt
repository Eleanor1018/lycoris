package online.lycoris.android.core.network

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>
    data class Failure(val status: Int?, val message: String) : ApiResult<Nothing>
}
