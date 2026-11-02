## 2026-07-12 · feat(vendor): promote Messages (Customers) + Earnings (My Shop) to always-on

Owner "build it" — the two flips offered alongside the always-on picks:

- **My Customers → Messages** now renders eagerly below Payday (communication
  is a daily glance; the thread list stays visible, live chat is one click into
  a thread). Leaves Clients + Availability & capacity in the accordion.
- **My Shop → Earnings** now renders eagerly below the shop home (money is the
  #1 vendor glance). Tier-gated: free/below-Solo shops get a cheap gate, paid
  shops the full ledger. Leaves Contracts · Proposals · How clients pay you ·
  Manpower · More tools in the accordion.

Legacy `?tab=messages` / `?tab=earnings` deep-links still land (now always
visible; `#messages` / `#earnings` anchors added).

Verified: tsc + lint clean.

SPEC IMPACT: corpus DECISION_LOG.md 2026-07-12 (more always-on).
