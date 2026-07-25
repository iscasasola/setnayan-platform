## 2026-07-21 · fix(admin): Data Privacy approvals update in place, no page reload

Approving/turning-off/blocking a control on `/admin/data-privacy` did a full
`redirect('/admin/data-privacy?flash=…')`, which reloaded the whole page —
blank flash + scroll to top on every click. Now each control card updates in
place.

- `setDataPrivacyControl` returns a `{ status, message }` result instead of
  redirecting (keeps `revalidatePath`, so the card's status badge refreshes).
- New client component `_components/control-actions.tsx` uses `useActionState`
  (React 19, mirroring `event-type-notify-form.tsx`) — the outcome shows inline
  under the card, buttons disable while pending, and no navigation happens.
- Dropped the `?flash=`/`?error=` query-param plumbing + `FormFlash` from the
  page (feedback is now per-card).

SPEC IMPACT: None (admin UX fix).
