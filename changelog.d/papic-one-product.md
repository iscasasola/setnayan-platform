## 2026-08-11 · feat(papic): one product, one ladder — and the host hands the shots out

**Owner, 2026-08-11:** *"instead of having 2 papic services. can we offer just one. and then the
host can dedicated a specific number of shots for a specific QR code. and the rest can be
distributed to the rest?"*

Papic Pool and Papic One are collapsed into **one product**. A couple buys shots; they then decide
how many belong to one camera's QR alone. Everything not handed out is the shared pot every guest
draws from, and unspent shots can be taken back.

**RULE 0 — almost none of this was new.** The two "services" were one mechanism sold twice: a
grant row with `seat_id` NULL is a shared shot, the same row with `seat_id` set is dedicated, and
the capture gate has always spent a camera's own balance first and fallen through to the pool
(`papic_reserve_camera_points` → `papic_reserve_event_points_for_seat`, tri-state 1/0/-1). What
was missing was never the mechanism — only a way for the HOST to move a shot between the two
sides after buying it. No new metering, no change to any capture path.

**The ladder** (migration `20271130515135`), owner-locked after four revisions the same day:
50 free · **100 ₱50** · 3,000 ₱1,000 · 10,000 ₱3,000 · **20,000 ₱5,000**. Value strictly improves
at every step (₱0.50 → ₱0.33 → ₱0.30 → ₱0.25) and no rung can be beaten by repeating a smaller
one — both **checked in SQL and in a test**, not asserted in prose. Free is added on top of
anything bought, so buying 3,000 leaves you holding 3,050.

Retired, deactivated **never dropped**: `PAPIC_GUEST_6K`; the six rungs `20271129155172` created
minutes earlier on the way to 30,000; and Papic One itself (`PAPIC_ONE_150` · `PAPIC_ONE_100` ·
`PAPIC_CAMERA_MINI_DAY`). Both superseded migrations merge in the *same deploy* as this one and
are corrected here rather than force-pushed away — another session authored them, and rewriting
its history to tidy a pre-launch catalog is not worth the risk of erasing work.
🔒 `PAPIC_CAMERA_MINI_DAY` stays load-bearing (it is the `sku_code` of every 'mini' seat and the
legacy multi-camera grant resolves through it) — retiring a rung is not removing a row, and a test
pins the difference.

**The hand-out** (migration `20271131476413`): `papic_seat_allocations` + `papic_dedicate_shots`.
🔑 **The inverse ships in the same migration, by construction.** The call takes a TARGET, not a
delta, so lowering it *is* how shots come back — giving and taking back are one function and
neither can be the one somebody forgot to write. This is the
[[feedback_a_forward_primitive_with_no_inverse]] shape that already cost this codebase a vendor
stuck reading BUSY forever; a hand-out you could not undo would strand shots on the wrong QR
permanently. What cannot come back is what the camera already shot, and that floor **refuses
rather than clamps** — a silent clamp leaves the host unsure which of two numbers is real.

⚠ **The allocation is subtracted from `total_points`, never from `granted_points`.**
`granted_points <= 0` is how `papic_event_pool_status` decides an event has no Papic product at
all. Folding hand-outs into it would flip a fully-allocated event to `applies = false` — the pool
reporting itself as non-existent on an event that had just paid for it.

**Free is a flat 50** (owner: *"keep it at 50"*), down from 50 shared + a fourth camera holding 5
of its own. `free_one_camera_points = 0`; the provisioner already treated `<= 0` as "arm nothing".
Existing grants are left alone — clawing back 5 credits from five pre-launch events is a
destructive write for a cosmetic reason.

**Cameras are now free and unlimited.** A camera with no shots of its own draws the shared pot the
couple already paid for, so it costs us nothing. `purchasePapicOneCamera` and `PapicOneCard` are
**deleted**, not left unreachable: with no active One rung every call would have died at
`unknown_rung`, and a buy path for a product nobody can buy reads to the next person as a live
product with a broken screen.

**Guards, all mutation-tested** (four sabotages, each turned the right tests red, each restore
verified by checksum — `git diff` is blind to untracked migration files and reported nothing):
`papic-one-product-hand-out.db.test.ts` (13). `papic-two-type-model.test.ts` is **renamed**
`papic-dedicated-camera-metering.test.ts` — three of its assertions went with the retired model
and the four that survived are about metering, so its old name stated something it no longer held.
`papic-rungs-are-fundable.db.test.ts` keeps its one real guard (every sellable rung has a funding
hook — which is why `PAPIC_GUEST_100` is wired into `EXACT_HOOKS` in the same commit) and has its
Papic One assertion **inverted**: a sellable One rung is now the regression, not the precondition.

⏭ **Not in this PR:** onboarding still offers the two-product picker, and the public `/papic`,
`/pricing` and features pages still name "Papic Pool" and "Papic One". Both follow.

SPEC IMPACT: `DECISION_LOG.md` (2026-08-11 · supersedes the two same-day Papic pricing rows and
the 2026-07-29 two-type lock) · `Onboarding_Papic_AI_Cards_BUILD_SPEC_2026-07-27.md` § 0 ·
`Papic_Promotion_Surfaces_BUILD_SPEC_2026-07-29.md` § 1 · corpus `CLAUDE.md` SKU section.
