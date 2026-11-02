## 2026-10-02 · chore(cleanup): slice A — 16 server actions nothing calls

Owner: "shrink the app now as fast as we can" (DECISION_LOG 2026-10-02 cleanup rows).
Removed 12 server actions with zero callers (`addVenueDirectoryEntryToPlan`;
`createEventType` / `updateEventType` / `setEventTypeEnabled` / `retireEventType` /
`unretireEventType`; `createChangeRequestFromChat` / `counterChangeRequestFromChat`;
`markTaskInFlight` / `listMoodboardSlots`; `createVendor` / `updateManualVendor`) plus
the helpers only they used, and un-exported 4 internal-only ones (`startConciergeTrial`,
`updateVendorStatus`, `createManualVendor`, `attachManualVendorToCategory`). Server-action
budget 1225 → 1209. Code only — no tables or data touched. The admin jobs map, the
port-control baseline and three count rosters were regenerated / re-counted.

SPEC IMPACT: None
