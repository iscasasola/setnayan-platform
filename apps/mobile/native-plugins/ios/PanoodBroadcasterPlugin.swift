import Foundation
import AVFoundation
import Capacitor
import HaishinKit

//
// Panood on-device broadcaster — iOS native plugin (Capacitor 8).
//
// P1: capture the device's OWN camera + mic, H.264/AAC encode, and push RTMP to
// the YouTube ingestion URL + stream key handed over by the `createBroadcast`
// server action. Setnayan never sends video to a server — this pushes straight
// to the couple's YouTube broadcast, which embeds on the event page.
//
// PLACEMENT: add this file to the Capacitor iOS App target in Xcode
// (App/App/PanoodBroadcasterPlugin.swift) and register it in the bridge — see
// apps/mobile/PANOOD_LOCAL_SWITCHER_RUNBOOK.md. Add HaishinKit via Swift Package
// Manager: https://github.com/HaishinKit/HaishinKit.swift (Swift 6 / iOS 15+).
// Info.plist needs NSCameraUsageDescription + NSMicrophoneUsageDescription, and
// Background Modes → Audio for sustained capture when backgrounded.
//
// NOTE: HaishinKit 2.x moved to an async MediaMixer API; if your installed
// version differs (1.x uses stream.attachCamera/attachAudio directly), adjust
// the attach calls — the lifecycle (connect → publish → close) is the same.
//

@objc(PanoodBroadcasterPlugin)
public class PanoodBroadcasterPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PanoodBroadcasterPlugin"
    public let jsName = "PanoodBroadcaster"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "switchCamera", returnType: CAPPluginReturnPromise),
    ]

    private let mixer = MediaMixer()
    private var connection: RTMPConnection?
    private var stream: RTMPStream?
    private var state: String = "idle"
    private var lastError: String?
    private var cameraPosition: AVCaptureDevice.Position = .back

    @objc func start(_ call: CAPPluginCall) {
        guard let ingestionUrl = call.getString("ingestionUrl"),
              let streamKey = call.getString("streamKey") else {
            call.reject("ingestionUrl and streamKey are required")
            return
        }
        let resolution = call.getString("resolution") ?? "720p"
        cameraPosition = (call.getString("facing") == "front") ? .front : .back
        state = "connecting"
        lastError = nil

        Task {
            do {
                // Audio session for live capture while keeping the screen on.
                let session = AVAudioSession.sharedInstance()
                try? session.setCategory(.playAndRecord, mode: .videoRecording, options: [.defaultToSpeaker, .allowBluetooth])
                try? session.setActive(true)

                // Video config — 720p default (lighter/cooler), 1080p as a step-up.
                var videoSettings = VideoCodecSettings()
                videoSettings.videoSize = (resolution == "1080p")
                    ? CGSize(width: 1920, height: 1080)
                    : CGSize(width: 1280, height: 720)
                videoSettings.bitRate = (resolution == "1080p") ? 4_500_000 : 2_500_000
                await stream?.setVideoSettings(videoSettings)

                // Attach the device camera + mic to the mixer.
                let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: cameraPosition)
                try await mixer.attachVideo(camera)
                try await mixer.attachAudio(AVCaptureDevice.default(for: .audio))

                let conn = RTMPConnection()
                let stream = RTMPStream(connection: conn)
                await mixer.addOutput(stream)
                self.connection = conn
                self.stream = stream

                // rtmp://a.rtmp.youtube.com/live2  +  the stream key
                _ = try await conn.connect(ingestionUrl)
                _ = try await stream.publish(streamKey)

                self.state = "live"
                call.resolve()
            } catch {
                self.state = "error"
                self.lastError = error.localizedDescription
                call.reject("start failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        Task {
            try? await stream?.close()
            try? await connection?.close()
            await mixer.stopRunning()
            self.stream = nil
            self.connection = nil
            self.state = "idle"
            call.resolve()
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        var result: [String: Any] = ["state": state]
        if let lastError { result["error"] = lastError }
        call.resolve(result)
    }

    @objc func switchCamera(_ call: CAPPluginCall) {
        cameraPosition = (cameraPosition == .back) ? .front : .back
        Task {
            let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: cameraPosition)
            try? await mixer.attachVideo(camera)
            call.resolve()
        }
    }
}
