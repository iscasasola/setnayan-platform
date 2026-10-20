## 2026-10-20 · feat(app-shell): the iPhone/iPad app honours the iPhone text size (Dynamic Type)

- Owner ruling 2026-10-20: when a person sets larger text in iPhone Settings, the APP's text grows with it. The web and the desktop app are unchanged.
- `lib/app-text-size.ts` `appTextSizeScript` — an inline `<head>` script, right after `storeShellMarkScript`, that runs only in the store shell: it reads the person's size from `font: -apple-system-body` (17 px at the default; 19 px at XL; 40 px at AX3) and scales every glyph, px or rem, with `-webkit-text-size-adjust` on `<html>`. Never below the design size (the 16 px input floor stops iOS focus-zoom); never above `APP_TEXT_SCALE_MAX`. Re-read on `visibilitychange`, which is how a person comes back from Settings. Android's WebView has no `-apple-system-body`, so nothing changes there.
- Guard `lib/the-app-honours-the-iphone-text-size.test.ts` runs the inline script against a fake document for every Dynamic Type size and asks it for what `appTextScale` answers; 4 sabotages caught (no store-shell check · no floor · no re-read · mounted before the mark).
- Walked in the iOS Simulator (Xcode 27.1): iPhone 17 + iPad Pro 13" on iOS 26.5, iPhone Duo on iOS 27.1 — see the PR body for the defect table.

SPEC IMPACT: corpus `DECISION_LOG.md` — new row 2026-10-20 "the app honours iOS Dynamic Type" (the ruling, the mechanism, the cap).
