## 2026-07-10 · fix(home): 3D-Plan demo QR now has a clickable "open here" fallback

Owner feedback on the live homepage 3D-Plan demo: "links did not work · the QR
displayed something [that] didn't work." Root cause: the demo overlay rendered
the guest QR as an **image only** — a desktop visitor with no phone handy hit a
scan-only dead-end (nothing to click). The backend was proven healthy (a live
minted token resolves and renders the guest view; mints persist with a 20-min
TTL) — the gap was purely the missing link.

- The overlay now surfaces a clickable **"No phone? Open the demo here →"**
  link next to the QR, pointing at the SAME `joinUrl` the QR encodes
  (`/3d_plan/demo/[token]`, opened in a new tab). The URL was already in the
  mint result (`Plan3DGuestQr.joinUrl`) — it just wasn't shown.

Verified: `joinUrl` target resolves live (a valid token renders the guest view,
not the expired dead-end) across `www.` and the apex (`setnayan.com` 307→www).
Note flagged separately: `setnayan.ph` is currently unreachable (000) — a DNS/
hosting gap, not this code.

SPEC IMPACT: None (UX affordance on the existing demo flow).
