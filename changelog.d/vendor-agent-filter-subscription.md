## 2026-07-02 · feat(vendor-dashboard): subscription-gated Agent filter on My Customers calendar

Follow-up to #2593, which shipped the Agent filter DISABLED with the wrong
rationale ("per-agent scheduling isn't tracked yet"). It IS trackable — the gate
is the **subscription tier**, not the schema:

- Agents are a **Pro+ feature** — `TIER_CAPS[tier].agentAccounts` is 0 for
  free / verified / solo, 3 for pro, 10 for enterprise. So the Agent filter is
  enabled only when `tierCaps(tier).agentAccounts > 0`; a vendor who drops below
  Pro loses it (disabled with a hint).
- Agents map to work via **service assignment** — `vendor_service_agents`
  (team member → `vendor_service_id`), surfaced by `fetchAgentServiceAssignments`;
  an agent "sees only their own work." Filtering by an agent narrows the calendar
  to the **service categories** that agent is assigned to (same pool-narrowing
  path the Service filter uses).

Changes:

- `page.tsx` — probes `tier_state` (isolated select, added to the existing
  parallel batch — no extra sequential hop), computes `agentsEnabled`, and for
  enabled tiers builds `agentCategories` (`vendor_team_member_id` → the
  categories of that agent's assigned services) via `fetchAgentServiceAssignments`
  + the services list. Passes `agentsEnabled` + `agentCategories` to the calendar.
- `customers-calendar.tsx` — `agentFilter` state; `filteredPools` now also
  narrows by the selected agent's categories; the Agent select is enabled per
  `agentsEnabled`; active-filter context line includes the agent.
- `customers-filter-bar.tsx` — Agent `FilterSelect` wired to `value`/`onChange`
  when enabled; hint reframed from "not tracked yet" to the tier gate ("Team
  agents come with Pro …").

Vendor-level marks (blocked / locked / whitelist / waitlist) stay visible under
any filter (they aren't agent-scoped). All client-side re-derive; no re-fetch on
filter change.

SPEC IMPACT: The vendor "My Customers" Agent filter is a **Pro-tier feature**
(gated on `agentAccounts > 0`), narrowing the calendar to an agent's assigned
service categories. No schema change — reuses `tier_state`, `TIER_CAPS`, and the
existing `vendor_service_agents` assignment table. Owner note: this ties the
calendar's agent filter to the same tier ladder as the rest of the agents
feature; surfaced for sign-off. (Corpus DECISION_LOG append deferred — isolated
worktree; this fragment carries the record.)
