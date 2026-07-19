## 2026-07-11 · feat(vendors): returning-client marker + quick-action bar on the Customer Card

Relationship Workspace + Appointments, PR 5 (Details-tab surface). Adds two
additive elements to the top of the vendor Customer Card's Overview tab
(`app/vendor-dashboard/clients/[eventId]/page.tsx`) — no page/CardTabs
restructure:

- **Returning-client marker** — renders only when the couple has a prior
  CONFIRMED booking with this vendor on a different event. Reuses the SAME
  signal as the vendor-inbox pending badge: `fetchReturningClientFlags` →
  the `get_returning_client_flags` SECURITY DEFINER RPC (graceful-degrades to
  no marker pre-migration `20261201000000`). The RPC returns the most-recent
  prior event's name/date (DISTINCT ON — no exact count, no prior event_id),
  so the marker names that one past event rather than a linked list.
- **Quick-action bar** — shortcut links only (no new call/quote logic): Chat +
  Call open the couple thread (`/vendor-dashboard/messages/<threadId>` — the
  P2P call surface lands there once built), Quote deep-links the thread's
  `#send-proposal` composer, Files jumps to this card's `?tab=files`, Details
  is the current view (inert).

SPEC IMPACT: None. Implements the already-drafted Details tab from
`Relationship_Workspace_and_Appointments_2026-07-11.md` (§ Details, lines 45 +
102/107) and `Vendor_Customer_Master_Build_Plan_2026-07-11.md` PR 5. Deviation
noted for owner: the spec asks for "worked together N×" + a linkable
"Past events together" list, but the approved reuse source returns one prior
event (name/date only, no count, no id); an exact N or linkable list would need
a new SECURITY DEFINER query (out of scope for this PR).
