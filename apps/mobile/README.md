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

## npm, not pnpm

The repo root is a **pnpm workspace**, but this package is managed with **npm**
and is **excluded** from the workspace (`!apps/mobile` in `pnpm-workspace.yaml`).
Capacitor's CLI expects a flat `node_modules` for native plugin discovery, which
pnpm's symlinked store breaks. So: run `npm` here, `pnpm` everywhere else. The
root `pnpm-lock.yaml` never sees these deps.

## Build sequence (IMPORTANT — fresh clone is NOT clone-and-gradle)

The `android/` project IS committed, but Capacitor regenerates several gitignored
files on sync (`assets/public/`, `assets/capacitor.config.json`,
`res/xml/config.xml`). A bare `gradle` on a fresh checkout fails — always sync first:

```bash
cd apps/mobile
npm ci                        # or: npm install
npx cap sync android          # regenerates the gitignored Capacitor glue
cd android && ./gradlew :app:assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
```

`ios/` is NOT committed (needs macOS + Xcode + CocoaPods to generate). To create it:

```bash
npm run add:ios               # cap add ios  (requires CocoaPods + Xcode.app)
npm run open:ios              # Xcode → simulator → Run
```

## Two iPhone apps from one target: Setnayan and Supnayan

Owner, 24 Nov 2026 (DECISION_LOG "Three iOS apps: Setnayan · Supnayan · Chatnayan"). The Xcode project has ONE
target (`App`) and builds two App Store apps from it. Same Swift, same web app, same sign-in, same data.

| App | Bundle id | Scheme | Configurations | Opens |
|---|---|---|---|---|
| Setnayan | `com.setnayan.app` | `App` | Debug · Release | www.setnayan.com (everything, role jumps) |
| Supnayan | `com.setnayan.supnayan` | `Supnayan` | Debug Supnayan · Release Supnayan | supplier.setnayan.com (suppliers + coordinators) |

- **Supnayan's identity is one file:** `ios/supnayan.xcconfig` (bundle id, name, `supnayan://` scheme, icon, entitlements,
  version and build number, iPhone only). The Setnayan defaults sit on the project's Debug / Release configurations.
  Never write any of those keys inline on a Supnayan configuration: target settings beat the xcconfig.
- **What it opens and how it announces itself:** `capacitor.config.ts › plugins.SetnayanShell.supnayan`, applied by
  `ios/App/App/SetnayanShell.swift` from `SetnayanBridgeViewController.instanceDescriptor()`. Its `SetnayanBusiness`
  user-agent token turns on the web's ONE door flag (`apps/web/lib/doors.ts`), which hides every way out to the host
  side and Discover. There is no second copy of any page.
- **Run it:** `npx cap sync ios`, then in Xcode pick the **Supnayan** scheme (Archive uses Release Supnayan), or
  `npm run dev:supnayan` against a local `apps/web` (the door answers on `supplier.localhost`).
- ⚠ **The icon is a marked placeholder** (`Assets.xcassets/SupnayanIcon.appiconset`) until the Fable drawing is approved.
  Never submit with it.
- Not yet: In-App Purchase (needs Supnayan's own products) and push (`lib/apns.ts` sends to the one Setnayan topic).
  Each comes with its own build and its own user-agent token.
- Guard: `apps/web/lib/supnayan-is-the-same-app.test.ts`.

## Installed Capacitor plugins

`@capacitor/core` · `app` (back button + deep links + lifecycle) · `camera`
(Papic stills) · `network` · `status-bar` · `keyboard` · `splash-screen` ·
`@capacitor-community/bluetooth-le` (Camera Bridge / DSLR). The web-side calls
live in `apps/web` behind `Capacitor.isNativePlatform()`.

## Pointing at a local dev server

`server.url` is env-overridable via `CAP_SERVER_URL`:

```bash
# run apps/web first:  (cd ../web && pnpm dev)   # http://localhost:3000
npm run dev:ios          # CAP_SERVER_URL=http://localhost:3000
npm run dev:android      # CAP_SERVER_URL=http://10.0.2.2:3000  (emulator → host)
```

`cleartext` auto-enables when `CAP_SERVER_URL` is `http://`.

## App icons & splash

Generated from the real brand app icon (`apps/web/public/brand/setnayan-app-icon-512.png`,
staged here as `assets/logo.png`) via `@capacitor/assets`. Regenerate after
changing the art:

```bash
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#FBFBFA' --iconBackgroundColorDark '#1E2229' \
  --splashBackgroundColor '#FBFBFA' --splashBackgroundColorDark '#1E2229'
```

> **Owner TODO:** drop a **1024×1024** master into `assets/logo.png` for crisper
> output (the current source is 512×512). Add `--ios` once the iOS project exists.

## Release signing (Android — required for Play upload)

`app/build.gradle` reads signing from a **gitignored** `android/keystore.properties`
(absent → release stays unsigned and local/debug builds still work). To sign a
release `.aab`:

1. Create the upload keystore (store it OUTSIDE git):
   ```bash
   keytool -genkey -v -keystore ~/setnayan-upload.jks -keyalg RSA -keysize 2048 \
     -validity 10000 -alias setnayan
   ```
2. Create `android/keystore.properties` (gitignored):
   ```properties
   storeFile=/Users/you/setnayan-upload.jks
   storePassword=…
   keyAlias=setnayan
   keyPassword=…
   ```
3. `cd android && ./gradlew :app:bundleRelease` → signed `.aab`. Enroll in **Play
   App Signing** and register the upload key's SHA-256 in `assetlinks.json`.

## Deep links (App Links / Universal Links / `setnayan://`)

`AndroidManifest.xml` declares an **App Links** filter (verified `https://www.setnayan.com/dashboard*`)
and the **`setnayan://`** custom scheme. The custom scheme works immediately; the
verified `https` App Links only auto-open once
`/.well-known/assetlinks.json` (with the **release-key SHA-256**) is hosted on
`www.setnayan.com`. iOS Universal Links additionally need the Associated Domains
entitlement + `apple-app-site-association` (with the Apple **Team ID**). The
web-side `App.addListener('appUrlOpen', …)` handler lives in `apps/web`.

## Offline fallback

Android is wired: `MainActivity` subclasses Capacitor's `BridgeWebViewClient` and
loads `www/index.html` on a main-frame `onReceivedError`. **iOS is not yet
wired** — handle `webView(_:didFailProvisionalNavigation:withError:)` in the
generated `ios/App` once it exists. (Both compile-verified only — runtime-test on
a device.)

## Store-review note

Pure web-wrappers risk Apple Guideline 4.2 / Google "minimum functionality"
rejections. The native Camera + BLE bridges (Papic capture, DSLR pairing) are
what justify a native binary — land at least one native-plugin flow before
submitting to the stores.
