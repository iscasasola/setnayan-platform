## 2026-09-04 · feat(mood-board): a part the supplier agreed to stops moving (MB12)

The Mood Board's per-part finalization handshake. A couple asks one BOOKED
supplier to agree to one part of their design; the supplier agrees, declines or
lets it lapse; and an agreed part stops re-deriving from the couple's five main
colours until both sides agree to re-open it.

**One vocabulary, a second scope — never a second mechanism.**
`moodboard_part_finalizations.state` holds the same five values as
`event_vendors.lock_request_state` (pending · agreed · declined · cancelled ·
expired), with the same 48-hour materialised fuse, the same lazy expiry on the
answer path and the same single-winner `SELECT … FOR UPDATE` RPC idiom.
`lib/lock-request-state.ts` reads both scopes, so the two cannot drift into two
answers about one fact.

**Owner ruling, 2026-09-04: finalization does NOT inherit "a booking outranks
any marker."** `lockRequestStateOf` promotes any confirmed booking to `locked`,
which is right for bookings and wrong for a design — being hired is not the same
as having reviewed and agreed to this ceiling. `partFinalizationStateOf` takes
only the state column, so there is nothing for a booking to outrank; the ruling
is held by a signature, not by a comment
(`lib/part-finalization-does-not-inherit-the-booking.test.ts`).

**The freeze and the agreement are ONE transaction.** `vendor_agree_to_part`
flips the row AND writes the agreed colours into `events.role_palette` —
`touched_roles` and `room_dressing`, MB5's existing derivation-stops — inside
one function body. `vendor_answer_part_reopen` welds the release the same way.
Split, both failures are invisible: an agreed-but-unfrozen part quietly becomes
a different design under the supplier, and a frozen-but-unagreed role stops
following the majors for a reason no surface can name.

**And no other writer can drop it.** `events_hold_part_finalization_freeze`, a
BEFORE UPDATE trigger on `events.role_palette`, re-asserts every agreed part's
frozen keys AND their agreed colours on every write from every path — the
board's debounced save, a theme apply, the wizard, an admin repair. A guard on
one writer is a guard on one writer.

- **No finalize without a booked supplier, enforced at the database.**
  `request_part_finalization` refuses unless `event_vendors.status` is one of
  the four CONFIRMED values and the booking is on this event, and the table
  grants `authenticated` no INSERT/UPDATE/DELETE at all — so a client that skips
  the server action and calls the RPC by hand is still refused, and a couple
  cannot manufacture a supplier's agreement by writing the row.
- **In-category is enforced in the action**, because the slot → trade map is
  TypeScript (`MOODBOARD_SLOT_TRADES`, MB10) and the database cannot read it.
  Stated plainly rather than faked: the security half is in SQL, the correctness
  half is in TS.
- **Never a dead button.** `finalizeBlocker` returns a sentence — "No supplier
  trade covers this part yet" or "Book a Florist first" — for every part that
  cannot be asked about.
- **Re-open only by counter-handshake.** The couple asks; the supplier answers.
  A declined or unanswered re-open leaves the part frozen: silence is not
  consent in either direction.
- Five notification types, all five on `EMAIL_ENABLED_TYPES` and none in
  `MARKETING_GATED_EMAIL_TYPES` — the notification and the allowlist are two
  halves of one mechanism.
- New Ugat node `TYPE-SIGNOFF` + joint `J47`, which claims the wire (including
  two `no_column` claims that turn a `is_frozen` boolean or a copied `status`
  red before either can become a second source of truth).

Migrations: `20271202859312_moodboard_part_finalizations.sql`,
`20271203493803_notification_type_part_finalization.sql`.

**Known limit, stated rather than papered over:** eight of the 24 parts alias no
inspiration slot and therefore have no supplying trade, so nobody can be asked
about them (`room:entrance`, `room:walls`, `room:photo_wall`,
`room:welcome_signage`, `people:muslim_principals`, `people:secondary_sponsors`,
`people:bearers_flower_girl`, `people:officiants`). And twelve parts are
RECORDED but not FROZEN — their colour is the couple's majors read directly, and
the majors are section 00's own, never touchable by an agreement. Both lists are
pinned by `lib/moodboard-finalization.test.ts` so they can only change visibly,
and the panel says which is which on the row.

SPEC IMPACT: None. MB12 implements the plan in `build-sessions/MB12.md` and the
owner's inheritance ruling recorded there; no locked decision changes, no price
is touched, and `platform_retail_catalog_v2` is not read or written.
