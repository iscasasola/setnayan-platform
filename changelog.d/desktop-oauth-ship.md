## 2026-06-26 · release(desktop): ship working Google/Apple sign-in to /download

Confirmed-working desktop OAuth goes public. Three coordinated changes:
- **Capability fix:** `oauth:default` (empty — the plugin defines no default set) →
  `oauth:allow-start` + `oauth:allow-cancel`, so the loopback's `start` command is
  actually granted (it was permission-denied; "could not start the sign-in helper").
- **Cleaned the debug instrumentation** out of `lib/desktop-oauth.ts`: the temporary
  `alert()` tracer is replaced by quiet `/login?error` routing, a one-shot `settled`
  guard, cleanup on every exit path, and a 5-min abandon timeout.
- **Shipped the dmg:** committed the signed+notarized build to
  `public/downloads/Setnayan_0.0.1_aarch64.dmg` and bumped `desktop-release.ts`
  (1,866,003 bytes · 2026-06-26).

Adversarial review (3 lenses + synthesis) verdict: ship-with-followups, ZERO
blockers. Tracked follow-ups (post-ship hardening, separate native rebuild): scope
`opener:allow-open-url` to https-only; shorter abandon timeout + retry affordance;
errorReturnTo for /signup; in-flight sentinel; optional OAuth `state` check.

SPEC IMPACT: None.
