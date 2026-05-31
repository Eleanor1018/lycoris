package online.lycoris.android.core.config

import online.lycoris.android.BuildConfig

class BuildConstants(
    rawApiBaseUrl: String = BuildConfig.LY_API_BASE_URL,
) {
    val apiBaseUrl: String = rawApiBaseUrl
        .trim()
        .trimEnd('/')
        .ifBlank { DEFAULT_PROD_API_BASE_URL }
        .plus("/")

    val isCustomApiBaseUrl: Boolean = rawApiBaseUrl.trim().isNotBlank()

    companion object {
        const val DEFAULT_PROD_API_BASE_URL = "https://api.lycoris.online"
    }
}
