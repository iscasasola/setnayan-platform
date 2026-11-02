## 2026-10-26 · feat(wallet): "Add to Apple Wallet" shows on iPad too — a Mac still never sees it

Owner, 2026-10-26 ("Yes to all"): iPads have Apple Wallet, so the badge under "Save my ticket" belongs there too.

- iPad Safari sends a Mac user-agent ("Macintosh"), so the server cannot tell it from a Mac. `appleWalletLink`
  (lib/wallet-pass.ts) now hands a `touchOnly` link for that case (`mightBeIpadSafari`, not inside an app web view or
  in-app browser); `AppleWalletButton` draws it through the new client gate `AppleWalletTouchGate`, which renders
  nothing on the server and on first paint, then shows the badge only when `isAppleTouchDevice(ua,
  navigator.maxTouchPoints)` says yes (a "Macintosh" with more than one touch point is an iPad). A Mac gets no badge
  and — with `empty:hidden` on the thank-you's Wallet slot — no box or gap. An iPhone's link is unchanged and still
  server-drawn (no layout shift). An iPad that says "iPad" and the Setnayan iPad app were already covered.
- `appleWalletDevice(ua, maxTouchPoints?)` takes the browser's touch count (same rule as `isAppleTouchDevice`).
- Every mount is covered because the gate lives inside `AppleWalletButton` (Me's `GuestTicket`, the thank-you page, its
  "ticket updated" pop-up, and the two dev labs, which now mirror the `touchOnly` arm).
- The pass route `/api/guest/wallet/apple` has no device gate (it trusts the guest session only) — an iPad request is
  already accepted; nothing changed there.

Tests: the device rule (iPhone · "iPad" · Macintosh+5 → yes; Macintosh+0 · Android · Windows → no), the per-UA link
table (iPad Safari / Mac → `download:touchOnly`), and a rendered check that a `touchOnly` badge draws nothing on the
server. Sabotaged twice (rule ignoring touch points; gate always showing) — both caught.

SPEC IMPACT: None (implements the owner's 2026-10-26 approval; the Wallet plan already names iPhone/iPad as the devices).
