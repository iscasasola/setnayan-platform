## 2026-07-21 · feat(live-studio): SETNAYAN overlay paywall + 24h broadcast window

Implements the owner-locked free-tier model (2026-07-21). The free tier is **fully functional** —
every camera pairs, multiview works, switching and split work — but a full-screen SETNAYAN mark
sits over every video surface. It is legible enough to prove the rig works and useless as a
broadcast. A couple proves their entire setup FIRST, then pays. **The overlay is the paywall.**

**One instant does both things:** pressing Go live on a paid event clears the overlay *and* opens
a 24-hour window. Before that instant — paid or not — the overlay is on ("pressing live. until
then, we only promote setnayan"). Buying early therefore costs nothing; the clock does not start
until they actually go live.

- **`lib/panood-watermark.ts`** — the single decision (`decideWatermark`), pure and server-time
  driven. Five states: `unpaid` · `awaiting-go-live` · `window-open` · `expired-broadcasting` ·
  `expired`. Fails closed by construction.
- **`_components/setnayan-overlay.tsx`** — the overlay, in three sizes (thumb / monitor / full).
- **Every video surface is covered**: program monitor, every camera thumbnail, the split
  composite, and the OBS pop-out. One uncovered surface would be the whole bypass.
- **Migration `20270829098323`** — `panood_control_state.first_live_at`, **write-once**, with a
  DB trigger (`trg_panood_first_live_at_immutable`) that silently preserves the original value.
  Anchoring to the FIRST press is what stops a stop/restart from extending a paid window. The
  trigger preserves rather than raises, because a hard error there would break camera switching
  mid-ceremony over a field the operator never touched.

**The rule that outranks the paywall:** if the 24 hours lapse while a broadcast is STILL RUNNING,
the overlay does **not** come back (`expired-broadcasting`). Slamming a logo over a paying
couple's ceremony is the worst thing this feature could do. The window bites at the *next*
press-live instead (`canStartBroadcast`).

**The OBS ordering trap** is handled on the captured surface itself: while overlaid, the pop-out
reads "Press Go live in the control room to clear this overlay before you start streaming" — so
a couple who starts OBS early sees the instruction inside their own test recording.

Decided server-side in `broadcast/page.tsx` and passed down as a rendered fact; the client never
re-derives it. Carried to the pop-out over the existing `ProgramFrame` bridge, so console and
capture surface cannot disagree.

15 new unit tests (29 in the two files, all passing). Typecheck + production build clean.
Inert in production — both SKUs are still "In build" and streaming is flag-gated off.

SPEC IMPACT: New pricing/packaging model for Live Studio. Corpus updates pending the council
verdict (`Live_Studio_Trial_Council_Verdict_2026-07-21.md`) — this PR is the mechanism, the
verdict settles the remaining owner decisions (free-tier time limit, unpaid press-live, offline).
