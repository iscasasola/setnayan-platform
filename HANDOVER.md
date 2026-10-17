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
- [x] 2 Papic guest capture — FIXED. Migration 20271272777206: `papic_guest_captures.client_capture_id` + UNIQUE
      (guest_id, client_capture_id); `papic_record_guest_capture` DROP+CREATE as 9-arg (p_client_capture_id last,
      body = prod md5 c7a223fc… extended by asserted script), repeat answered inside the guest lock BEFORE the meters
      (`duplicate:true`, no row, no spend); reply carries `capture_id`. Route: early repeat answer before pool booking/R2,
      R2 key = the id, 9→8 ladder rung, `duplicate` → pool booking released. Camera mints the id at the grab
      (lib/papic-client-capture-id.ts) and sends it on both live posts + all 4 queue writes; drain re-sends it.
      Tests: tests/db/a-guest-capture-lands-once-per-shutter.db.test.ts (5), lib/papic-client-capture-id.test.ts (4).
      Sabotage: branch removed → migration assertion refuses (all red) · branch after meters → 1 red · drain drops id → 1
      red · key by Date.now → 1 red · duplicate keeps points → 1 red. Guards updated for the new signature:
      the-minute-is-the-shutter, papic-guest-ceiling-is-wired (ladder [2,9,8,7,6,3,2]), papic-guest-own-credits-are-hers,
      papic-guest-spend-ceiling.
      LEFT (name in PR): pool reserve (separate RPC) before the record can leak if the function dies between them —
      folding it in moves three ledgers + the fn-not-found carve-out; not contained.
- [x] 3 join requests — FIXED. Migration 20271273586425: `guests.join_request_key` + UNIQUE (event_id, key);
      `guest_join_request_create` (service_role): lock on the EVENT, repeat of the same form key → existing row
      (`created:false`, app refreshes answers, NO second claim/notice), live requests counted vs SELF_JOIN_CEILING inside
      the lock (`ceiling`), then insert. Key = `<RequestKeyInput />` (client component, minted in the browser on mount —
      never in a server render, so a shared cache can never hand one person's request to another) in RequestForm and
      get-inside's "Join as a guest". DECISION (mine, per the door's "a name is not a secret" rule): dedupe by the form
      key, NOT by name/mobile — merging on a typed name+number would hand the 2nd person the 1st's pending ticket.
      A ceiling hit inside the lock reads `join_failed` (the app's own pre-count still says `join_closed` first).
      Test tests/db/a-join-request-is-written-once.db.test.ts (6); sabotage: repeat lookup removed → 3 red · ceiling
      removed → 2 red · lock removed → 1 red · notify before `created` → 1 red. Guard a-list-only-event-takes-no-requests
      test 4 now allows exactly this one writer, held to: service_role only, sole caller createJoinRequest, called after
      the setting gate.
- [x] 4 recordGift — FIXED. Migration 20271274314846: `event_gift_records.client_ref` + UNIQUE (giver_guest_id,
      client_ref). Sheet mints one ref per sheet (useRef) and re-sends it; gift door passes `ref`; recordGift answers a
      repeat with the FIRST record (early read, and again on 23505 if two raced past it) — nowGot false, no 2nd row.
      Test tests/db/a-gift-record-is-kept-once.db.test.ts (5) + existing a-gift-record-is-a-guests-own (12) green.
      Sabotage: early read + 23505 branch removed → 1 red · client_ref not written → 3 red · sheet drops ref → 1 red ·
      early read alone removed → green by design (the index + 23505 branch answer).
- [x] 5 find-me limits — FIXED (no migration). Each budget now spent per PHONE (signed httpOnly `sn_find_device`
      cookie, random id, HMAC with the guest-session secret, 1 day) AND per connection at a venue's size: names 20/phone
      + 500/IP, digits 10/phone + 250/IP, per-guest digits 5 unchanged, 15-min window. No phone id (no secret) → the IP
      is held to the old per-phone numbers. Numbers + reasons in lib/find-me.ts docblock. Limiter injectable for tests.
      Test lib/find-me-a-venue-shares-one-wifi.test.ts (4) + find-me.test.ts (guard updated). Sabotage: IP held at
      phone number → 2 red · phone budget dropped → 1 red · per-guest digits dropped → 1 red.
- [x] 6 submitRsvp double notice — FIXED (no migration). The reply write is a compare-and-set on `updated_at` AS READ
      (`REPLY_BEFORE_COLUMNS` now includes it); a save whose compare is lost (another save landed in between — the double
      tap) re-reads the row, compares against THAT, then writes unconditionally (the answer always lands). A failed
      `before` read writes unconditionally as before. Test tests/db/two-saves-tell-the-couple-once.db.test.ts (2):
      the same write shape through the replayed schema with two interleaved saves + the real guestDetailsChanged, and a
      shape guard on the action (server action not runnable in the harness — said in the docblock). Sabotage: CAS
      dropped → 1 red · re-read removed → 1 red · updated_at not read → 1 red. Guard repointed:
      only-the-answer-freezes (column list moved to REPLY_BEFORE_COLUMNS).
- [x] 7 applyReconcileForEvent — FIXED (no migration). Split into `reconcilePass` (read → plan → write, RETURNS the
      delete/upsert error) run up to twice by `applyReconcileForEvent`; the 2nd pass re-plans from fresh reads (the
      winner's chairs are taken); two losses → `insertFaultLog` SUPABASE_SAVE_ERROR "Seat a guest after their reply".
      Still never throws. Test lib/a-lost-seat-write-is-planned-again.test.ts (4, injected pass/record). Sabotage:
      upsert error dropped → 1 red · one attempt → 2 red · no record → 1 red. Guard repointed:
      a-seat-plan-is-never-arranged-from-an-unread-list test 3 (reads now inside reconcilePass, run inside the try).
- [x] 8 bare rateLimit → enforceRateLimit — FIXED where guest/public-facing: /api/upload (120/min/user, kept),
      [slug]/rotate-qr-actions (guest 3/day kept; IP 10/h → 100/h per event, hashed via joinDoorIdent — 10/h counted
      for real would refuse a venue), app/live/actions pairing (10/10min kept, hashed ip), papic/buy (10/min per
      credential kept; order-link 8/min kept, token HASHED before it reaches rate_limit_hits).
      SKIPPED on purpose (reasons in lib/guest-limits-are-durable.test.ts): papic media route (a DB write per image GET
      at a reception + 600/min per venue IP counted across instances would black out galleries) and vendor qr-guard
      (supplier-only, not a guest door). Guard lib/guest-limits-are-durable.test.ts (3) fails on any new bare import
      without a reason. Sabotage: rotate bare → 2 red · raw token → 1 red · buy bare → 2 red.

## STATE
- Draft PR #6621 (label do-not-auto-merge, autoMergeRequest null). CI watch running. Exposure baseline regenerated
  (+3 cols, new capture signature); local green: exposure-freeze, anon-rpc-surface, anon-table-grants, ugat-* (3),
  replay-order-is-honest, migration:check. Nothing left from the 8 items except the two named "left" lines above.
