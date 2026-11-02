## 2026-08-21 · fix(schedule): the first ever visit to Schedule on a non-wedding event returned a 500

Found by **opening the page in the owner's own signed-in session** while auditing what was left after [#4661](https://github.com/iscasasola/setnayan-platform/pull/4661). His Movie Night's Schedule showed *"Something on our end didn't work."*

## What it was

`seedNonWeddingRunOfShow` authors the free Filipino Run-of-Show the first time a non-wedding event's Schedule is opened. It lived in the `'use server'` module and ended with two `revalidatePath` calls — and the **page calls it during render**:

```
Error: Route /dashboard/[eventId]/schedule used "revalidatePath
/dashboard/<id>/schedule" during render which is unsupported.
```

Next.js forbids revalidating inside a render, so **every first-ever open of a non-wedding Schedule threw.**

## Why nobody caught it

🪤 **It erases its own evidence.** The `INSERT` commits *before* the revalidate, so the blocks land and the **second** visit renders perfectly. You refresh, it works, you move on.

Measured, not inferred: the five blocks on the owner's Movie Night carry `created_at = 2026-08-21 08:17:49`, written by the very request that 500'd at `08:17:47`.

🔑 **AND THE PAGE WAS THE ONLY CALLER.** Nothing submits this — no form, no button. So those two `revalidatePath` calls **never once did anything useful and were fatal every time they ran.** Revalidating the path you are *currently rendering* is meaningless anyway: the page re-fetches the blocks on the very next line. The action's own docblock said *"first-open fixture, not a form submit"* and kept them regardless.

## The fix

Moved to `lib/schedule-seed.server.ts` as a plain server helper with **no revalidation**, and removed from the `'use server'` module — which is for things a person submits.

⚠ **And it now fails soft.** The old version threw on a read or a write error, which during render is another 500 — a seeding hiccup taking down a page whose actual job is showing a schedule. A failure now leaves the schedule empty (the host can still add blocks by hand) and logs loudly at all three failure points.

## Verification

- 4 sabotages, each measured by occurrence count, each RED: the revalidate returns to the render path (0 → 1) · the page imports from `./actions` again (1 → 0) · the seed reappears in the `'use server'` module (0 → 1) · the seed throws into the render again (0 → 1).
- 🪤 One of those **did not land on its first attempt** (count 0 → 0, anchor did not match) and its green result meant nothing. Re-run against a real anchor: it landed and went RED.
- Assertions strip comments before matching — the fix quotes every string it bans.
- Unit suite **9178 pass / 0 fail**. Typecheck, `next lint` and the lint guards clean, including `lint:server-only`.

SPEC IMPACT: None — no SKU, price, schema or migration. Same seeding behaviour, minus the crash.
