## 2026-07-11 · feat(guests): Living Roster P3 — reactive seat chips (placed/suggested/declined) + decline undo

The couple Guests roster gains a reactive **Seat** column: the moment a guest is
added they show where they'd land in the seat plan, and a placed guest shows their
real chair — all without opening the 0008 seating editor.

**Three states, resolved per row (`_components/seat-chip.tsx`):**
- **placed** — "🪑 T#" from the live `event_seat_assignments` join (table label).
- **declined** — "—" (checked FIRST so an optimistic decline flips instantly,
  before the DB trigger frees the seat server-side).
- **suggested** — dashed "⌁ ~T#" self-drafted from role + side.
A "+1" badge rides along for a guest who brings a plus-one (never when declined).

**Suggestion is a pure per-row heuristic (`lib/seat-suggest.ts` + `.test.ts`).**
`suggestTableFor(guest, tables, assignments)` is O(tables) — role tier
(`guestTier`) → a stage-proximity band (`rankTablesByStage`, sweetheart excluded),
general guests split by side, preferring a table with a free chair. It is the
real-data analogue of the prototype's `SUGGEST_TIER`/T5-T6 literals and NEVER
invokes the heavy `solveSeatPlan` on render. 13 unit cases pin the banding, side
split, free-seat preference, and the no-tables / all-full / clamp fallbacks.

**Reactive decline→seat loop with undo.** `inline-actions.setGuestRsvp('declined')`
now reads the guest's seat BEFORE the update (the live `free_seat_on_decline`
trigger deletes it on the decline edge) and returns it as `freedSeat`. The RSVP
chip editor pushes a 6s undo that restores BOTH the prior RSVP and the exact chair
via the new `restoreGuestRsvpAndSeat` action — a best-effort seat re-place mirroring
P1's `restoreDeletedGuests`: a single upsert on `(event_id, guest_id)`, with a
re-taken chair (23505 on the partial chair-unique index) treated as benign so the
guest is restored UNSEATED rather than the undo crashing. RLS
`event_seat_assignments_couple_write` (FOR ALL) covers the re-insert.

**Plumbing.** `page.tsx` folds `fetchAssignments` + `fetchTables` into the existing
parallel fan-out (the old `seated` head+count is dropped — `assignments.length` is
the same count, one fewer Singapore RTT), builds a `guest_id → { placed, suggested }`
map over the filtered `visible` set, and threads it into `GuestListMultiselect` →
`DesktopRow`. The desktop table grows a Seat column (tier-header + self-join
`colSpan` bumped accordingly); the inline-editable Side/RSVP chips (P2) are intact.

**DEGRADED by design (owner-decided option B — NO schema change / NO migration):**
there is no persisted "held" seat state, so this ships **no half-moon held chip**
and **no release-bar** (the prototype's `_release` is never set — dead UI). Mobile
seat parity is deferred to P4. Zero regression to P0 (facet bar), P1
(undo/optimistic), P2 (capture/inline/self-join).

Reuses (not rebuilt): `lib/seating.ts` (`fetchAssignments`/`fetchTables`/
`rankTablesByStage`/`guestTier`/`effectiveCapacity`), the live `free_seat_on_decline`
trigger, P1 `undo-toast.pushUndo` + the optimistic store, P2 `inline-actions.ts`.

tsc clean · next lint clean · lint:radius / lint:legibility / lint:retired pass ·
`tsx --test` (seat-suggest + guest-optimistic + guest-parse: 55 pass) · production
`next build` green.

SPEC IMPACT: None to the SKU/pricing/schema locks. The reactive seat loop ships in
its DEGRADED form (option B) — placed + suggested + declined only, no persisted
"held" seat state, **no new migration**. The deferred "held" state (option A —
adding a hold status to `event_seat_assignments` + amending the trigger/auto-seat)
is logged at the bottom of the corpus `DECISION_LOG.md` per the relaxed sync
mandate; iteration `0008_seating_chart_editor` is the reference home.
