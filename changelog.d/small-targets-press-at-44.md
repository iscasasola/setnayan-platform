## 2026-11-15 · fix(a11y): small targets press at 44 · "First couple" · the admin email row says the send-only key once

Controller round, 15 Nov 2026 (after #7780, which this does not repeat).

- **A new shared halo, `.sn-hit-2d`** (`globals.css`): `.sn-hit`'s invisible 46-px press in both directions, for a
  small control that stands alone. The drawings do not change.
- **Press at 44 now**: guests/new "‹ Back to guest list" (was 18 tall) · Memories' "Open Papic" / "Add photos" (38) ·
  Home's Mark ticks (36 wide) · Home's figures — "3 coming", no reply, can't come, seats … (21 tall) · the top bar's
  Messages (36×36) and Notifications (36 wide, desktop; the phone already drew them at 44) · RW-322: the admin top bar's
  "N queue is past SLA" pill (24 tall — its own hand-made `before:` expander is replaced by the shared `.sn-hit`) ·
  Admin › Studio "View live →" (16 tall) · the Shop cover's settings gear (40 wide).
- **Copy**: a first-N offer for one couple reads "First couple · still open" / "Taken" / "First couple · ₱… off" —
  never "First 1 couples" or "All 1 taken" (`lib/offers.ts`).
- **Admin › Notifications › Email delivery**: a stored "status check: …" error (our read-back with a send-only key,
  not a fact about the email) no longer shows in red under every calm "Sent · not confirmed" row; the ⓘ above says
  once, in plain grey, that Resend reports the key can only send. That ⓘ already presses at 46 (`.sn-dot-btn` halo).
- **Not changed, and why**: the Home counter dots (6 px, 11 px apart — a 44-px press each would overlap its
  neighbours, so the dots need spacing, a drawing change) · the desktop rail's footer links (stacked on a 32-px line;
  a 46-px press would cover the link above and below — 44-px lines are a drawing change) · the date sheet's "✕ Close"
  (its Close is already 44 × 44 — `sheet.tsx`; no 40-px Close was found on a date sheet) · the shop tour's Skip /
  Next (already `min-height: 44px` in `spotlight-tour.tsx`; the bubble pops in from `scale(.94)`, 44 × 0.94 ≈ 41 —
  a mid-animation reading).
- Guard: `lib/small-targets-press-at-44.test.ts`.

SPEC IMPACT: None — hit areas and copy only.
