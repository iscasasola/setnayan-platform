# Setnayan native shell (`@setnayan/mobile`)

Thin **Capacitor remote-URL** wrapper that ships the Setnayan web app to iOS and
Android. The native WebView loads the **live hosted app** (`www.setnayan.com`)
and bridges native hardware (Camera / Network / Bluetooth LE) to the web JS via
Capacitor plugins.

## Why remote-URL, not static export

The original setup recipe said `output: 'export'` + `webDir: 'out'`. **That
breaks this app.** `apps/web` is a server-rendered Next.js app
(`output: 'standalone'`) with **111 Server Actions, 60 API routes, and
middleware-based Supabase auth** — none of which survive a static export. A
remote-URL shell keeps the single Next.js codebase 100% intact: the shell just
points a native WebView at the hosted site. This matches the locked architecture
("true-native Papic + **Capacitor shell for the rest**").

`www/` is a **local offline fallback page only** — not the app.

## Prerequisites (one-time, on your Mac)

Not installed in the build environment — install before `cap add`:

| Tool | iOS | Android | Install |
|---|---|---|---|
| Xcode + Command Line Tools | ✅ | — | App Store, then `xcode-select --install` |
| CocoaPods | ✅ | — | `sudo gem install cocoapods` (or `brew install cocoapods`) |
| Android Studio + SDK | — | ✅ | https://developer.android.com/studio |
| `ANDROID_HOME` env var | — | ✅ | export to the SDK path in your shell profile |

## Setup (from this folder)

```bash
cd apps/mobile
npm install              # pulls @capacitor/* into ./node_modules

# Generate native projects (needs the tooling above):
npm run add:ios          # cap add ios       (requires CocoaPods)
npm run add:android      # cap add android   (requires Android SDK)

# Open the IDEs:
npm run open:ios         # Xcode  → pick a simulator → Run
npm run open:android     # Android Studio → pick an emulator → Run
```

The app boots straight into `https://www.setnayan.com`.

## Pointing at a local dev server

`server.url` is env-overridable via `CAP_SERVER_URL`:

```bash
# run apps/web first:  (cd ../web && npm run dev)   # http://localhost:3000
npm run dev:ios          # CAP_SERVER_URL=http://localhost:3000
npm run dev:android      # CAP_SERVER_URL=http://10.0.2.2:3000  (emulator → host)
```

`cleartext` auto-enables when `CAP_SERVER_URL` is `http://`.

## Native bridge — next integration step (on the web side)

For the hosted app to actually *call* Camera/BLE/Network, `apps/web` needs to
import `@capacitor/core` and feature-detect the native runtime, e.g.:

```ts
import { Capacitor } from '@capacitor/core';
if (Capacitor.isNativePlatform()) { /* use @capacitor/camera ... */ }
```

That's a separate change in `apps/web` (Papic capture path first, per iteration
0052). The shell here is hardware-ready but the web app doesn't invoke plugins
yet.

## Offline fallback (follow-up)

`www/index.html` exists but isn't yet wired as the WebView error page. To show
it when the device is offline:
- **iOS:** handle `webView(_:didFailProvisionalNavigation:withError:)` in the
  generated `ios/App` and load the bundled `www/index.html`.
- **Android:** override `WebViewClient.onReceivedError` in `android/app`.

## Store-review note

Pure web-wrappers risk Apple Guideline 4.2 / Google "minimum functionality"
rejections. The native Camera + BLE bridges (Papic capture, DSLR pairing) are
what justify a native binary — land at least one native-plugin flow before
submitting to the stores.
