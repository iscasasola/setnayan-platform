## 2026-08-13 · fix(admin): the tile backfill had no button — a mechanism never proven reachable, written while quoting that rule

Immediate follow-up to #4401, which shipped the wall-size (640px) photo derivative **and a backfill that nothing could call**. It existed as `POST /api/admin/papic/backfill-tiles` with **no caller, no button, and no reference anywhere in the app** — verified by grep, not assumed.

I then told the owner *"there's one button to press."* **There was no button.** That is the exact defect class this session had already invoked three times in three separate PRs — a fix nobody can reach — and I committed it while writing the words down.

### What this does

`/admin/papic-storage` — the page that already reports Papic byte telemetry, so it is where a storage backfill belongs — gains a **Wall-size copies** section with a real control, plus an honest count of how many captures still need one.

The API route is **deleted**, not kept alongside. `/admin/website-media` already ships this repo's idiom for a bulk admin operation (`actions.ts` + a client button), and using it means one fewer HTTP surface to secure and one doorway rather than two. A plain button rather than the media cleaner's typed confirmation, deliberately: that control guards a DELETE, this one only adds a smaller copy of a photo that already exists, and the work is idempotent and batched.

### And a second thing #4401 left wrong

**The storage readout stopped adding up.** `webCopyBytes()` summed display + thumb, so the new third derivative was invisible to the per-event total, the web-copy ceiling check, and the ~8% ratio the pricing councils asked to lock from real data. **A derivative nothing counts is storage we pay for and cannot see.** Now counted — in the shared helper, and the page's own hand-written copy of that sum is replaced by a call to it, because two definitions of one rule is how one of them silently goes stale.

### `null` is not zero, again

The pending count is `number | null`, and the UI says three different things: *"Every photo already has its wall-size copy"* · *"N still without one"* · *"could not be measured just now."* A count that failed to run must never render as "nothing to do" — that files it in the one place a reader has been told they need not look.

### Guards — 4 sabotages, all measured, all caught

- **imported is not mounted.** The assertion is on the `<BackfillTilesButton>` ELEMENT, not the import — a guard that only proved the import has already passed in this repo while the JSX was gone.
- the button must still call the action;
- the callerless route must not come back as a second door;
- `webCopyBytes` must keep counting the tile, and the page must not hand-sum it again.

Full suite: **7,816 unit tests green**, typecheck clean, all 21 `lint-*.mjs` guards + `lint:dup-rule` green.

SPEC IMPACT: None — no SKU, price, schema or migration. It makes an already-merged mechanism reachable and an already-merged number correct.
