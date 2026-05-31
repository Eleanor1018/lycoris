package online.lycoris.android.core.network

class ApiConfig(baseUrl: String) {
    private val normalizedBaseUrl = baseUrl.trim().trimEnd('/')

    fun url(path: String): String {
        val normalizedPath = if (path.startsWith("/")) path else "/$path"
        return "$normalizedBaseUrl$normalizedPath"
    }

    fun assetUrl(value: String?): String? {
        if (value.isNullOrBlank()) return null

        val trimmed = value.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed
        }

        return url(trimmed)
    }
}
