## 2026-09-06 · fix(admin/gifts): the deals creator, the tier list, and a comp's reach

Three defects confirmed by a post-merge audit of PRs #5192/#5193, all on
`/admin/gifts`.

**1 · Two of the three deal shapes could not be created from any UI.**
`createFreeWindow` already accepted `service_keys` from the live vendor
catalogue, already treated `new_verified_vendors` as a valid audience, and
`deal_length_days` was already a column — the action was complete and the form
was never rendered. Only a per-vendor comp could be issued, so "all verified
vendors" and "vendors who register and submit documents in this window" — the
two cohort deals the page exists for — were reachable only by writing SQL. The
form now renders, with both audiences, the date window, the deal length, and
the SKU checkboxes read from `vendor_billing_catalog` (tier rows only; no
add-on has a shared gate a window could reach today).

The page also now says out loud whether deals are switched on, naming
`PROMO_FREE_WINDOWS_ENABLED` — a green line when live, an amber one when the
flag is unset. A creator that silently produces nothing is worse than no
creator: a flag's default in code is not its value in production.

**2 · The tier dropdown offered a tier the action refuses.** The dropdown and
`setVendorTier`'s accept-list were two hand-maintained lists that had drifted,
so a tier could be picked and then rejected. Both now read one exported
constant, `VENDOR_TIER_SETTABLE` (`lib/vendor-tier-caps.ts`) — the offered set
and the accepted set are literally the same value, so they cannot disagree
again. `custom` is deliberately excluded: it is defined by bespoke
`vendor_custom_*` line items and is not settable from a dropdown.

**3 · An event-scoped comp rendered identically to an account-wide one.**
`comp_grants.event_id` shipped 2026-09-05 so a gift could be scoped to ONE
event; both entitlement functions honour it and **no per-user screen showed
it**. On `/admin/accounts?tab=users` and `/admin/users/<id>`, a comp scoped to
one wedding and a comp covering that account forever printed the same three
lines in the same order — "Every Setnayan service · External promo · ₱4,999
retail value · Issued … no expiry" — with nothing saying "the wedding only".
The sentence was *true* about the scoped grant (every service, on that one
event) and the reader was still wrong, which is why nothing errored and no test
caught it. The omission errs toward more given away than was authorised.

One resolver, `describeReach` (`lib/comp-grants.ts`), now renders on all three
surfaces, and the event's display name arrives on the grant row itself via an
embed — so `/admin/gifts`'s private event-name lookup is deleted rather than
duplicated. Held by `apps/web/lib/comp-reach-is-rendered.test.ts`, whose second
test fails any file that prints `describeScope` without printing
`describeReach` at least as often — the only way this defect returns, since it
was already built correctly on one page and forgotten on two.

A grant whose event is later deleted keeps a distinct sentence rather than
falling back to the account-wide wording (which would report a privilege the
customer does not have). That branch reads `scoped_event_id_snapshot`, the
column PR #5221 adds; it is optional on the row type so this module compiles
either side of that merge, and the fetchers begin selecting it once the column
is live.

SPEC IMPACT: None. No price, SKU or entitlement rule changes — this is the
admin console telling the truth about grants the database already stored
correctly.
