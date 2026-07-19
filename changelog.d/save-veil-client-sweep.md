# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(loading): client-handler saves raise the no-touch veil (Rule 2 sweep)

Owner Rule 2 — "when we save/update data and don't leave the screen, lock the screen behind a no-touch loading veil until the save completes." `<form action>` saves were already covered by `<SubmitButton>`'s auto-veil; this sweep covers the OTHER path — client-handler saves (`onClick`/`onSubmit` with `useState`/`useTransition` that call a server action which WRITES and STAYS on the screen). Each write is now wrapped in `useSaveLoader()`'s `save.run(...)`, which raises the branded blocking overlay, narrates a contextual line, draws "Saved ✓" on success, and hides + rethrows on error. Existing local pending state (button/input disabling) is left in place.

**56 files converted**, across:
- **Couple dashboard** — ceremony-type modal, event-date input, reveal-opening pick, details form, pax settings, vendor-availability finalize-date + banner, suggest-milestones.
- **Vendors / build** — accordion pin & lock/undo, 3-state build controls, build picks add/clear, build compare, category unlock, manual-vendor + marketplace attach.
- **Budget / schedule** — budget allocation-planner, block-time editor, run-of-show advance.
- **Studio** — indoor-blueprint, mood-board chapters, reception designer, share-with-vendors, wedding-attire colour, Pakanta use-song, Panood go-live/end, Save-the-Date render + launch/schedule/cancel.
- **Vendor workspace (host side)** — change-order raise/respond/withdraw, deposit reservation.
- **Event-day** — couple + vendor prep-CTA actions.
- **Admin** — compliance facts, connection-log resolve/archive, menu label/icon, Pakanta deliver, STD video moderation, spotlight recompute/toggle/remove, moodboard-library tags/approve/retire/delete.
- **Vendor dashboard** — booking prep, manpower gig accept/complete/cancel, thread offer-service, shop doc save, domain add/verify/remove.

Deliberately **SKIPPED**: handlers that navigate/redirect on success (the screen loader covers those), search/filter/sort, pagination, optimistic instant toggles (likes/follows/live-wall mode), file-upload flows with their own progress UI, `useActionState` optimistic editors, and the already-loader-wired checkout drawer.

Verification: no navigation is wrapped inside `save.run` (grep-audited across the full diff); the one converted file that also uses `<SubmitButton>` (menu-registry-editor) wraps a separate inline handler, not the form; `tsc --noEmit` clean across all touched files.

SPEC IMPACT: None — behavioral wiring of the shipped loader onto client-handler saves; no schema, pricing, or SKU change.
