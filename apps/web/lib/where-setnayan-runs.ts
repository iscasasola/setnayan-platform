/**
 * WHERE SETNAYAN RUNS — the one answer to "Does Setnayan have a mobile app?".
 *
 * ── THE DEFECT THIS CURES (sweep 2026-10-19, row A3) ────────────────────────
 * /help, /about and /llms.txt each typed their own answer, and two of them told
 * an App Store reviewer — reading the FAQ INSIDE the iPhone app — that the app
 * did not exist: "Native iOS and Android shells via Expo are on the V1.5
 * roadmap" (help), "Native apps are in preparation ahead of the December 2026
 * launch" (llms). Neither was true: the shell is Capacitor, not Expo, and it is
 * built. Three copies of one fact had drifted three ways, so the fact now lives
 * here and every surface interpolates it.
 *
 * ── WHAT IS MEASURED TRUE, AND HOW TO RE-MEASURE IT ─────────────────────────
 *   · Phone browser + home screen: `app/manifest.json` has
 *     `"display": "standalone"` (curl https://www.setnayan.com/manifest.json).
 *   · Desktop app for Mac and Windows: /download serves both builds from R2
 *     (`resolveDesktopRelease()` in lib/desktop-release-server.ts; open
 *     https://www.setnayan.com/download — it says "not available" when it is not).
 *   · iPhone app: `apps/mobile` (Capacitor) is built and uploaded to App Store
 *     Connect, but a stranger cannot download it until Apple approves it. So the
 *     sentence that NAMES it is gated on the same switch the Papic install banner
 *     already uses — `NEXT_PUBLIC_IOS_APP_STORE_URL` (app/papic/join/[token]/
 *     page.tsx). Unset → the answer says nothing about an iPhone app, which is
 *     neither a denial nor a promise. Set → it names the App Store and the link.
 *     No code change is needed on approval day; setting the variable is enough.
 *   · Android: NO. `build-android.yml` is manual-only and nothing is on Google
 *     Play. ⛔ Do not add an Android-app sentence until a Play listing exists —
 *     and then gate it the same way, on `NEXT_PUBLIC_ANDROID_PLAY_STORE_URL`.
 *
 * Pure: no React, no server-only, so help.ts (client-imported via props),
 * llms-txt.ts and the guard all read the same string.
 */

/** The App Store link for the iPhone app, or `undefined` while it is not listed. */
export function iosAppStoreUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_IOS_APP_STORE_URL?.trim();
  return raw && /^https:\/\/apps\.apple\.com\//.test(raw) ? raw : undefined;
}

/**
 * The answer, in the help corpus's voice. `storeUrl` is a parameter so the
 * guard can render both states; callers pass nothing and get the live one.
 */
export function mobileAppAnswer(storeUrl: string | undefined = iosAppStoreUrl()): string {
  // The link goes LAST, with nothing after it: /help/[slug] turns every
  // `https?://\S+` into a link, so a full stop after the URL would join it.
  const iphone = storeUrl ? ` On iPhone there is also the Setnayan app, on the App Store: ${storeUrl}` : '';
  return (
    'Setnayan works on your phone. Open setnayan.com in Safari on iPhone or Chrome on Android and add it to your home screen — it then opens full screen, like an app, with nothing to download. On a computer, there is a desktop app for Mac and Windows at setnayan.com/download.' +
    iphone
  );
}

/**
 * 🍎 THE SAME QUESTION, ASKED INSIDE THE APP (Apple check 2026-10-19, row #14 —
 * guideline 2.3.10). `mobileAppAnswer()` tells a web reader about Chrome on
 * Android, the home-screen install and the Mac/Windows downloads; read inside
 * the iOS app, that names another mobile platform and promotes other apps to
 * someone who has already installed this one. In the app the only true and
 * useful answer is that they are using it, and that it is the same account.
 * Names no platform at all, so it stays true on iPad and on a future Android
 * build of the same shell. Read through `helpBodyFor` (lib/help.ts).
 */
export function mobileAppAnswerInApp(): string {
  return 'Yes — you are using it. Everything you plan here is saved to your Setnayan account, so it is the same wherever you sign in.';
}
