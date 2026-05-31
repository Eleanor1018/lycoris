package online.lycoris.android.feature.map

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.drawable.BitmapDrawable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.config.Configuration
import org.osmdroid.events.MapListener
import org.osmdroid.events.ScrollEvent
import org.osmdroid.events.ZoomEvent
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker as OsmMarker

@Composable
fun OsmMapView(
    markers: List<Marker>,
    onMarkerClick: (Long) -> Unit,
    onMapCenterChanged: (MapCenter) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val markerIconCache = remember { mutableMapOf<MarkerPin, BitmapDrawable>() }

    AndroidView(
        modifier = modifier,
        factory = {
            Configuration.getInstance().userAgentValue = context.packageName
            MapView(context).apply {
                setTileSource(TileSourceFactory.MAPNIK)
                setMultiTouchControls(true)
                controller.setZoom(11.0)
                controller.setCenter(GeoPoint(39.9042, 116.4074))
                emitCenter(onMapCenterChanged)
                addMapListener(
                    object : MapListener {
                        override fun onScroll(event: ScrollEvent?): Boolean {
                            emitCenter(onMapCenterChanged)
                            return false
                        }

                        override fun onZoom(event: ZoomEvent?): Boolean {
                            emitCenter(onMapCenterChanged)
                            return false
                        }
                    },
                )
                onResume()
            }
        },
        update = { mapView ->
            mapView.overlays.removeAll { it is OsmMarker }
            markers.forEach { marker ->
                val pin = MarkerPin.from(marker)
                mapView.overlays.add(
                    OsmMarker(mapView).apply {
                        position = GeoPoint(marker.lat, marker.lng)
                        title = marker.title
                        snippet = marker.description
                        icon = markerIconCache.getOrPut(pin) {
                            createMarkerIcon(context.resources, pin.color)
                        }
                        setAnchor(OsmMarker.ANCHOR_CENTER, OsmMarker.ANCHOR_BOTTOM)
                        setOnMarkerClickListener { _, _ ->
                            onMarkerClick(marker.id)
                            true
                        }
                    },
                )
            }
            mapView.invalidate()
        },
        onRelease = { mapView ->
            mapView.onPause()
            mapView.onDetach()
        },
    )
}

private fun MapView.emitCenter(onMapCenterChanged: (MapCenter) -> Unit) {
    val center = mapCenter
    onMapCenterChanged(
        MapCenter(
            lat = center.latitude,
            lng = center.longitude,
        ),
    )
}

private fun createMarkerIcon(
    resources: android.content.res.Resources,
    color: Int,
): BitmapDrawable {
    val size = 48
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color
    }
    canvas.drawCircle(size / 2f, size / 2f, size * 0.34f, paint)
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 4f
    paint.color = 0xFFFFFFFF.toInt()
    canvas.drawCircle(size / 2f, size / 2f, size * 0.34f, paint)
    return BitmapDrawable(resources, bitmap)
}
