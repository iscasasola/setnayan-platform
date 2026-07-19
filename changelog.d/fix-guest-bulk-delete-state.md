## 2026-06-24 · fix(guests): clear bulk selection + show pending state after a bulk delete

Two bugs in the desktop guest-list bulk-action bar (`guest-list-multiselect.tsx`),
reported by owner after deleting 3 selected guests:

- **Stale selection after a bulk action** — the bulk-delete/apply server actions
  redirect to a `?bulk_*=N` success flag (a client-side nav). The list re-renders,
  but the module-singleton selection store (`guest-selection-store.ts`) still held
  the acted-on IDs, so the floating `SelectionBar` stayed stuck on
  "N selected / Delete N". Added a gated reset effect keyed on the success flag +
  `allIds` (fresh ref per server re-render, so it's the per-navigation trigger and
  a repeat action with the same N re-runs):
  - **Delete** prunes the selection to guests that still exist (deleted ones are
    gone → bar empties + disappears).
  - **Apply** (assign role/side/group, `?bulk_assigned|bulk_grouped|bulk_sided`)
    clears the selection so the host isn't left with a stale bar after assigning.
  Reads the live selection via a ref so it fires once per bulk-action navigation,
  not on every re-select while a flag lingers in the URL; ordinary
  filter/search/sort nav carries no flag, so cross-view selections are never touched.
- **No "deleting…" feedback** — the Delete (and Apply) buttons were raw
  `<button type="submit">` with no in-flight state, so they looked idle from
  click until the redirect landed. Swapped both for the shared `<SubmitButton>`
  (`useFormStatus`) → spinner + "Removing…" / "Applying…" + disabled while the
  server action runs.

SPEC IMPACT: None (UI state-management bug fix; iteration 0001 guest list).
