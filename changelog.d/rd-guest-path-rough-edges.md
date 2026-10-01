## 2026-10-01 · fix(guest): the guest path's rough edges from a 390 px production walk-through

Six findings from a phone walk-through of the live guest path:

- **Me has the guest stages' side gutter** — the Me stage was the one guest stage drawn edge to edge (`px-4` inside the `PLATE` column now).
- **Me opens on the ticket, sheet closed.** `#site-me` is no longer a reply-sheet anchor (it raised "Change your reply" over the ticket on every tap). The arrival action's RSVP / "Change" label, the Home spotlight and a new **"Change your reply"** button on Me all point at the sheet's own `#your-details`.
- **Mobile is no longer a hidden required field.** The reply sheet marks Mobile "(required)" while Yes is picked (CSS `:has`, no client state), the browser enforces it (inline script, server-rendered), and `submitRsvp` refuses a yes without it (`?rsvp=mobile`, flash + sheet reopens) — so the guest is not bounced to "One more thing" afterwards. A decline is never asked for a number (the key gate's own rule); this also fixes the invite reply page, where the box was statically required even for a decline. The Terms tick stays where it is asked for the account (Save to my account / the invite reply page): it is not a reply gate, so nothing bounces on it.
- **The intro tour and the guest help say "Yes or No"** (there is no Maybe — DECISION_LOG 2026-09-30).
- **The camera consent card no longer opens Welcome before the day** — mounted only where the stage's Event Bar has a Camera slot (The Day and after).
- **Monogram** — the static `MonogramMark` svg no longer clips the M's foot (`overflow: visible`, the rail fix #6227 applied to the root); the save-the-date film's lockup now reserves the room its scale transform paints, so "Save the Date" is no longer behind the divider rule; the Save-to-account button grows with its two-line sub-label and pads it.

Guard: `app/[slug]/_lib/the-guest-path-rough-edges.test.ts` (render-level for the mobile box and the monogram; executed for the anchors and the stage bar; source reads for the mount decisions). Each assertion sabotage-checked once.

SPEC IMPACT: None
