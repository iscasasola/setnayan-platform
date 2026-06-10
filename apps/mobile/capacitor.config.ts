import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Setnayan native shell — REMOTE-URL pattern.
 *
 * The Setnayan web app is a server-rendered Next.js app (`output: 'standalone'`,
 * 111 Server Actions, 60 API routes, middleware-based Supabase auth). It CANNOT
 * be statically exported, so this shell does NOT bundle the app. Instead the
 * native WebView loads the live hosted app over HTTPS and bridges native
 * hardware (Camera / Network; Camera Bridge DSLR pairing is WiFi-SDK, arriving with the true-native capture binary, not a WebView plugin) to the web JS via Capacitor
 * plugins. This keeps the single Next.js codebase 100% intact.
 *
 * `webDir` (./www) is the LOCAL FALLBACK shown when the remote URL is
 * unreachable — not the app itself.
 *
 * Switch `server.url` per environment:
 *   - production : https://www.setnayan.com   (default below)
 *   - local dev  : http://10.0.2.2:3000 (Android emulator) / http://localhost:3000 (iOS sim)
 *                  + set `cleartext: true` for plain-HTTP dev servers.
 */
const SERVER_URL = process.env.CAP_SERVER_URL ?? 'https://www.setnayan.com';

const config: CapacitorConfig = {
  appId: 'com.setnayan.app',
  appName: 'Setnayan',
  webDir: 'www',
  server: {
    url: SERVER_URL,
    // Only HTTPS in production. Flip to true (and use http://) when you point
    // SERVER_URL at a local dev server during development.
    cleartext: SERVER_URL.startsWith('http://'),
  },
  ios: {
    // Lets the WebView surface camera/mic permission prompts natively.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      // Backstop only — the web-side NativeBridge calls SplashScreen.hide() as
      // soon as the remote page paints, so the splash normally clears well
      // before this. The 2s ceiling covers slow PH mobile data / offline (where
      // the page never loads and the MainActivity fallback takes over) so the
      // splash never hangs indefinitely.
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#FBFBFA', // Warm Alabaster — Clean Editorial palette
    },
    Keyboard: {
      // Resize the WebView (not the body) when the keyboard opens, so focused
      // inputs aren't hidden behind it — the default reads as broken on first use.
      resize: 'native',
    },
  },
};

export default config;
