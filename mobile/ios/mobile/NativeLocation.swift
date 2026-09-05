import CoreLocation
import Foundation
import React

@objc(NativeLocation)
class NativeLocation: NSObject, CLLocationManagerDelegate, RCTInvalidating {
  private var locationManager: CLLocationManager?
  private var resolveBlock: RCTPromiseResolveBlock?
  private var rejectBlock: RCTPromiseRejectBlock?
  private var timeoutWorkItem: DispatchWorkItem?
  private var requestInFlight = false
  private var locationRequestStarted = false
  private var requestSequence = 0
  private var maxAgeMs = 60000
  private var timeoutMs = 8000

  @objc
  static func requiresMainQueueSetup() -> Bool { true }

  @objc(getPermissionStatus:withRejecter:)
  func getPermissionStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    withRejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { [weak self] in
      guard CLLocationManager.locationServicesEnabled() else {
        resolve("unavailable")
        return
      }
      let manager = self?.locationManager ?? CLLocationManager()
      switch manager.authorizationStatus {
      case .authorizedAlways, .authorizedWhenInUse:
        resolve(manager.accuracyAuthorization == .reducedAccuracy ? "approximate" : "precise")
      case .notDetermined:
        resolve("notDetermined")
      case .denied, .restricted:
        resolve("blocked")
      @unknown default:
        resolve("unavailable")
      }
    }
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
    guard !requestInFlight else {
      reject("LOCATION_BUSY", "定位请求进行中。", nil)
      return
    }
    guard CLLocationManager.locationServicesEnabled() else {
      reject("LOCATION_PROVIDER_DISABLED", "定位服务未开启。", nil)
      return
    }
    requestSequence += 1
    requestInFlight = true
    resolveBlock = resolve
    rejectBlock = reject
    maxAgeMs = readInt(options, key: "maxAgeMs", defaultValue: 60000, min: 0, max: 600000)
    timeoutMs = readInt(options, key: "timeoutMs", defaultValue: 8000, min: 1000, max: 30000)

    // Each request has its own manager. A queued callback from a timed-out
    // request must never complete a later request that reuses this module.
    let manager = CLLocationManager()
    locationManager = manager
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
    manager.distanceFilter = kCLDistanceFilterNone
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      startAuthorizedLocation(manager)
    case .notDetermined:
      // The user controls how long they take to answer the system prompt.
      // Start the location timeout only after authorization is granted.
      manager.requestWhenInUseAuthorization()
    case .denied, .restricted:
      finishFailure(code: "LOCATION_PERMISSION_DENIED", message: "定位权限未授予。")
    @unknown default:
      finishFailure(code: "LOCATION_INTERNAL_ERROR", message: "定位状态不可用。")
    }
  }

  private func startAuthorizedLocation(_ manager: CLLocationManager) {
    guard requestInFlight, manager === locationManager, !locationRequestStarted else { return }
    locationRequestStarted = true
    if let cached = manager.location, isFresh(cached) {
      finishSuccess(cached, provider: "last_known")
      return
    }
    startTimeout()
    manager.requestLocation()
  }

  private func isValid(_ location: CLLocation) -> Bool {
    location.horizontalAccuracy.isFinite && location.horizontalAccuracy >= 0 &&
      location.coordinate.latitude.isFinite && location.coordinate.longitude.isFinite &&
      CLLocationCoordinate2DIsValid(location.coordinate) &&
      location.timestamp.timeIntervalSince1970.isFinite
  }

  private func isFresh(_ location: CLLocation) -> Bool {
    let ageMs = -location.timestamp.timeIntervalSinceNow * 1000
    return isValid(location) && ageMs >= 0 && ageMs <= Double(maxAgeMs)
  }

  private func readInt(
    _ options: NSDictionary?, key: String, defaultValue: Int, min: Int, max: Int
  ) -> Int {
    guard let number = options?[key] as? NSNumber, number.doubleValue.isFinite else { return defaultValue }
    return Int(Swift.max(Double(min), Swift.min(Double(max), number.doubleValue)))
  }

  private func startTimeout() {
    let sequence = requestSequence
    let workItem = DispatchWorkItem { [weak self] in
      guard let self, self.requestInFlight, self.requestSequence == sequence else { return }
      self.finishFailure(code: "LOCATION_TIMEOUT", message: "定位超时，请稍后重试。")
    }
    timeoutWorkItem = workItem
    DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs), execute: workItem)
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
    let resolve = resolveBlock
    resetRequestState()
    resolve?(payload)
  }

  private func finishFailure(code: String, message: String, error: Error? = nil) {
    guard requestInFlight else { return }
    let reject = rejectBlock
    resetRequestState()
    reject?(code, message, error)
  }

  private func resetRequestState() {
    requestSequence += 1
    let manager = locationManager
    locationManager = nil
    requestInFlight = false
    locationRequestStarted = false
    timeoutWorkItem?.cancel()
    timeoutWorkItem = nil
    resolveBlock = nil
    rejectBlock = nil
    manager?.delegate = nil
    manager?.stopUpdatingLocation()
  }

  @objc
  func invalidate() {
    if Thread.isMainThread {
      resetRequestState()
    } else {
      DispatchQueue.main.async { self.resetRequestState() }
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard requestInFlight, manager === locationManager else { return }
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      startAuthorizedLocation(manager)
    case .denied, .restricted:
      finishFailure(code: "LOCATION_PERMISSION_DENIED", message: "定位权限未授予。")
    case .notDetermined:
      break
    @unknown default:
      finishFailure(code: "LOCATION_INTERNAL_ERROR", message: "定位状态不可用。")
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard requestInFlight, manager === locationManager else { return }
    guard let location = locations.last(where: { isValid($0) }) else {
      finishFailure(code: "LOCATION_UNAVAILABLE", message: "无法获取当前位置。")
      return
    }
    finishSuccess(location, provider: "core_location")
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    guard requestInFlight, manager === locationManager else { return }
    if let clError = error as? CLError, clError.code == .locationUnknown { return }
    if let clError = error as? CLError, clError.code == .denied {
      let servicesEnabled = CLLocationManager.locationServicesEnabled()
      finishFailure(
        code: servicesEnabled ? "LOCATION_PERMISSION_DENIED" : "LOCATION_PROVIDER_DISABLED",
        message: servicesEnabled ? "定位权限未授予。" : "定位服务未开启。",
        error: error
      )
      return
    }
    finishFailure(code: "LOCATION_UNAVAILABLE", message: "无法获取当前位置。", error: error)
  }
}
