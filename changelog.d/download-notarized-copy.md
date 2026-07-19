## 2026-06-25 · fix(download): correct stale "not notarized" copy — the build IS Apple-notarized

The `/download` page (and the redesign #2201) told users the app was "signed but
not yet notarized" and to right-click → Open to get past a Gatekeeper warning.
That's false: the desktop build has been Developer-ID-signed **and Apple-notarized**
since the 2026-06-16 signing secrets landed, and the notarized binary shipped to
the public download in #2196 (verified: `spctl` accepts it as "Notarized
Developer ID", app stapled). A notarized app opens with a plain double-click —
the right-click workaround is unnecessary and misleading.

- "First launch / right-click → Open" note → "Signed & notarized / just
  double-click to open" (macOS may ask once to confirm an internet download).
- ProvisionCard "Verified by" row: "SHA-256 + Tauri code signature" → "Apple
  notarized · Developer ID".

Context: while confirming this I found `APPLE_TEAM_ID` had drifted and corrected
it back to the Developer ID team `P95JPDWWB3` (matches the signing identity on the
shipped binary). Minor open item: the `.dmg` wrapper itself isn't stapled (the
`.app` inside is), so a first *offline* open does a quick online check — harmless,
optional to add `xcrun stapler staple` on the dmg later.

SPEC IMPACT: None — copy correctness on a marketing surface.
