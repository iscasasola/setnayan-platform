# MB Oversight — full handoff for the Inspiration Gallery arc

Written 2026-09-04 by the planning/oversight pass that scoped MB17–MB22 and received the first
three session reports. **Hand this to MB Oversight; it is self-contained.**

Companion files, all in `build-sessions/`:
`MB-GALLERY-PLAN.md` (the six briefs) · `MB-OVERSIGHT.md` (the live board) · `MB16.md` (a
parallel session with a correction filed against it).

> 🔑 **The one discipline that produced everything below: REPORTED ≠ VERIFIED.** All three sessions
> reported their work as done. One was merged, two were not, and one of those two is now RED.
> Nothing in this document is a session's claim; every state was measured with `gh` at the time
> of writing. Re-measure before acting — these numbers rot.

---

## 1 · STATUS, verified 2026-09-04

| Session | PR | Verified state |
|---|---|---|
| **MB20** Two marks, one URL | [#5176](https://github.com/iscasasola/setnayan-platform/pull/5176) | ✅ **MERGED** 15:33Z · 15/18 success · 0 failures |
| **MB17** The door nobody can find | [#5177](https://github.com/iscasasola/setnayan-platform/pull/5177) | 🔴 **OPEN, 1 FAILURE** — see §2. Auto-merge armed, so it will NOT merge until fixed |
| **MB19** 20 per category | [#5179](https://github.com/iscasasola/setnayan-platform/pull/5179) | 🟡 OPEN, armed, MERGEABLE, 0 failures, 5 checks still running |
| **MB16** Vendor colour access | — | ▶ running · 2 migrations written, **uncommitted** |
| **MB18** The trade map | — | ⏸ not launched · ready |
| **MB21** Questionable → admin queue | — | ⏸ not launched · ready |
| **MB22** Yours stand out | — | ⏸ not launched · unblocked by MB20 |

Both MB17 and MB19 reported "done"/"complete" while their required checks were still running.
**Close a row on a MERGED state, never on a report.**

---

## 2 · 🔴 ACT ON THIS FIRST — MB17 is red

**Failing check:** `typecheck + lint` on #5177 · 1 failure in 12,867 unit tests.
**Failing test:** `apps/web/app/vendor-dashboard/activities/has-a-doorway.test.ts` —
*"the segments page is linked from the shop, like its sibling."*

**Cause.** MB17 extracted `shopToolShelves` and the tool arrays out of
`app/vendor-dashboard/shop/page.tsx` into a new sibling `shop/shop-tool-shelves.ts`. That guard
reads `shop/page.tsx` **BY PATH** and asserts the link list is in it. The list moved, so the
guard's window no longer contains what it protects.

**This is the known trap** — see the memory `guards-pinned-to-file-paths`. Symbol pins were
checked and were clean (`shopToolShelves`, `STYLIST_TOOL`, `TOOLS_COUPLES_SEE`,
`shopOwnerIsStylist` appear only in `shop/page.tsx` on `origin/main`). The pin that fired is a
PATH pin reading file CONTENT, which a symbol grep cannot see.

**The fix:** point the guard at the module that now holds the list. **Do not relax the
assertion** — the guard is correct and just lost its window. Also check its sibling
`apps/web/app/open-shop/has-a-doorway.test.ts`, which names the same path and did not fail (it
may assert something that stayed behind, or it may be about to fail for the same reason).

**Then re-check the other path pins.** Twelve files name `vendor-dashboard/shop/page.tsx` by
path, plus `scripts/dup-rule.baseline.txt`, `scripts/port-control-baseline.json` and Ugat's
`lib/ugat/code-areas.test.ts` may want a row for the new file.

⚠ **The lesson to carry into MB18/MB21/MB22: before any file split, grep for the PATH, not only
the symbol.** MB17's own local `tsc` was clean; only CI's guard suite caught this, because
`pnpm lint` does not run the repo's ~27 blocking guards.

---

## 3 · WHAT WE AGREED — owner decisions, 2026-09-04. Do NOT re-ask these.

| # | Decision |
|---|---|
| 1 | **Back-catalogue uploads are OPEN to every tier**, free included, *"until we have enough data of our own"* |
| 2 | **20 photos per vendor per CATEGORY they cover** — a change of UNIT, not just number. Event-linked photos stay unlimited and uncounted at every tier |
| 3 | **Seeded photos are NEVER deleted.** The owner opened with a 30-day deletion plan and accepted demote-don't-delete instead: a hard delete cascades through `event_inspiration_assets.library_asset_id` and would erase tiles off couples' existing mood boards. At the 500 trigger, INTAKE for that category closes; nothing is removed |
| 4 | **Every inspiration photo carries `WWW.SETNAYAN.COM`** |
| 5 | **Setnayan-created photos stand out with a discreet SEAL, not a heavier stamp.** A bigger mark would deface the best material. Standing-out belongs in the picker (ranking + badge), not in the pixels |
| 6 | **Upload content rule**, verbatim: *"No logos, no contact information, no names, no qr codes, no links, just plain photo."* Implemented as hard-block for the deterministic set (QR · URL · handle · email · the vendor's own name/phone/logo) and **admin queue for everything else** |
| 7 | **Questionable photos** — *"sent to the admin for manual resolution where to accept or reject."* Names are explicitly NOT blocked: couples' names on a backdrop are the design being shown, and blocking them would gut the Wall-design and Stage categories |

Also settled by implication: **`reception_venue` stays `['reception']` alone** — the owner moved
the venue+stylist+lights combination into `overall` instead, which resolved the concern about
stylists publishing into a venue shelf.

---

## 4 · WHAT IS DONE

**Merged this session — MB20 (#5176):**
- `WATERMARK_TEXT` → `WWW.SETNAYAN.COM`, with the plate **measured** rather than estimated
- a `'stamp' | 'seal'` variant threaded from `source_event_id`
- MB9's pixel baselines **regenerated, not weakened**

**Shipped earlier and NOT to be rebuilt** — MB10/MB11 built the whole chain: the pool
(`moodboard_library_assets`, `asset_type = 'supplier_gallery'`, slot key in `asset_subtype`), the
trade gate (`slotUploadVerdict`), the content screen
(`lib/moodboard-gallery-screen.server.ts`), the server-side watermark, admin approval, and the
couple-facing picker with credits and the `SavedPhotoMarker`.

---

## 5 · WHAT ELSE NEEDS TO BE DONE

**In flight, finish these:**
- **MB17** — fix the path-pinned guard (§2), then merge and prune `setnayan-mb17`
- **MB19** — let CI finish; it is MERGEABLE against post-MB20 main, so the shared-`actions.ts`
  overlap resolved cleanly. Prune `setnayan-mb19` on merge

**Not launched, all ready:**

| Session | Model · effort | Scope |
|---|---|---|
| **MB18** The trade map | Sonnet · high | Make `filipiniana_barongs` RESOLVE (it grants nothing today), then `entourage`/`guests` += it, `flowers` += stylist behind florist, `overall` = reception + stylist + lights_sound |
| **MB21** Questionable → admin queue | Opus · high | Migration for screen findings + rejection reason; widen hard blocks to any URL/handle/email; admin sees findings and can reject WITH a reason; the vendor is told why |
| **MB22** Yours stand out | Sonnet · high | Rank event-linked first in the picker + *"A Setnayan celebration"* badge |

**Deferred deliberately — the 500 sunset.** When a category reaches 500 approved, un-retired
event-linked photos, close back-catalogue intake for that category. Nothing is deleted. Not built
now because the trigger is far off: an event-linked photo needs a completed, confirmed booking
where the shop was the couple's recommended pick. Build it when a category passes ~100.

---

## 6 · OPEN OWNER QUESTIONS

| # | Question | Gates |
|---|---|---|
| 1 | Does `overall` keep `coordinator`, or is it replaced by reception + stylist + lights_sound? | MB18 |
| 2 | Do `stage` and `backdrop` admit `lights_sound`? | MB18 |
| 3 | Which mark do MB9's kept RENDERS carry — stamp, seal, or their own? | follow-up to MB20 |
| 4 | Do vendor showcase VIDEOS get marked? `watermarkFile` is images-only today | follow-up to MB20 |
| 5 | `lib/watermark.ts` still stamps the bare word `SETNAYAN` on the MARKETPLACE pool while the gallery now says `WWW.SETNAYAN.COM`. Same mark everywhere, or two? | follow-up to MB20 |

⚡ **3, 4 and 5 are ONE decision** — "which surfaces carry which mark". Ask them together, not
three times. Neither 1 nor 2 blocks anything: MB18's other four rows are settled and can ship
without them.

---

## 7 · DURABLE LESSONS FROM THIS ARC — apply to every remaining MB session

1. **Presence-of-ink is not fit-of-ink.** MB20's sabotages: reinstating the estimated plate left
   **11 of 12 tests green**, and hard-coding the variant left **all 35 pixel guards green** while
   every celebration silently lost its seal. Anything drawing into a box must assert the drawn
   region's **bounds and padding inside its container**, and assert **which** variant was drawn —
   never merely that something was drawn.
2. **Before any file split, grep the PATH, not only the symbol.** §2 is the live proof.
3. **A killed `tsc` is a NON-RESULT, never a pass.** MB20 hit exit 144 with an empty log and 21
   competing processes from sibling worktrees; MB17 hit load-avg ~82. This is CONTENTION, not the
   old disproven "tsc is always killed" claim. **The working answer is the `.tsc.lock` mutex** —
   MB17 got a genuine exit 0 by serialising behind it. Use it; do not race.
4. **`pnpm lint` does not run the repo's ~27 blocking guards.** They are separate CI steps. A
   green local run says nothing about `typecheck + lint`.
5. **A measurement must reach the RENDER.** MB19 caught this unprompted: a per-category quota with
   an account-wide used/cap readout would have blocked valid uploads while every test passed. The
   same shape is the whole point of MB21 — a screen finding stored on a row but absent from the
   admin's screen is a check that ran and changed nothing.

---

## 8 · COORDINATION RULES WHILE THE ARC RUNS

- **`app/vendor-dashboard/moodboard-library/actions.ts` is contested.** MB19 and MB20 both edited
  it; they merged cleanly. **MB21 will be the third** — it must branch from merged MB19, not
  beside it. MB19 also touched `every-upload-is-screened.test.ts`, which MB21 wants.
- **Migration prefixes.** MB16 holds `20271204557031` and `20271204966904` **uncommitted in its
  own worktree**. `pnpm migration:new` elsewhere cannot see untracked files in another worktree,
  so **MB21 must allocate ABOVE `20271204966904`**; duplicates are refused by
  `scripts/check-migration-timestamps.mjs`.
- **MB16 Part 1 vs MB18 — resolved on paper, unresolved in code.** `MB16.md` now carries a
  `⚠ CORRECTION TO PART 1`: its table would not compile against `MOODBOARD_SLOT_TRADES`
  (`walls`/`welcome_signage`/`entrance`/`photo_wall` are design parts, not inspiration slots; and
  five listed "trades" are canonical service keys, not `WeddingTile`s). It needs a **part→trade**
  map instead. **If MB16 reports having edited `MOODBOARD_SLOT_TRADES` anyway, hold MB18 until it
  merges.**
- **Prune each worktree on merge** (owner-locked). `setnayan-mb17` and `setnayan-mb19` are
  outstanding.

---

## 9 · WHAT A USEFUL SESSION REPORT CONTAINS

Not "done". Four lines:

1. **PR number, and whether auto-merge actually FIRED** — count the checks. A CONFLICTING PR runs
   no CI and reports zero failing *and* zero running.
2. **Which files were actually touched**, including any outside the stated lane.
3. **Which guard was sabotaged, and that it went RED.** A guard never seen red is untested.
4. **Anything that contradicts the brief.** The brief is a document, not evidence.
