package com.mobile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class RuntimeConfigModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "RuntimeConfig"

  override fun getConstants(): MutableMap<String, Any> {
    val constants = HashMap<String, Any>()
    constants["LY_API_BASE_URL"] = BuildConfig.LY_API_BASE_URL
    constants["LY_THUNDERFOREST_API_KEY"] = BuildConfig.LY_THUNDERFOREST_API_KEY
    constants["LY_TIANDITU_API_KEY"] = BuildConfig.LY_TIANDITU_API_KEY
    return constants
  }

  @ReactMethod
  fun getRuntimeConfig(promise: Promise) {
    val map = WritableNativeMap()
    map.putString("LY_API_BASE_URL", BuildConfig.LY_API_BASE_URL)
    map.putString("LY_THUNDERFOREST_API_KEY", BuildConfig.LY_THUNDERFOREST_API_KEY)
    map.putString("LY_TIANDITU_API_KEY", BuildConfig.LY_TIANDITU_API_KEY)
    promise.resolve(map)
  }
}
