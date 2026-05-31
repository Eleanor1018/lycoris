package online.lycoris.android.feature.profile

import online.lycoris.android.feature.map.Marker
import online.lycoris.android.feature.map.MarkerRepository

class ProfileRepository(
    private val markerRepository: MarkerRepository,
) {
    suspend fun createdMarkers(): List<Marker> = markerRepository.myCreated()

    suspend fun favoriteMarkers(): List<Marker> = markerRepository.myFavorites()
}
