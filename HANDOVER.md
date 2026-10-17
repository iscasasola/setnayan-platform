# HANDOVER — rd/no-double-records (event-day: no double records)  · started 2026-10-18 by the controller

Owner, 2026-10-18, verbatim: "stability and request fix? … making sure there are no overlaps? since this is now the time
where we make sure app will not collapse when a lot of users are … connecting to the event" → then: "Yes — start the
double-records fix … now". Audit: ~/Documents/Claude/Projects/controller-2026-10-12/EVENT-DAY-LOAD-AUDIT-2026-10-18.md (lane L1).

GOAL: on an event day (hundreds of guests, bad signal, retries, double taps, two tabs) no guest action creates a second
record, double-counts, or loses a write. Nothing the guest SEES changes except honest errors. Verify every finding below
yourself on this branch before fixing (the audit was a Sonnet read; a finding may be wrong — if so, say so and skip it).

FIX, in this order (one commit per item, each with a test that would fail without it + a sabotage run):
1. `nameTheSeats` (app/[slug]/actions.ts): reads seat rows then INSERTs guests; only `guests_plus_one_of_idx` (non-unique).
   Two submits → extra +1 seats beyond what the couple allowed. Make plan+write atomic (an RPC under
   pg_advisory_xact_lock on the primary guest, or a unique slot key). Couple's allowance must be enforced in SQL.
2. Papic guest capture (app/api/papic/guest-capture route + its RPCs `papic_record_guest_capture`, reserve):
   a retry after a lost response = 2 captures, 2 R2 objects, 2 point spends. Add a client-generated capture id sent by the
   guest camera (also by its offline queue — the SAME id on every retry), UNIQUE (guest, client id), the record RPC returns
   the existing row on conflict without spending again, R2 key derived from the id. If points are reserved before the
   record and leak when the function dies between them, fold reserve+record into one transaction if it is contained;
   otherwise name it in the PR as left.
3. `createJoinRequest` / `selfJoinAction` (app/join/...): anonymous double-tap = 2 `self_added_unlisted` guests + 2 couple
   notices; SELF_JOIN_CEILING is read-then-insert. Dedupe under an advisory lock on (event, normalized name/mobile) and
   return the existing request; ceiling counted inside the lock.
4. `recordGift` (lib/gift-record.server.ts): no idempotency → a retry double-counts and can flip a wish to "got" early.
   Client ref id + UNIQUE (giver, ref); a repeat returns the first record.
5. find-me limits (lib/find-me.ts): 20 name lookups / 10 digit tries per 15 min per event+IP — a whole venue shares one
   Wi-Fi IP, so the door silently falls back. Key primarily per device (signed cookie) + keep a much higher per-IP
   ceiling sized for a venue (several hundred). Keep scraping protection; write the numbers + reason in the docblock.
6. `submitRsvp`: two concurrent submits both see "changed" → couple gets 2 `rsvp_received` notices. Decide "changed"
   from the UPDATE itself (… RETURNING old vs new / conditional update), not from a stale read.
7. `applyReconcileForEvent` (run on every attending RSVP): its upsert errors are ignored → a concurrent loser is left
   unseated silently. Check the error; retry once; record the fault.
8. Bare in-memory `rateLimit()` (not real on Vercel serverless) on /api/upload, [slug]/rotate-qr-actions.ts,
   app/live/actions.ts, app/papic/buy/actions.ts, papic media, vendor qr-guard → `enforceRateLimit` (DB-backed) where
   the path is guest/public-facing. Keep each existing limit's numbers unless they block a venue.

RULES: migrations only via `pnpm migration:new` (allocate forward), RLS/grants per house patterns, Ugat map tests must stay
green (see CLAUDE.md rule 4). PGlite cannot run concurrent sessions — prove idempotency by calling twice with the same id
and asserting one row / one spend; prove locks by reading the SQL in a guard. `actions.ts` failing closed stays correct.
No new emails. No UI redesign; any new error copy is plain words. Changelog fragment changelog.d/rd-no-double-records.md.

## PROGRESS (builder, 2026-10-18)
- [x] 1 nameTheSeats — FIXED. Migration 20271272305444 `guest_plus_one_seat_mint` (service_role): advisory lock on the
      bringer, allowance re-read inside, same-name live seat returned (no 2nd row), `full` past the count. actions.ts calls
      the RPC instead of `.from('guests').insert`. Test tests/db/a-plus-one-seat-is-minted-once.db.test.ts (5/5);
      sabotage: same-name lookup removed → 1 red · full refusal removed → 2 red · lock removed → 1 red.
      Guard repointed: every-plus-one-is-named.test.ts (insert shape → rpc shape).
