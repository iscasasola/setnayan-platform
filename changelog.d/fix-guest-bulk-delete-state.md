## 2026-06-24 · fix(guests): clear bulk selection + show pending state after a bulk delete

Two bugs in the desktop guest-list bulk-action bar (`guest-list-multiselect.tsx`),
reported by owner after deleting 3 selected guests:

- **Stale selection after delete** — the bulk-delete server action soft-deletes
  then redirects to `?bulk_deleted=N` (a client-side nav). The list re-rendered
  with the guests gone, but the module-singleton selection store (`guest-selection-store.ts`)
  still held the now-dead IDs, so the floating `SelectionBar` stayed stuck on
  "N selected / Delete N". Added a gated self-heal effect: when the
  `?bulk_deleted` flag is present, prune the selection to guests that still
  exist (so the bar empties + disappears). Gated on the flag + `allIds` so
  ordinary filter/search navigation never drops a cross-view selection, and a
  repeat delete with the same N still re-runs.
- **No "deleting…" feedback** — the Delete (and Apply) buttons were raw
  `<button type="submit">` with no in-flight state, so they looked idle from
  click until the redirect landed. Swapped both for the shared `<SubmitButton>`
  (`useFormStatus`) → spinner + "Removing…" / "Applying…" + disabled while the
  server action runs.

SPEC IMPACT: None (UI state-management bug fix; iteration 0001 guest list).
