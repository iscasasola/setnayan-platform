## 2026-07-27 · feat(vendor-dayof): Script & cues — the host/MC specialization surface

Registers the `stage_script` specialization on the live day-of console, via the
two-step recipe in `specialization-registry.tsx`: one component in its own new
subdirectory, one line in `SPECIALIZATION_SURFACES`. `page.tsx`,
`specialization-slot.tsx` and `lib/vendor-dayof-frame.ts` are untouched, so this
lands without colliding with the song-desk / floor-command PRs.

**The surface** (`live/[eventId]/_components/stage-script/stage-script.tsx`) —
three cards a host works from while holding a microphone:

- **On now** — the cue card, derived from `run_state` + the next block: what
  you're on, the shared cue line for it, what's next and when, and the "12 min
  behind" drift label. A running show goes late, so "when" states lateness
  rather than hiding it — `nextTimingLabel` renders "due 15 min ago", not a
  blank. (Caught by running the model against a realistic late-reception
  timeline; the first cut suppressed the negative and dropped the most
  actionable fact on a late floor.)
- **Running script** — the whole program top to bottom, parts nested under their
  parent, done blocks dimmed, the live one marked.
- **Announcements** — the couple's own `notes`, lifted out of the program so a
  long timeline can't bury them.

**Built on the shipped substrate, not forked.** `BLOCK_CUE` is now exported from
`lib/emcee-script.ts` and imported here, so the couple's downloadable emcee
script and the on-stage desk render the same sentence for the same moment
instead of drifting. Now/next/drift reuse `deriveRunOfShow` + `driftLabel` from
`lib/run-of-show.ts` — the run-state pointer is the truth, not the wall clock.

**The decision logic is a pure module** — `lib/stage-script.ts`
(`buildStageScript` + `nextTimingLabel`), with `lib/stage-script.test.ts` (30
tests). The component is a renderer over the model.

**Safety: a private block is never marked sayable.** A booked vendor reads the
FULL timeline, so this desk sees the couple's private blocks. Those carry an
explicit "Don't read aloud" badge and are never dropped — a host told nothing
about a private moment is worse off than one told to keep quiet. Pinned
exhaustively (every `run_state` × both nesting depths) and from both directions.

**No new schema, and no stored card-placement preference.** Card order is
derived: the cue card leads while there's a show to cue, announcements overtake
the script when the current or next block carries a note, and the cue card is
dropped once the show has wrapped. That beats a saved preference on a screen
someone reads mid-room, and needs no table, column or migration. (Had storage
been warranted, `invitation_widgets`' `display_order`/mode is the pattern.)

**Data boundary — verified against live RLS, not assumed.** The desk makes ONE
read: this event's `event_schedule_blocks`, under the caller's client, where
`event_schedule_blocks_booked_vendor_read` grants the full timeline minus the
coordinator's unreleased prep. No admin client on this path. Two things a host
might expect are deliberately absent because a booked vendor genuinely cannot
read them, and forcing either would have been wrong:

- the wedding-party **roster** — `guests` is `event_members`-only, so showing it
  would have meant an admin-client read of guest PI during the open DPO/NPC item;
- **coordinator broadcasts** — `coordinator_broadcasts` is member/moderator/admin
  only, so wiring it would have shipped a permanently empty card (a fake door).

**Gates proven by neutralisation** (each run, observed, reverted; recorded in the
test header): dropping the `held` check in `buildDayOfFrame` so registration
alone unlocks fails exactly 4 tests across both suites — including this PR's "an
unsubscribed host/MC gets LOCKED" — confirming that registering a surface grants
nothing. The privacy guard, the run-state-over-clock claim and the derived card
order were each neutralised the same way.

Verified: `tsc --noEmit` clean · `next lint` 0 errors · full unit suite
4353/4353 (28 new) · production build green.

SPEC IMPACT: None. No schema, no pricing, no locked-decision change. The
specialization set, its tier floor (`SPECIALIZATION_MIN_TIER = 'solo'`) and its
`host_mc` tile mapping were all locked 2026-07-26/27 and are consumed as-is.
