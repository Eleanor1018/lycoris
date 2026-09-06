package com.mobile

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap
import java.util.concurrent.atomic.AtomicBoolean

class NativeLocationModule(private val appContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(appContext) {

  override fun getName(): String = "NativeLocation"

  @ReactMethod
  fun getCurrentPosition(options: ReadableMap?, promise: Promise) {
    val locationManager =
        appContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: run {
              promise.reject("LOCATION_SERVICE_UNAVAILABLE", "无法访问定位服务。")
              return
            }

    if (!hasLocationPermission()) {
      promise.reject("LOCATION_PERMISSION_DENIED", "定位权限未授予。")
      return
    }

    val timeoutMs = readInt(options, "timeoutMs", 8000, 1000, 30000)
    val maxAgeMs = readInt(options, "maxAgeMs", 60000, 0, 600000)
    val provider = pickProvider(locationManager)

    if (provider == null) {
      promise.reject("LOCATION_PROVIDER_DISABLED", "定位服务未开启。")
      return
    }

    val now = System.currentTimeMillis()
    val lastKnown = bestLastKnownLocation(locationManager)
    if (lastKnown != null && now - lastKnown.time <= maxAgeMs) {
      promise.resolve(toWritableMap(lastKnown, "last_known"))
      return
    }

    requestSingleLocation(locationManager, provider, timeoutMs, promise)
  }

  private fun hasLocationPermission(): Boolean {
    val fine =
        appContext.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    val coarse =
        appContext.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    return fine || coarse
  }

  private fun readInt(
      options: ReadableMap?,
      key: String,
      defaultValue: Int,
      min: Int,
      max: Int
  ): Int {
    if (options == null || !options.hasKey(key) || options.isNull(key)) return defaultValue
    val raw =
        try {
          options.getInt(key)
        } catch (_: Throwable) {
          defaultValue
        }
    return raw.coerceIn(min, max)
  }

  private fun pickProvider(locationManager: LocationManager): String? {
    val hasFinePermission =
        appContext.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    if (hasFinePermission && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
      return LocationManager.GPS_PROVIDER
    }
    if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
      return LocationManager.NETWORK_PROVIDER
    }
    if (locationManager.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
      return LocationManager.PASSIVE_PROVIDER
    }
    return null
  }

  private fun bestLastKnownLocation(locationManager: LocationManager): Location? {
    val providers =
        listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER,
        )
    var best: Location? = null
    for (provider in providers) {
      val location =
          try {
            locationManager.getLastKnownLocation(provider)
          } catch (_: SecurityException) {
            null
          } catch (_: Throwable) {
            null
          }
      if (location != null && (best == null || location.time > best.time)) {
        best = location
      }
    }
    return best
  }

  private fun requestSingleLocation(
      locationManager: LocationManager,
      provider: String,
      timeoutMs: Int,
      promise: Promise
  ) {
    val handled = AtomicBoolean(false)
    val handler = Handler(Looper.getMainLooper())
    var cancellation: CancellationSignal? = null
    var listener: LocationListener? = null
    lateinit var timeoutRunnable: Runnable

    fun finish(deliver: () -> Unit) {
      if (!handled.compareAndSet(false, true)) return
      handler.removeCallbacks(timeoutRunnable)
      cancellation?.cancel()
      listener?.let {
        // Permission can be revoked while a location request is in flight.
        try {
          locationManager.removeUpdates(it)
        } catch (_: SecurityException) {
        }
      }
      deliver()
    }

    timeoutRunnable = Runnable {
      finish { promise.reject("LOCATION_TIMEOUT", "定位超时，请稍后重试。") }
    }

    // Start, callbacks and timeout share one looper: cleanup cannot race with
    // installing the listener or cancellation signal.
    handler.post {
      handler.postDelayed(timeoutRunnable, timeoutMs.toLong())
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          cancellation = CancellationSignal()
          locationManager.getCurrentLocation(
              provider,
              cancellation,
              appContext.mainExecutor,
          ) { location ->
            finish {
              if (location == null) {
                promise.reject("LOCATION_UNAVAILABLE", "无法获取当前位置。")
              } else {
                promise.resolve(toWritableMap(location, provider))
              }
            }
          }
        } else {
          @Suppress("DEPRECATION")
          val singleListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
              finish { promise.resolve(toWritableMap(location, provider)) }
            }

            override fun onProviderDisabled(disabledProvider: String) {
              if (disabledProvider == provider) {
                finish { promise.reject("LOCATION_PROVIDER_DISABLED", "定位服务未开启。") }
              }
            }
          }
          listener = singleListener
          @Suppress("DEPRECATION")
          locationManager.requestSingleUpdate(provider, singleListener, Looper.getMainLooper())
        }
      } catch (security: SecurityException) {
        finish { promise.reject("LOCATION_PERMISSION_DENIED", "定位权限未授予。", security) }
      } catch (error: Throwable) {
        finish { promise.reject("LOCATION_INTERNAL_ERROR", "原生定位失败。", error) }
      }
    }
  }

  private fun toWritableMap(location: Location, provider: String): WritableNativeMap {
    val map = WritableNativeMap()
    map.putDouble("latitude", location.latitude)
    map.putDouble("longitude", location.longitude)
    map.putDouble("accuracy", location.accuracy.toDouble())
    map.putDouble("timestamp", location.time.toDouble())
    map.putString("provider", provider)
    return map
  }
}
