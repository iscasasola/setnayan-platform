## 2026-08-30 · feat(papic): a per-guest credit ceiling that actually binds

Session S2 of the shots-per-guest build (spec `WHATS_NEXT_Shots_Per_Guest_2026-08-28.md`
§§ 2–5 + § 7a/7c/7d). The couple gets a number they own, the meter starts counting
in the currency people actually pay in, and the limit is enforced in the one place an
anonymous caller cannot walk around.

**What a person gets.** Nothing yet — deliberately. The switch defaults OFF and there is
no control to turn it on until S3 merges. *Gate the write, not the button.*

- **`supabase/migrations/20271184624871_papic_shots_per_guest_ceiling.sql`**
  - `events.papic_guest_spend_ceiling_on` · `_points` · `_released_at`, each with
    `GRANT SELECT` + `GRANT UPDATE` and the `events_host` view rebuilt.
  - `papic_guest_spend_ceilings` — one row per guest the couple names. RLS on, revoked
    from every session role, written only through its setter.
  - `papic_guest_captures.points_cost` — what a capture was charged, stored at write
    time from the cost the caller already computed. The clip band is **never** derived
    in SQL; `lib/papic-cameras.ts` remains its only writer.
  - `papic_guest_spend_ceiling(guest)` — the ONE resolver for all three tiers.
  - `papic_event_guest_headcount(event)` — **extracted out of** `papic_event_pool_status`
    so the pot's size and a guest's share divide by the same number.
  - `papic_set_guest_spend_ceiling` / `papic_set_guest_spend_ceiling_release` — both
    TARGET-not-delta, so each one's inverse is itself.
  - `papic_record_guest_capture` — the gate, inside the writer, inside the existing
    advisory lock. The pool's yield becomes conditional: it stands the per-guest gate
    down only when **no** ceiling is set.
- **`app/api/papic/guest-capture/route.ts`** — passes `p_points_cost`, and gains a
  6-arg rung on the signature-fallback ladder for the deploy window.
- **`lib/offline/service-handlers/papic-drain.ts`** — records the drain classification
  decision (§ 7d) rather than leaving it to be discovered.

**Three measurements against production that correct the spec:**

1. It said three overloads of `papic_record_guest_capture` exist. **Two do.**
2. Adding a defaulted parameter beside an existing overload raises `42725 is not
   unique` — and the route's fallback regex `/function .*papic_record_guest_capture/`
   **matches that error**, so it would have silently retried the 2-arg shape and
   recorded every clip as a photo. Probed in a rolled-back prod transaction before a
   line was written. Hence: drop all three signatures, create one.
3. `papic_event_pool_status.guest_count` is hard-coded **0** on every grant-driven
   event — which is every celebration, because a 50-credit free grant is armed at
   creation. The spec's arithmetic would have divided by zero.

**One live behaviour change, stated plainly:** the per-guest meter counted ROWS and now
sums CREDITS. The constant was already called "150 credits" while counting rows, and a
ten-second clip costs 8. The branch it governs is reachable only on an event with no
pool and no `PAPIC_UNLOCK`, which is why nothing moves today.

**Proof.** 22 db tests (`papic-guest-spend-ceiling.db.test.ts`), **14 sabotages, all
RED** — including the events-grants lint. The headline test refuses a capture on an
event whose pool *applies*, which is the exact condition under which four previous
limits on this surface shipped governing nothing. The migration was dry-run against
production inside `BEGIN…ROLLBACK`: it applied clean, `papic_event_pool_status` returned
byte-identical rows for all 5 events, all three columns came back `select=true
update=true in_events_host=true`, and the ceiling refused a real capture while the pot
sat untouched at 5,050. Transcript in the PR body.

**Open for the owner (not decided here):** § 7d asks that a drained offline capture be
admitted *above* the ceiling. The only signal that a POST is a replay is a field the
client sets, and this RPC is `anon`-callable — so honouring it would put a "skip the
ceiling" switch on the public surface. Shipped closed; the refusal is classified
non-terminal, so the shot waits, visibly, and lands if the couple raises the number or
releases.

SPEC IMPACT: `WHATS_NEXT_Shots_Per_Guest_2026-08-28.md` — § 3's "three live overloads"
and § 2's use of `papic_event_pool_status.guest_count` are both false against
production; § 5's storage is now named and built. Corpus edit applied alongside.
