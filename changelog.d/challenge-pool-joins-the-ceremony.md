## 2026-09-01 · feat(papic): the challenge pool joins the ceremony sequence

Build order § 5. `lib/kwento-moments.ts` has carried the ten moments in order —
bridal march · vows · veil & cord · first kiss · leaving the church · cocktail
hour · newlywed entrance · first dance · cake cutting · money dance — and
`papic_challenge_library` has carried 631 prompts. **Nothing joined them**: zero
references to kwento in the pool, and the library's `category` axis is THEMATIC,
not ceremonial (`big_moments` and `band_dance` sit adjacent to the sequence and
are not a mapping — reading either as one is how this gets reported as done).

**The mapping is authored in the pool and regenerated, because there is only one
prompt source.** `MOMENT_CHALLENGES` in `apps/web/lib/papic-challenge-pool.ts`
keys ten moments to 37 prompts BY SLUG (a `library_id` is a position in an ID
block and renumbers; a slug does not), `papic-challenge-sql.ts` renders it into
`moment_keys text[]`, and migration `20271189223426` carries the regenerated
631-row UPSERT. Nothing is hand-written in SQL and no second table of prompts
exists. `attachMoments` throws at module load on a slug that is not in the pool,
so a typo is a hard failure rather than a moment that quietly offers nothing.

**Two columns, two different facts.** `papic_challenge_library.moment_keys` is
which moments a prompt SUITS (global, authored). `papic_missions.moment_key` is
which moment a coordinator PUT it at (per celebration, a choice). The second is
not redundant and the degrade rule is why: a coordinator who takes the fallback
places a prompt whose `moment_keys` does not name the moment, so deriving the run
of show from `moment_keys` alone would lose exactly the choices the fallback
exists to enable. A partial unique index makes one-challenge-per-moment something
the database refuses to break, and a CHECK refuses a key no screen could render.

**The coordinator's path is `/studio/papic/run-of-show`** — the day in order, each
moment arriving with the prompts that suit it, one tap to place and one to start.
It ARMS through 4a's `papic_arm_challenge` and reads through
`papic_armed_challenge`; it does not re-implement either. Placing reuses
`addLibraryChallengeAction` so the board ceiling, the idempotency rule and the
`is_active` re-check are not written twice — there are ten moments and
`BOARD_SIZE` is ten, so a celebration with a paid supplier mission genuinely
cannot fit a full sequence, and the screen says so instead of truncating.

**An unmapped moment degrades to the general pool and SAYS it did.** Not
hypothetical: `event_types` applies on top of the mapping, so at a birthday the
veil and cord has nothing in scope and falls back on the first screen, every
time. A wedding degrades nowhere — asserted, so the fallback can never hide a
hole in the mapping.

🔴 **No duration, no expiry, no clock of its own.** THE SEQUENCE IS THE CLOCK
(owner, 2026-09-01). Openness stays `papic_challenge_is_open()`'s alone; a db
case proves clearing a moment does NOT close its prompt, and another proves no
capture path reads `moment_key` — expiry closes the prompt, never the shutter.

⚠ **A first draft of the degrade test asserted the wrong moment.** `bridal_march`
looks wedding-only and is not (`the-reaction-shot` and `the-applause` fit any
celebration), so it has two in scope at a birthday and the test failed. The
degraded moment was measured, not assumed.

Tests: 15 unit cases over the pure decider (`papic-ceremony-sequence.test.ts`),
16 against a replayed database (`the-sequence-is-the-clock.db.test.ts`), and
`moment_keys` folded into the existing field-by-field DB-equals-pool guard in
`five-hundred-challenges.db.test.ts` rather than restated as a second guard.

SPEC IMPACT: DECISION_LOG.md — the ceremony-sequence mapping is a product
decision (which prompts belong at which moment) and now has a home in the code.
