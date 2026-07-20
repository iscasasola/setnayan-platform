## 2026-07-21 · feat(live-studio): chrome-less PROGRAM output pop-out for OBS

PR #4 of the Live Studio build order (`Live_Studio_Repackaging_2026-07-08.md` § 10).
Gives the couple a clean window OBS can window-capture, so they push the composited
program feed to their **own** YouTube — or Facebook, since RTMPS is RTMPS.

- **`lib/panood-program-bridge.ts`** — a same-origin `window.opener` bridge. The
  parent control room publishes `ProgramFrame`s; the pop-out subscribes and renders
  the **same `MediaStream` objects by reference**.
- **`/dashboard/[eventId]/studio/panood/broadcast/program`** — the capture surface.
  Fixed full-viewport black layer (covers the dashboard chrome it's nested in), no
  controls, no branding, no on-air badge — anything drawn here goes to air.
- **`lib/panood-control-room-access.ts`** — the control-room membership gate,
  extracted from `broadcast/page.tsx` so both routes gate identically. The pop-out
  carries the same auth → membership → paid `PANOOD_SYSTEM` chain; a program feed is
  exactly as sensitive as the console producing it.
- **Control room** — "Pop out for OBS" button on the Program monitor (shown only
  when `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` is on), a named window target so
  repeat clicks reuse the same OBS source, and a toast if the browser blocks pop-ups.

**Why a bridge and not a second connection.** `lib/panood-webrtc` is one publisher →
one viewer per camera slot. If the pop-out ran its own `watchPanoodCameras`, its
answer would replace the control room's peer and **steal the phone's stream** — the
operator's own monitor would go black mid-ceremony. The pop-out therefore never
touches signaling.

Orphan states are explicit rather than blank: opened directly, control-room tab
closed, or opener-isn't-a-console each render their own instruction. A blank black
window would otherwise be broadcast happily by OBS.

10 unit tests (`pnpm test:unit`) pin reference-identity, subscriber fan-out,
throwing-subscriber isolation, and every orphan state. Typecheck + production build
clean; new route is 1.69 kB.

Inert in production — the button only appears behind the existing streaming flag.

SPEC IMPACT: None. Implements the already-specced PR #4; no pricing, SKU or
packaging change. `Live_Studio_Repackaging_2026-07-08.md` § 10 build-order status
updated to mark PR #4 shipped.
