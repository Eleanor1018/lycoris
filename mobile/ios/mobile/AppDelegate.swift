import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import CoreLocation

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "mobile",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

@objc(NativeLocation)
class NativeLocation: NSObject, CLLocationManagerDelegate {
  private var locationManager: CLLocationManager?
  private var resolveBlock: RCTPromiseResolveBlock?
  private var rejectBlock: RCTPromiseRejectBlock?
  private var timeoutWorkItem: DispatchWorkItem?
  private var requestInFlight = false
  private var maxAgeMs = 60000

  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(getCurrentPosition:withResolver:withRejecter:)
  func getCurrentPosition(
    _ options: NSDictionary?,
    withResolver resolve: @escaping RCTPromiseResolveBlock,
    withRejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { [weak self] in
      self?.startRequest(options: options, resolve: resolve, reject: reject)
    }
  }

  private func startRequest(
    options: NSDictionary?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    if requestInFlight {
      reject("LOCATION_BUSY", "定位请求进行中。", nil)
      return
    }

    guard CLLocationManager.locationServicesEnabled() else {
      reject("LOCATION_PROVIDER_DISABLED", "定位服务未开启。", nil)
      return
    }

    resolveBlock = resolve
    rejectBlock = reject
    requestInFlight = true
    maxAgeMs = readInt(
      options: options,
      key: "maxAgeMs",
      defaultValue: 60000,
      min: 0,
      max: 600000
    )
    let timeoutMs = readInt(
      options: options,
      key: "timeoutMs",
      defaultValue: 8000,
      min: 1000,
      max: 30000
    )

    ensureLocationManager()
    guard let manager = locationManager else {
      finishFailure(
        code: "LOCATION_INTERNAL_ERROR",
        message: "原生定位初始化失败。",
        error: nil
      )
      return
    }

    let status = currentAuthorizationStatus(manager)
    switch status {
    case .authorizedAlways, .authorizedWhenInUse:
      if let lastKnown = manager.location, isFresh(lastKnown) {
        finishSuccess(lastKnown, provider: "last_known")
        return
      }
      startTimeout(timeoutMs)
      manager.requestLocation()
    case .notDetermined:
      startTimeout(timeoutMs)
      manager.requestWhenInUseAuthorization()
    case .denied, .restricted:
      finishFailure(
        code: "LOCATION_PERMISSION_DENIED",
        message: "定位权限未授予。",
        error: nil
      )
    @unknown default:
      finishFailure(
        code: "LOCATION_INTERNAL_ERROR",
        message: "定位状态不可用。",
        error: nil
      )
    }
  }

  private func ensureLocationManager() {
    if locationManager != nil {
      return
    }
    let manager = CLLocationManager()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
    manager.distanceFilter = kCLDistanceFilterNone
    locationManager = manager
  }

  private func currentAuthorizationStatus(_ manager: CLLocationManager) -> CLAuthorizationStatus {
    if #available(iOS 14.0, *) {
      return manager.authorizationStatus
    }
    return CLLocationManager.authorizationStatus()
  }

  private func isFresh(_ location: CLLocation) -> Bool {
    let ageMs = abs(location.timestamp.timeIntervalSinceNow * 1000)
    return ageMs <= Double(maxAgeMs)
  }

  private func readInt(
    options: NSDictionary?,
    key: String,
    defaultValue: Int,
    min: Int,
    max: Int
  ) -> Int {
    guard let options else { return defaultValue }
    guard let number = options[key] as? NSNumber else { return defaultValue }
    let value = number.intValue
    return Swift.max(min, Swift.min(max, value))
  }

  private func startTimeout(_ timeoutMs: Int) {
    timeoutWorkItem?.cancel()
    let workItem = DispatchWorkItem { [weak self] in
      self?.finishFailure(
        code: "LOCATION_TIMEOUT",
        message: "定位超时，请稍后重试。",
        error: nil
      )
    }
    timeoutWorkItem = workItem
    DispatchQueue.main.asyncAfter(
      deadline: .now() + .milliseconds(timeoutMs),
      execute: workItem
    )
  }

  private func finishSuccess(_ location: CLLocation, provider: String) {
    guard requestInFlight else { return }
    let payload: [String: Any] = [
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
      "provider": provider,
    ]
    resolveBlock?(payload)
    resetRequestState()
  }

  private func finishFailure(code: String, message: String, error: Error?) {
    guard requestInFlight else { return }
    rejectBlock?(code, message, error)
    resetRequestState()
  }

  private func resetRequestState() {
    timeoutWorkItem?.cancel()
    timeoutWorkItem = nil
    resolveBlock = nil
    rejectBlock = nil
    requestInFlight = false
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard requestInFlight else { return }
    handleAuthorizationChange(currentAuthorizationStatus(manager), manager: manager)
  }

  func locationManager(
    _ manager: CLLocationManager,
    didChangeAuthorization status: CLAuthorizationStatus
  ) {
    guard requestInFlight else { return }
    handleAuthorizationChange(status, manager: manager)
  }

  private func handleAuthorizationChange(
    _ status: CLAuthorizationStatus,
    manager: CLLocationManager
  ) {
    switch status {
    case .authorizedAlways, .authorizedWhenInUse:
      if let lastKnown = manager.location, isFresh(lastKnown) {
        finishSuccess(lastKnown, provider: "last_known")
        return
      }
      manager.requestLocation()
    case .denied, .restricted:
      finishFailure(
        code: "LOCATION_PERMISSION_DENIED",
        message: "定位权限未授予。",
        error: nil
      )
    case .notDetermined:
      break
    @unknown default:
      finishFailure(
        code: "LOCATION_INTERNAL_ERROR",
        message: "定位状态不可用。",
        error: nil
      )
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard requestInFlight else { return }
    guard let location = locations.last(where: { $0.horizontalAccuracy >= 0 }) ?? locations.last else {
      finishFailure(code: "LOCATION_UNAVAILABLE", message: "无法获取当前位置。", error: nil)
      return
    }
    finishSuccess(location, provider: "core_location")
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    guard requestInFlight else { return }
    if let clError = error as? CLError, clError.code == .locationUnknown {
      return
    }
    if let clError = error as? CLError, clError.code == .denied {
      finishFailure(
        code: "LOCATION_PERMISSION_DENIED",
        message: "定位权限未授予。",
        error: error
      )
      return
    }
    finishFailure(code: "LOCATION_UNAVAILABLE", message: "无法获取当前位置。", error: error)
  }
}
