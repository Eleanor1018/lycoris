package online.lycoris.android.app

import android.content.Context
import online.lycoris.android.core.config.BuildConstants
import online.lycoris.android.core.network.NetworkModule
import online.lycoris.android.core.session.PersistentCookieJar
import online.lycoris.android.core.session.SharedPreferencesSessionStore
import online.lycoris.android.feature.auth.AuthRepository
import online.lycoris.android.feature.documents.DocumentRepository
import online.lycoris.android.feature.map.MarkerRepository
import online.lycoris.android.feature.profile.ProfileRepository
import online.lycoris.android.feature.search.SearchRepository

class LycorisAppContainer(
    context: Context,
) {
    val constants = BuildConstants()
    val sessionStore = SharedPreferencesSessionStore(context)
    val cookieJar = PersistentCookieJar(sessionStore)
    val okHttp = NetworkModule.okHttp(cookieJar)
    val api = NetworkModule.api(constants.apiBaseUrl, okHttp)
    val authRepository = AuthRepository(api)
    val markerRepository = MarkerRepository(api)
    val documentRepository = DocumentRepository()
    val searchRepository = SearchRepository(api, documentRepository)
    val profileRepository = ProfileRepository(markerRepository)
}
