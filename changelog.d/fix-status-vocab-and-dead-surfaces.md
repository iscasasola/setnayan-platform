## 2026-08-06 · fix(vendors,day-of,admin): five live breakages from invented status values

Found by an empirical audit of "is the codebase actually messy?" (5 dimensions,
every claim re-checked by a skeptic agent; 20 findings real, 4 refuted). These
five are the ones a real person hits today. **Nothing errored, nothing logged,
CI was green throughout** — the same signature as the payments incident.

### One disease: a status name that does not exist

`vendor_status` is `considering · shortlisted · contracted · deposit_paid ·
delivered · complete` — **verified against prod**, not the migration seed.
Postgres rejects an entire predicate naming an unknown enum label (22P02); it
does **not** quietly match zero rows. So the query errors, Supabase resolves
`{ error }` rather than throwing, `data` comes back `null`, and the surface
renders its empty state with a green tick.

1. **The emcee could never save a line.** `script-actions.ts` declared
   `BOOKED_STATUSES = ['contracted', 'booked', 'confirmed', 'completed']` —
   three of four invented. `bookingError` was truthy on *every* call, so every
   host got *"Could not confirm your booking on this event"* on every event
   since it shipped. Its own docblock claimed it was "the same check the rest of
   the Customer Card uses"; it never was.
2. **Compare-vendors was dead on both surfaces.** `/explore` and the couple's
   suite page both filtered `.neq('status', 'declined')` — no `declined` in the
   enum. The banner has never appeared, and the Compare tile has always fallen
   through to the bare vendor list. The 2026-07-22 audit fix aimed at exactly
   that dead end was itself built on the broken predicate, so it was **inert
   from the hour it merged**. The real "couple dropped this vendor" concept is
   `archived_at`, which is what the dashboard's own saved-vendor reads use.
   `/explore` also never destructured `error` — now logged, because a failed read
   and an empty shortlist both hide the banner and were indistinguishable.
3. **Every vendor booked-count read zero.** `BOOKED_EVENT_VENDOR_STATUSES`
   contained `'paid'`, feeding **four** separate `event_vendors` queries
   (funnel totals, per-service booked, +2). The `as unknown as string[]` casts at
   those call sites are precisely what stopped `as const` from typing them, so
   the compiler never saw it. **This one was found by the new guard, not by the
   audit.**

### Two that make paid, working product look broken

4. **The wedding-day Live Photo Wall card was a hardcoded "Coming soon" stub.**
   Its docblock: *"depends on iterations 0009 and 0012, which are not yet
   shipped."* Both shipped. `LIVE_WALL` is an **active ₱2,500 SKU in the
   production catalog** and the wall ships at `/wall/[eventId]`. On the wedding
   day a couple who had *paid for it* was shown a greyed-out card saying it did
   not exist. The stub outlived its premise and nothing re-read the premise.
   Now a real card, gated on `eventSkuActive(…, 'LIVE_WALL')` — the same
   predicate the wall page itself gates on, resolved server-side and passed to
   the client grid exactly like `pabatiActive`. Defaults **false**, so a caller
   that forgets it shows nothing rather than a dead advertisement.
5. **Three admin "Open vendor →" links 404'd.** `/admin/vendors/<id>` has no
   `page.tsx`; the segment serves only `/edit`, `/team`, `/tokens`. On the two
   screens where the team triages suspicious and copied listings — where speed
   is the point.

### The guard, and why the existing one could not see any of this

`lib/guards-can-actually-fire.test.ts` already enforced this exact class — for
`payment_status` only. The identical disease was live in `vendor_status` the
whole time.

Two new tests, both **derived from the migration** rather than hand-typed (a
guard comparing two hand-typed things drifts with what it guards):

- **status arrays** — because the payment guard matches only string *literals*
  inside a chain, and `script-actions.ts` reads `.in('status', BOOKED_STATUSES)`,
  an *identifier*. So this resolves which identifiers an `event_vendors` chain
  filters on, then validates those arrays' members.
- **inline chain literals** — the `.neq('status', 'declined')` shape, scoped to
  the `event_vendors` builder chain.

⚠ **My first cut cried wolf** — it flagged every `*STATUS*` array in any file
that merely mentioned `event_vendors`, reporting 16 violations of which 15 were
ORDER / REUSE / PROPOSAL statuses. That is the exact failure the payment guard's
own comment warns about, reproduced one test lower in the same file. Narrowed to
arrays actually used as an `event_vendors` status filter.

**All three fixes were broken on purpose and the guard confirmed failing on
each** before being restored — a guard never seen to fail is decoration.

### Verification

- `tsc --noEmit` clean (exit 0) — and proven to actually be checking these files
  by introducing a deliberate type error and watching it surface. A crashed
  `tsc` reports "0 errors", so the exit code alone was not trusted.
- 6601 lib unit tests pass.
- Enum values read from **prod**, not from `supabase/migrations`.

SPEC IMPACT: None — no schema, pricing, copy or product decision changed. The
Live Photo Wall card now reflects the SKU that was already sold and already
working; it does not grant, gate or price anything new.
