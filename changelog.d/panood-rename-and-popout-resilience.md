## 2026-07-21 · fix(live-studio): "Live Studio" everywhere + two pop-out defects found by adversarial review

Owner: *"please fix it first and show not as panood but live studio."*

### Rename — Live Studio on every operator surface

42 files' worth of user-facing copy across `studio/panood/**` and `/panood/**`. The browser tab that
read **"Panood control room · Setnayan"** now reads **"Live Studio control room"**.

Strict word-boundary replacement (`\bPanood\b`), so **nothing structural moved**: `PANOOD_SYSTEM`
(locked SKU key), the `/studio/panood` route, `panood_*` tables, and all 31 identifiers
(`PanoodControlRoom`, `PanoodSetup`, `panoodStreamingEnabled`, …) are untouched. A first attempt
with a looser heuristic corrupted identifiers into `Live StudioSetup`; reverted and redone.

### Two defects, both in code shipped earlier today

An adversarial 4-lens review of the pop-out path found these. Both verified against the source.

**1. Any navigation inside the console closed the OBS capture window.**
The bridge cleanup ran `popoutRef.current?.close()` on *any* unmount — including an ordinary
client-side navigation. Two links do that while on air: the status-strip camera icon and
**"Connect a camera"** in the sources rail. So the exact action an operator takes when a camera
drops **killed their live output**. The unmount no longer closes the window; closing someone's
broadcast as a side effect of navigation is never right.

**2. F5 on the control room froze the pop-out on a still frame, silently, forever.**
A reload runs no React cleanup, so the old bridge was never disposed; the reloaded tab installed a
*new* bridge over the same key while the pop-out still held the **dead** one. `opener.closed` is
false after a reload, so the only liveness probe reported "fine" while the `<video>` held its last
decoded frame — **a photograph going out live**, with no error state. The pop-out now
**re-resolves** the bridge on the timer that already watched the opener, detects the object
identity change, and reattaches on its own.

2 new unit tests pin exactly that: a reloaded console must install a *different* bridge object, and
a disposed bridge must degrade to a failure rather than hand back a dead reference. 126 pass.
Typecheck + production build clean.

### Found and NOT fixed here — flagged for the owner

- **There is no audio anywhere in the pipeline.** The camera publisher requests `audio: false` and
  every `<video>` is hardcoded `muted`. An OBS capture of this window is a **silent picture** — vows
  need a separate OBS audio source. The sources rail even shows an "Audio (preview)" meter, which
  is a fake door.
- **A dropped camera is never detected.** `onSlotState` is a no-op; nothing removes a key from
  `camStreams`; no `track.onended` handler exists. Every indicator keeps saying "fine" while the
  monitor, the thumbnail and OBS all hold a frozen frame.
- **The 24-hour paid window is not enforced.** `canStartBroadcast` has zero call sites outside its
  own test. One purchase currently buys unlimited clean broadcasts.

SPEC IMPACT: The rename completes the 2026-06-29 "Panood → Live Studio" public-surface rename for
the operator console. Internal SKU key and route unchanged, per the lock.
