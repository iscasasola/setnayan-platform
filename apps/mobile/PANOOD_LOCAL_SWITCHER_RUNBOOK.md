# Panood Local Switcher — Native Build Runbook (P1)

The "upgraded" Panood is **Setnayan as the on-device vision mixer**: phone cameras
→ a director iPad over local WiFi → composite/switch **on the device** → push one
RTMP feed to the couple's YouTube broadcast → embeds on the event page. **₱0 cloud**
(the mixing runs on the iPad; YouTube distributes free).

This runbook covers **Phase 1** — the riskiest piece proven end-to-end with the
fewest moving parts: **one camera (the director device's own camera) → encode →
RTMP → a real YouTube broadcast → event-page embed.** No WebRTC, no multi-camera,
no compositing yet — those are P2/P3.

> Why this can't be a normal web PR: the RTMP push and live camera encode **cannot
> run inside the Capacitor WebView** (getUserMedia/MediaRecorder/WebCodecs are
> unreliable or absent in WKWebView, and there's no RTMP in a browser). So the
> streaming hot path is a **native Capacitor plugin**, built in Xcode / Android
> Studio and tested on real devices. The web layer is the control plane only.

---

## The split (the whole architecture in one table)

| Layer | Where | Job |
|---|---|---|
| **Web control plane** (SHIPPED) | `apps/web`, runs in the WebView | Director UI, YouTube broadcast lifecycle, sends JSON commands. **No pixels.** |
| **Native plugin** (TO BUILD) | `apps/mobile` iOS + Android | Capture → (P2: composite) → H.264/AAC encode → RTMP push. **The hot path.** |

The web↔native boundary is **small JSON only** (`start`, `stop`, later `cut to
camera 2`). Video frames never cross the bridge.

---

## What's already shipped (reuse — do NOT rebuild)

- **YouTube broadcast lifecycle** — `apps/web/lib/panood-youtube.ts` +
  `lib/panood-broadcast.ts`: create the liveBroadcast + liveStream on the couple's
  channel, bind, transition, return the **RTMP ingestion URL + stream key**.
- **Server actions** — `apps/web/app/dashboard/[eventId]/add-ons/panood/setup/actions.ts`:
  - `createBroadcast(eventId)` → `{ ingestionUrl, streamKey, watchUrl, broadcastId }`
  - `goLiveBroadcast(eventId)` → writes `events.panood_watch_url` (lights up the embed)
  - `endBroadcast(eventId)` → transitions complete + clears the embed
- **`panood_broadcasts` table** (applied to prod) — stores the broadcast + secret
  stream key (service-role only).
- **Event-page embed** — `app/[slug]` already renders `panood_watch_url` during the
  live window. **Zero changes downstream of RTMP.**
- **Papic seat-claim QR** (`lib/papic-seats.ts`) — reuse for camera-operator
  onboarding in **P2**.

The native plugin's only job in P1 is: take the `streamKey` + `ingestionUrl` from
`createBroadcast` and push the device camera to it.

---

## Prerequisites (owner / native dev)

1. **macOS + Xcode** (iOS) and **Android Studio** (Android).
2. A **physical iPad** (iOS 17+) and an **Android phone** for the device tests.
3. The web app must add **`@capacitor/core`** as a dependency of `apps/web` (it
   isn't yet) so the WebView can call the plugin: `pnpm --filter web add @capacitor/core`.
4. A **YouTube channel connected** to the test event (the OAuth flow). The channel
   must be **live-streaming-enabled** — phone-verified, with a **~24h activation
   lead** on a fresh channel. (OAuth verification is still pending; for testing,
   add the tester as an OAuth test user so the consent screen lets them through.)

---

## Step 1 — the plugin TypeScript contract (web side)

Create `apps/web/lib/native/panood-broadcaster.ts`:

```ts
import { registerPlugin } from '@capacitor/core';

export interface PanoodBroadcasterPlugin {
  /** Start capturing the device camera + push RTMP to the YouTube stream key. */
  start(opts: { ingestionUrl: string; streamKey: string; resolution?: '720p' | '1080p' }): Promise<void>;
  /** Stop streaming + release the camera. */
  stop(): Promise<void>;
  /** Current state for the director UI. */
  status(): Promise<{ state: 'idle' | 'connecting' | 'live' | 'error'; error?: string }>;
}

// Falls back to a no-op-throwing web impl outside the native app.
export const PanoodBroadcaster = registerPlugin<PanoodBroadcasterPlugin>('PanoodBroadcaster');
```

The director page then does:

```ts
const res = await createBroadcast(eventId);          // server action (shipped)
if (!res.ok) { /* surface res.error (e.g. channel_not_live_enabled) */ }
await PanoodBroadcaster.start({ ingestionUrl: res.ingestionUrl, streamKey: res.streamKey });
// once the device reports state==='live' (auto-start fires when RTMP connects):
await goLiveBroadcast(eventId);                       // writes panood_watch_url → embed lights up
// End:
await PanoodBroadcaster.stop();
await endBroadcast(eventId);
```

(Gate this page on the native platform via `Capacitor.isNativePlatform()` — show
"open the Setnayan app to broadcast" in a plain browser.)

---

## Step 2 — iOS plugin (Swift + HaishinKit)

Library: **HaishinKit.swift** (`https://github.com/HaishinKit/HaishinKit.swift`,
Swift 6 / iOS 15+). Add via SPM in the Capacitor iOS project.

`PanoodBroadcasterPlugin.swift` (Capacitor `CAPPlugin`):

```swift
import Capacitor
import HaishinKit
import AVFoundation

@objc(PanoodBroadcasterPlugin)
public class PanoodBroadcasterPlugin: CAPPlugin {
  private let mixer = MediaMixer()         // camera + mic → one stream
  private var connection: RTMPConnection?
  private var stream: RTMPStream?

  @objc func start(_ call: CAPPluginCall) {
    guard let ingestion = call.getString("ingestionUrl"),
          let key = call.getString("streamKey") else { return call.reject("missing rtmp target") }
    Task {
      // P1: attach the device's own camera + mic (P2 swaps this for the
      // WebRTC-ingested + composited program feed).
      try? await mixer.attachVideo(AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back))
      try? await mixer.attachAudio(AVCaptureDevice.default(for: .audio))
      let conn = RTMPConnection()
      let stream = RTMPStream(connection: conn)
      await mixer.addOutput(stream)
      self.connection = conn; self.stream = stream
      _ = try? await conn.connect(ingestion)          // rtmp://a.rtmp.youtube.com/live2
      _ = try? await stream.publish(key)              // the stream key
      call.resolve()
    }
  }

  @objc func stop(_ call: CAPPluginCall) {
    Task { try? await stream?.close(); try? await connection?.close(); call.resolve() }
  }
}
```

Register the plugin in the bridge (Capacitor 6 auto-discovers `@objc(...)CAPPlugin`
subclasses; confirm it's in the plugin list).

**Key gotchas:** background-audio + camera entitlements in `Info.plist`
(`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`); keep the device
**plugged in** (sustained encode is heat-bound); default **720p**.

---

## Step 3 — Android plugin (Kotlin + RootEncoder)

Library: **RootEncoder / rtmp-rtsp-stream-client-java** (pedroSG94). Add the
Gradle dep in the Capacitor Android project.

`PanoodBroadcasterPlugin.kt` mirrors the iOS one: a `RtmpCamera2` (or
`GenericStream`) instance, `prepareVideo()/prepareAudio()`, `startStream(ingestion +
"/" + key)`, `stopStream()`. Camera + `INTERNET` permissions in the manifest.

(Android is a **camera-capable director only in a pinch** — per the design, the
real director device is an iPad; Android phones are primarily cameras. P1 can still
prove the Android push path.)

---

## Step 4 — build + test (the loop I can't run for you)

1. `pnpm --filter web build` → `npx cap sync` (copies web + the plugin into the
   native projects).
2. **iOS:** `npx cap open ios` → set signing → run on the iPad.
   **Android:** `npx cap open android` → run on the phone.
3. In the app: open an event with a **connected, live-enabled YouTube channel** →
   the Panood setup page → **Create broadcast** → **Start** → point the camera at
   something.
4. **Verify P1 passes:** within ~3–15s the **couple's event page** (`/[slug]`, in
   the live window) shows the **YouTube embed playing your camera feed.** Then
   **End** → the embed retires.

When that round-trips, P1 is proven and the riskiest unknown (native RTMP from a
Capacitor app, end-to-end into the shipped YouTube + embed pipeline) is closed.

---

## After P1 (not in scope here)

- **P2** — multi-camera: phone cameras publish over **WebRTC (local ICE, media on
  the LAN; cloud signaling)**; the native plugin ingests the tracks; the web
  director (preview grid + take) sends `cut to camera N` over the bridge; the
  plugin composites the selected program. Operators onboard via the Papic seat QR.
- **P3** — overlays: monogram bug + lower-thirds + PiP in the native compositor.
- **P4** — `restartIce()` internet fallback, reconnection / never-black standby,
  device guardrails, the bundled dedicated 5GHz router.

## Device + network requirements (lock for the kit)

- **Director:** iPad (Pro/Air M2+, iPad 7th-gen+, mini 5th+) or a 2020+ Apple-Silicon
  Mac. A recent iPhone works in a pinch; **Android = cameras only**.
- **Cameras:** modern iOS/Android phones, **on AC power** (sustained capture
  overheats on battery), 720p default.
- **Network:** a **dedicated 5GHz router** at the venue (ship it in the Panood kit)
  — venue WiFi is the #1 failure mode. ≥3 Mbps up for the single YouTube output.
