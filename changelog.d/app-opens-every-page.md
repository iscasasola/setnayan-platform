## 2026-11-02 · feat(app-shell): the iPhone and desktop apps open every page the website opens

Owner, 2026-11-02 (DECISION_LOG "EVERY PAGE HELD BACK FROM THE APP FOR APPLE GOES LIVE IN THE APP TOO"),
verbatim: *"let everything go live"* — risk of another Apple rejection accepted the same day.

- **Middleware's native-shell brochure bounce is removed** (not emptied). A request from the phone or desktop
  app for `/` (Discover), `/features`, `/for-suppliers`, `/creators`, `/pricing`, `/how-it-works`, `/waitlist`
  or `/download` is no longer sent to `/dashboard` or `/login`; it opens like the website. The `isCapacitorClient`
  detector that only that bounce used is gone with it.
- **Discover is a door in the app.** `discoverOpensHere()` answers yes everywhere, so the account bar draws
  Events · Discover · Memories · People (+ Shop) in the app as on the web, and the rail's Discover row shows.
  The seam itself stays: a shell that ever refuses `/` again drops both doors in the same change.
- **The Maria and Jose sample (`/sample/…`) follows `/` into the app**, as its author designed (*"the day `/` leaves
  the set, the sample follows it out"*). Middleware's by-prefix sample bounce (`appShellBouncesSample`, merged from
  `main` the same day) is removed with the rest; the sample still opens only under its own switch, and its "is this a
  browser?" fact is `discoverOpensHere()`. The sample's two bounce checks (`the-sample-is-sealed` (e) and
  `sample-event` (e)) are re-pointed to that rule.
- **The /login ✕ goes to Discover in the app too.** It was hidden there because `/` bounced straight back to
  `/login`; now it is a real way out everywhere.
- **`/download`'s two "use it on the web" lines are hidden in the iPhone app** (`data-web-only`) — the page opens
  there now, and the anti-steering guard reads it instead of excusing it.
- **Unchanged:** the store shell's paid-feature gate (`isStoreShellWebOnlyPath` — so the iPhone app still sends
  `/pricing` and `/for-suppliers` to the "not in the app" page unless Apple sells there; the desktop app now opens
  them), the Apple in-app purchase gate (`getIapGate`, `lib/iap/iap-gate.ts`), and the welcome-price rule.
- **Seven guards re-pointed to the new rule, none deleted:** the-account-bar-is-the-ruling ·
  every-tab-keeps-the-bar · the-app-login-has-no-dead-close · every-signed-in-menu-reaches-the-policies ·
  store-shell · the-app-never-steers-to-the-web · the-welcome-price-never-reaches-the-app. Each now asserts the
  bounce stays GONE; the store-shell sells-scan and the never-steers scan read the brochure pages they used to skip
  (107 → 110 files), and the welcome-price roster re-fences its two "bounced" rows on what actually keeps the price
  out of the iPhone app.

SPEC IMPACT: None — the owner's ruling is already recorded in the corpus `DECISION_LOG.md` (2026-11-02 row); this
change implements it.
