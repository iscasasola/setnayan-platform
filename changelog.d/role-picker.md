## 2026-08-01 · feat(vendor): pick which desk you are running tonight

Completes **Phase 1** of `Role_Scoped_Day_Of_DESIGN_2026-08-01.md`. #4001 un-collapsed the data;
this is the first surface to use it, and the flip is deliberate and visible.

**The idea.** A supplier can be two trades at one wedding — the band that also emcees. Which one
they are *running* is a fact about **the person on the floor tonight**, not about the company. So
the day-of console asks, instead of guessing from a priority list.

### What changes on screen

When a vendor holds **more than one** desk, the specialization section gains a small switcher.
Holding one desk shows nothing new — a one-item chooser is chrome with no job, the same reasoning
that already keeps the jump-nav empty for a single-section frame.

The section heading and the jump-nav follow the **chosen** desk, so the label can never describe one
thing while another is mounted.

Implemented as a plain `?role=` `Link`, so the console stays a server component with no client state
— the same pattern as the Customer Card's tab rail.

### 🔴 The rule this had to get right

**`?role=` is untrusted input. It selects; it never grants.**

Validation lives in `buildDayOfFrame`, not the page and not the component — one place, unit-tested.
It is checked against **`unlockedSets` (the entitlement)**, never `eligibleSets` (the upsell), so a
hand-typed URL cannot mount a desk the vendor has not paid for.

Anything not held **falls back to the default rather than erroring**: a stale bookmark from a lapsed
subscription should show the default desk, not a dead page.

### Verification

**9 new tests** (27 in the file). The ones that matter:

- a band-only vendor asking for `?role=stage_script` **stays on the song desk** — the URL selects, it never grants
- a **locked** vendor (free, or lapsed) cannot select their way in: still `locked`, no choices, upsell shown, and the lapsed one still says *renew* rather than *subscribe*
- choosing the second trade **mounts it** — the case that was unreachable before #4001
- garbage in the param (`''`, `'   '`, `'not_a_set'`, `'../admin'`, `null`, `undefined`) is ignored, never thrown on
- **the generic kit is untouched on every picker path** — the standing "degrade to the generic kit, never to empty" requirement

All 18 pre-existing frame tests still pass unchanged: a single-role vendor sees exactly what they saw
before.

- `tsc --noEmit` **exit 0, 0 errors** (8 GB heap) · `next lint` clean · **`test:unit` 5,958 / 5,958**
- No migration, no policy, no schema.

### Not in this PR

The **role-scoped run of day** (Phase 2) — the couple's timeline filtered to the one role, which is
where the *focus* the owner asked for actually happens, and what makes a role without a bespoke desk
worth switching into at all.

SPEC IMPACT: None — implements Phase 1 without touching the design's open questions (§ 7).

---

## 2026-08-01 (same PR) · Phase 2 — your run of day, seen through ONE trade

The picker above says *which* desk. This says what that role's **night** looks like — the focus the
owner actually asked for.

**The whole trick is a narrower input.** `blockRelevance` already ranks the shared timeline per
trade, and `deriveCallTime` already works out when that trade must be on site. Both take the
vendor's booked categories — **all** of them, which for a two-trade supplier answers "what matters
to this company", a blur. Pass only the categories belonging to the role they are **running** and
the same two shipped functions answer the sharper question. **No new ranking rules, no second source
of truth.**

`categoriesForSpecializationSet()` bridges the two vocabularies — the couple's side speaks
`host_emcee` / `band_dj`, a specialization speaks tiles (`host_mc` / `live_band`) — by mapping each
booked category through the **shipped** `VENDOR_CATEGORY_CANONICAL` table. Derived, never
hand-listed: this project has already paid once for a taxonomy kept in two places (the 2026-07-30
bug where `live_band ∉ {band_dj}` made every specialization desk dark).

### 🔴 A lens, never a gate

`vendor-timeline.ts` locks it (D2): a booked vendor keeps **full-timeline visibility**. Honoured
exactly — **every block is returned and marked; nothing is removed.** The moments this role does not
work are dimmed, not dropped. A host told nothing about a moment is worse off than one told it is
not his.

And a role with **no claim** on the night says so plainly rather than falling back to "everything is
primary" — pretending a role owns moments it does not is how a focused view becomes noise again.

### One shared read, one more column

`fetchRunOfShowBlocks` now also selects `block_type` (the lens needs it) rather than the slot making
a second query on a live day-of screen. `RunOfShowBlock.block_type` is **optional**, because a legacy
row can lack one — and an absent type matches no rule and lands as `context`, never a throw.

### Verification

**11 new tests** (and the 27 picker/frame tests still pass). The ones that matter: **every block is
returned for every role** (the lens rule) · a role with no claim marks everything `context`, reports
`empty`, and **claims no call time it cannot justify** · two roles genuinely see the same night
differently · clock order with untimed blocks last and stable · unknown/exempt/malformed categories
skipped rather than thrown on · the call time is **before** the moment it is derived from.

- `tsc --noEmit` **exit 0, 0 errors** · `next lint` clean · **`test:unit` 5,969 / 5,969**
- No migration, no policy, no schema.
