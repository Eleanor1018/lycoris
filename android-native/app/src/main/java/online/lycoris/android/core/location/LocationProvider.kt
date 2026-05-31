package online.lycoris.android.core.location

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager

data class LycorisLocation(
    val latitude: Double,
    val longitude: Double,
)

interface LocationProvider {
    fun lastKnownLocation(): LycorisLocation?
}

class AndroidLocationProvider(
    private val context: Context,
) : LocationProvider {
    override fun lastKnownLocation(): LycorisLocation? {
        if (!hasLocationPermission()) {
            return null
        }

        val locationManager = context.getSystemService(LocationManager::class.java)
            ?: return null

        return locationManager.getBestLastKnownLocation()?.let {
            LycorisLocation(it.latitude, it.longitude)
        }
    }

    private fun hasLocationPermission(): Boolean {
        return context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    private fun LocationManager.getBestLastKnownLocation(): Location? {
        return getProviders(true)
            .mapNotNull { provider ->
                runCatching { getLastKnownLocation(provider) }.getOrNull()
            }
            .maxByOrNull { it.time }
    }
}
