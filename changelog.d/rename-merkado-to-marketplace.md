## 2026-07-27 · chore(nav): rename the couple's "Merkado" to "Marketplace"

Owner: *"instead of merkado. just use Marketplace for it so it is easier to understand."*

- **Label only.** Every user-visible "Merkado" string becomes "Marketplace": the event sidebar +
  bottom-nav items (`nav-registry-defaults.ts`), the customer menu (`customer-menu.ts`), the
  event nav config (`customer-nav-config.ts`), the premium-tier line in `services-takeover.tsx`,
  and the seating editor's cross-link copy.
- **Nothing structural moves.** The slot key stays `explore`, the route stays
  `/dashboard/[eventId]/vendors`, and `matchPrefix` is unchanged — saved links, the `?tab=` states
  and the cross-tab bus all keep working. Component/file identifiers (`MerkadoBudgetLens`,
  `MerkadoGuardBanner`, `merkado-*.tsx`) are deliberately NOT renamed: churn without user benefit,
  and a rename there would collide with in-flight PRs on the same files.
- Stale rename comments refreshed to carry the full lineage — Explore → Merkado → Marketplace —
  so the next reader doesn't have to reconstruct it.

⚠ **SURFACED FOR THE OWNER — a naming collision this creates.** `nav-registry-defaults.ts:275`
already ships a `customer.account.marketplace` item labelled **"Marketplace"** pointing at
`/explore` (the account-level public browse, Store icon). After this change the customer has TWO
items named "Marketplace": the account one (`/explore`, browse all vendors) and the event one
(`/dashboard/[id]/vendors`, this event's vendor workspace). They live in different surfaces
(account launcher vs event sidebar) so they should never render side by side — but the names no
longer distinguish them. Not resolved here; see the DECISION_LOG row for the recommendation.

SPEC IMPACT: DECISION_LOG 2026-07-27 (label rename + the collision flagged for an owner call).
