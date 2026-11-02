### Switcher: remove dead Editorials data (follow-up to #2082)

The events-first switcher redesign (#2082) dropped the Gallery/Favorites/Editorials tabs but left the Editorials data fetch behind. Removed the now-dead `SwitcherEditorial` type, the `editorials` field on `SwitcherData`, the `event_editorial` fetch block, and both return objects in `get-switcher-data.ts`; dropped `editorials: []` from the four fallback `SwitcherData` objects (admin · (account) · [eventId] · vendor-dashboard layouts); refreshed the stale `account-switcher` docblock that still described the removed 5-section layout.

The broader editorial feature (`event_editorial` table, per-event `/dashboard/[eventId]/website/editorial` editor, public `/[slug]` + `/realstories`) is untouched.

SPEC IMPACT: None.
