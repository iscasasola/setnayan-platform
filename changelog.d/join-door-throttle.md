## 2026-08-06 · fix(join): throttle the guest-list self-join door per event + per connection, so one script can no longer close it for the whole wedding

**The risk was CONFIRMED, not theoretical.** `app/join/[eventId]/actions.ts` `selfJoinAction` mints a `guests` row **and** signs a `setnayan_guest_session` cookie — it hands over an identity — with nothing required but the join token printed on the couple's QR poster. Nothing throttled it. Step 3's idempotency check keys on the guest-session cookie, which a script simply does not send, so every call mints a fresh row.

**Why that is worse than spam.** The same action enforces `SELF_JOIN_CEILING = 1000` per event, counted over `guests` rows with `entry_source = 'self_added_unlisted'` and `deleted_at IS NULL`. That ceiling is **shared**, so the attacker is not who gets locked out: once it is full, every later visitor is bounced with `error=join_closed` → *"This event has reached its sign-up limit. Please ask the couple to add you."* (`_components/join-flow.tsx`). A real guest standing at the reception desk can no longer add themselves, and there is no in-product control for the couple to clear it. Meanwhile the sibling public surface that merely **reveals a table label** — `/api/seat-lookup/[slug]` — has run `enforceRateLimit` at 20/10s since the seat-finding work. The door that reveals a table number was rate-limited; the door that hands over an identity was not.

**New — `lib/join-door-throttle.ts`.** No second mechanism: it is a typed wrapper over the existing two-layer limiter (`lib/with-rate-limit.ts` — L1 in-memory + L2 durable Postgres `check_rate_limit`), imported **lazily** so the module stays unit-testable (`with-rate-limit` pulls in `server-only`, which does not resolve under `tsx --test`).

- `allowGuestSelfJoinAttempt(eventId, headers)` — **consumes** a slot; the call the mint path adopts. 30 attempts per 120s per (event, connection). Sized for a **venue, not a laptop**: a reception is routinely one NAT'd WiFi IP shared by every guest, so the budget has to clear a real arrival rush. Thirty completed name-forms in two minutes from one connection is far past human speed, while a script drops from thousands per second to fifteen per minute — the 1000-row ceiling stops being reachable during an event, and the worst case for a throttled guest becomes a two-minute wait instead of a permanent lockout.
- **FAILS CLOSED** when the limiter yields no usable decision — it threw, or returned a shape that cannot be read. A door that mints an identity behind a ceiling shared by every guest must not open because we could not get an answer. The one deliberate fail-**open** is a missing client IP: every anonymous caller would otherwise collapse into a single bucket and one script could shut out all of them — the exact outage this prevents. Matches `lib/anon-mint-throttle.ts`; on Vercel a platform IP header is always present.
- `readJoinDoorIp` prefers the **proxy-set** `x-vercel-forwarded-for` / `x-real-ip` over `x-forwarded-for`, whose left-most entry is client-writable (`lib/client-ip.ts` documents why) and would otherwise let a caller rotate buckets at will.
- The IP reaches the limiter only as a **salted SHA-256 digest** — L2 writes `ident` into `public.rate_limit_hits`, and a raw address there is personal data at rest for no benefit (RA 10173 data-minimization, same treatment as the anon-mint throttle). Ident is `${eventId}:${digest}`, so one busy wedding can never spend another's budget.

**`lib/rate-limit.ts` gains `peekRateLimit(key, limit)`** — a read-only view that neither consumes a slot nor creates a bucket, so it is safe on a GET a guest may reload. Additive; no existing behaviour changes.

**Wired at `app/join/[eventId]/page.tsx`** — the page explains a throttle instead of leaving the guest to guess why the form keeps bouncing, and does it with the **peek**, never the consuming check: a page render must not spend the guest's own budget, or reloading would lock them out of the door. `JoinFlow` renders an unrecognized error key verbatim, which is what lets the copy ship without touching the shared flow component.

⚠ **Honest scope — the helper is dark until adopted.** The mint lives in `actions.ts`, owned by open PR #4157, so nothing consumes the budget yet and the page branch cannot fire in production today. Adoption after #4157 merges is three lines, documented on `allowGuestSelfJoinAttempt`:

```ts
const door = await allowGuestSelfJoinAttempt(eventId, await headers());
if (!door.allowed) {
  return redirect(`/join/${eventId}?token=${encodeURIComponent(token)}&error=${JOIN_DOOR_ERROR_KEY}`);
}
```

**Considered and deliberately NOT built:** a throttle on join-token guessing. `event_join_tokens.token` is 16 random bytes (128 bits), so the page's valid/invalid render is not a usable brute-force oracle — a limiter there would have been theatre, not defence.

Tests — new `lib/join-door-throttle.test.ts` (16 cases). **Every guard was watched go red**, one mutation at a time: fail-open on a limiter throw → test 9 red; fail-open on an unreadable result → 10; ident dropping `eventId` → 2/5/13/14; ident storing the raw IP → 5; the peek consuming budget → 13; preferring the client-writable `x-forwarded-for` → 1; the L1 key composition drifting → 15; throttling the shared no-IP bucket → 11. Two guards are **derived, not restated**: one reads `lib/with-rate-limit.ts` and fails if it stops composing its L1 key as `` `${bucket}:${key}` `` (proved red by mutating that file and restoring it byte-identically), the other reads `actions.ts` and fails if the shared `SELF_JOIN_CEILING` / `join_closed` pair this throttle protects ever disappears. Full unit suite green (6737), `tsc --noEmit` clean.

SPEC IMPACT: None — no schema, no migration, no pricing or SKU change, and no locked decision touched. The self-join ceiling, the roles, and the optimistic-admit behaviour of Invite/Join v2 are all unchanged; this only bounds how fast one connection may knock.
