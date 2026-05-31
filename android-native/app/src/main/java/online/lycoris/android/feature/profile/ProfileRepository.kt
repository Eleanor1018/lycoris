package online.lycoris.android.feature.profile

import online.lycoris.android.feature.map.Marker
import online.lycoris.android.feature.map.MarkerRepository

open class ProfileRepository(
    private val markerRepository: MarkerRepository,
) {
    open suspend fun createdMarkers(): List<Marker> = markerRepository.myCreated()

    open suspend fun favoriteMarkers(): List<Marker> = markerRepository.myFavorites()
}
