package com.setnayan.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.pedro.common.ConnectChecker
import com.pedro.library.generic.GenericStream
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.video.Camera2Source

//
// Panood on-device broadcaster — Android native plugin (Capacitor 8).
//
// P1: capture this device's camera + mic, H.264/AAC encode (MediaCodec HW), and
// push RTMP to the YouTube ingestion URL + stream key from `createBroadcast`.
// Mirrors the iOS HaishinKit plugin. On Android the design role is "camera in a
// pinch" — the real director device is an iPad — but this proves the push path.
//
// PLACEMENT: this file is already in the app package (com.setnayan.app). Register
// it in MainActivity.onCreate: `registerPlugin(PanoodBroadcasterPlugin::class.java)`.
// Gradle (app/build.gradle): implementation "com.github.pedroSG94:RootEncoder:2.5.7"
// (+ jitpack in settings repositories). Manifest: <uses-permission CAMERA/
// RECORD_AUDIO/INTERNET>.
//
// NOTE: GenericStream with Camera2Source runs HEADLESS (no preview SurfaceView
// needed) — good for a Capacitor plugin. If your RootEncoder version's API
// differs, the lifecycle (prepare → start(url) → stop) is the same; adjust the
// source-attach calls in Android Studio.
//

@CapacitorPlugin(name = "PanoodBroadcaster")
class PanoodBroadcasterPlugin : Plugin(), ConnectChecker {

    private var stream: GenericStream? = null
    private var state: String = "idle"
    private var lastError: String? = null
    private var pendingStart: PluginCall? = null

    private fun ensureStream(): GenericStream {
        val existing = stream
        if (existing != null) return existing
        val s = GenericStream(context, this, Camera2Source(context), MicrophoneSource())
        stream = s
        return s
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val ingestionUrl = call.getString("ingestionUrl")
        val streamKey = call.getString("streamKey")
        if (ingestionUrl.isNullOrBlank() || streamKey.isNullOrBlank()) {
            call.reject("ingestionUrl and streamKey are required")
            return
        }
        val resolution = call.getString("resolution") ?: "720p"
        val width = if (resolution == "1080p") 1920 else 1280
        val height = if (resolution == "1080p") 1080 else 720
        val bitrate = if (resolution == "1080p") 4_500_000 else 2_500_000

        state = "connecting"
        lastError = null
        pendingStart = call
        try {
            val s = ensureStream()
            val ready = s.prepareVideo(width, height, bitrate) && s.prepareAudio(44100, true, 128_000)
            if (!ready) {
                state = "error"
                pendingStart = null
                call.reject("encoder prepare failed")
                return
            }
            // RTMP url = "rtmp://a.rtmp.youtube.com/live2" + "/" + streamKey
            val url = ingestionUrl.trimEnd('/') + "/" + streamKey
            s.startStream(url)
            // resolved in onConnectionSuccess / rejected in onConnectionFailed
        } catch (e: Exception) {
            state = "error"
            lastError = e.message
            pendingStart = null
            call.reject("start failed: ${e.message}")
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        try {
            stream?.let {
                if (it.isStreaming) it.stopStream()
            }
        } catch (_: Exception) {
        } finally {
            state = "idle"
            call.resolve()
        }
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val result = JSObject()
        result.put("state", state)
        lastError?.let { result.put("error", it) }
        call.resolve(result)
    }

    @PluginMethod
    fun switchCamera(call: PluginCall) {
        try {
            (stream?.videoSource as? Camera2Source)?.switchCamera()
        } catch (_: Exception) {
        }
        call.resolve()
    }

    // --- ConnectChecker callbacks ---
    override fun onConnectionSuccess() {
        state = "live"
        pendingStart?.resolve()
        pendingStart = null
    }

    override fun onConnectionFailed(reason: String) {
        state = "error"
        lastError = reason
        pendingStart?.reject("connection failed: $reason")
        pendingStart = null
    }

    override fun onConnectionStarted(url: String) {}
    override fun onDisconnect() { state = "idle" }
    override fun onAuthError() { lastError = "auth error" }
    override fun onAuthSuccess() {}
    override fun onNewBitrate(bitrate: Long) {}
}
