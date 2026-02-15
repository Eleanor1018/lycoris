package com.mobile

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

@Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
class RuntimeConfigPackage : ReactPackage {
  override fun createNativeModules(
      reactContext: ReactApplicationContext
  ): MutableList<NativeModule> =
      mutableListOf(
          RuntimeConfigModule(reactContext),
          NativeLocationModule(reactContext),
      )

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): MutableList<ViewManager<*, *>> = mutableListOf()
}
