import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Export the existing logo as one opaque universal AppIcon. This script runs
// with the Mac's system frameworks during pod install; no graphics dependency
// or replacement artwork is needed.
let mobileRoot = URL(fileURLWithPath: #filePath).standardizedFileURL
  .deletingLastPathComponent().deletingLastPathComponent()
let sourceURL = mobileRoot.appendingPathComponent("src/images/LycorisIcon.png")
let outputURL = mobileRoot.appendingPathComponent("ios/mobile/Images.xcassets/AppIcon.appiconset/AppIcon1024.png")

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data("error: \(message)\n".utf8))
  exit(1)
}

guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let logo = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  fail("Cannot read the existing Lycoris logo.")
}
guard let context = CGContext(
  data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 0,
  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
  fail("Cannot create the iOS icon export context.")
}
// The logo has transparency; use the existing map background for iOS's
// required opaque icon rather than changing the logo artwork.
context.setFillColor(red: 246.0 / 255, green: 242.0 / 255, blue: 251.0 / 255, alpha: 1)
context.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
context.interpolationQuality = .high
context.draw(logo, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
guard let image = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
  fail("Cannot write the iOS AppIcon.")
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else { fail("The iOS AppIcon export failed.") }
print("Prepared the iOS AppIcon from the existing Lycoris logo.")
