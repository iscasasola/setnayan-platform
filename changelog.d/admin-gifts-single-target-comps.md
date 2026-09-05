## 2026-09-05 · feat(admin): /admin/gifts — every live comp, vendor or user, on one page

New admin page listing every vendor tier comp and every active user/event
comp grant together, with a search-and-select flow to grant a single named
target without already knowing its ID. Reuses the two existing write paths
rather than adding a third: vendor comps go through `setVendorTier` (tier
only — `comp_grants` excludes vendors by its own docblock), user comps through
`issueCompGrant` / `revokeCompGrant`.

Two backend changes underneath it:

- `setVendorTier` now REQUIRES a reason (min 10 chars, written into the
  `admin_audit_log` metadata). Until self-serve vendor checkout ships, every
  non-free tier set on that form is a comp with no invoice behind it, and
  there was no record of why. The existing per-vendor `/plan` form gained the
  field too.
- `comp_grants.event_id` (migration `20271205612762_comp_grants_event_scoped`,
  nullable, FK to events). A grant was account-wide by construction —
  `event_has_comp_for_sku()` resolved it via "any host of this event", with no
  per-event filter — so a comp meant for a couple's wedding also unlocked
  their earlier debut. NULL keeps the old behaviour for every existing row;
  set, both entitlement functions scope the grant to that one event, on top
  of (never instead of) the host check. `issueCompGrant` accepts an optional
  `event_id` and refuses one the target does not host.

New readers: `fetchAllActiveCompGrants`, `fetchEventsHostedBy` in
`lib/comp-grants.ts`; `fetchCompedVendors` in `lib/vendor-tier-comps.ts`.

⚠ `fetchCompedVendors` reads `tier_state <> 'free'` as "comped". That is
exactly true today and will be silently wrong the day self-serve vendor
billing lands — there is no `source`/`is_comp` column to tell a paying vendor
from a comped one. The module docblock is the trip-wire.

Known v1 limits: post-grant redirects land on the writers' own pages (the
vendor's `/plan`, `/admin/users`), not back here; no cohort / date-window
targeting (that is `promo_free_windows`, still flag-gated off); no SKU-level
vendor comps (the `comp_grants.vendor_profile_id` column exists but no flow
writes it).

SPEC IMPACT: admin comp grants can now be scoped to one event. Corpus not yet
updated — flagged for a `DECISION_LOG.md` row.
