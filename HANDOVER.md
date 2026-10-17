# HANDOVER — rd/guest-page-cache · started 2026-10-18 ~04:40 PHT by the controller

Owner, 2026-10-18: "stability and request fix? with speed fix? … make sure app will not collapse when a lot of users are
… connecting to the event" → approved order: double records (#6621 LIVE) → polling (#6624) → database (#6625) → PAGE
CACHE (this). This settles the 2026-10-08 open call from PR #6454 ("cross-request caching NOT built — owner decision
needed; Option A recommended"): Option A — a per-event revision stamp — is the path. Record that in the PR body.
Audit: ~/Documents/Claude/Projects/controller-2026-10-12/EVENT-DAY-LOAD-AUDIT-2026-10-18.md (lane L3) and
`git -C ~/Documents/Claude/Projects/Setnayan show origin/main:PERF_FANOUT_BUILD_STATUS_2026-10-08.md` (read-only).

MEASURED (read-only audit of origin/main cb673a2): app/[slug]/page.tsx has `revalidate = 60` but is dynamic on every
request (searchParams, cookies via readGuestSession, headers) — nothing per-event is cached across requests. Per render:
stranger 13–14 PostgREST requests, invited guest 17–21, cold 24; plus per-product basket RPCs (`basketGrantsSkuInRender`
in lib/entitlements.ts = one `event_basket_orders_granting` per product, ~3–7 per render for an event with orders;
`compGrantInRender` per product too). Arrival /<slug>/redeem: ~7 requests incl. 3 writes, then /invite/enter.
readGuestSession's `checkedSession` = a DB read on every request.

BUILD (measure before/after with the counting stand-in harness — copy ~/Documents/Claude/Projects/wt-perf2-scratch/harness/):
1. A per-event revision stamp: one migration (pnpm migration:new) — e.g. `events.public_rev bigint` bumped by triggers on
   every table whose rows the PUBLIC guest page reads (events, invitation_widgets, media, schedule blocks, entourage /
   guests-as-entourage, venues, mood board / dress code, love story, entitlements: orders/comp grants…). Enumerate the
   tables FROM the loaders, not from memory; a guard fails if a loader reads a table that does not bump the stamp.
   Grants for the new column per the house rule (an `events` column needs its own GRANT for every role — memory note).
2. Cache the per-event SHARED reads (shell, widgets, media, schedule, entourage, doorway facts, entitlement facts) across
   requests with unstable_cache keyed by (event id, public_rev) — one cheap stamp read per request, everything else from
   cache while the stamp is unchanged. The guest's OWN reads (their row, seat, checklist, face, blocked) stay per request.
   NEVER cache: the Maker canvas / editor=1 / preview / draft renders, anything per-viewer or private, anything gated by
   the viewer's identity. A guard proves a stranger's cached render and a guest's render never share a per-viewer value.
3. One entitlement-facts read per render for an event with orders (an RPC `event_entitlement_facts(p_event_id)` or a
   single batched read) replacing the per-product basket/comp RPCs — answers must equal today's for every SKU (test).
4. If contained: readGuestSession's per-request token check → a short per-instance memo (≤ 30 s) keyed by (guest, token
   hash); revocation still wins within that window — write the window in the docblock.
Pages must look identical (goldens with UPDATE_GOLDEN only if a diff is explained). A host's ✓ Apply must show on the
guest page on the next load (test: publish → stamp bumps → next render reads fresh).
Other builders: rd/two-hosts-never-overwrite (host save paths), #6624 live-day polling (live wall/hub/run-of-show/watch —
do not touch those files). Changelog fragment changelog.d/rd-guest-page-cache.md.
