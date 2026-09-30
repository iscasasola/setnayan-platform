## 2026-09-30 · fix(event-hub): no "add to home screen" card; the hub's camera terms is only the small card

Owner, verbatim, on the guest Event Hub card "Keep it with you · Put Indalecio & Claire on your
home screen": *"remove this part on the website"*.

- **Removed** `app/[slug]/_components/keep-on-home-screen.tsx` and its one mount in the guest branch
  of `site-body.tsx`, plus `installPlatform` / `INSTALL_STEPS` in `lib/event-app-icon.ts` (no other
  reader). It appeared on no other guest page. The per-event manifest and the couple's icon are
  untouched, so installing from the browser menu still gets the couple's tile.
- Owner, same day, on the Papic "Before you start shooting" card inside the hub: *"space is too big
  also should only be the small frame"*. `PapicGuestCapture` takes a required `embedded` prop; inside
  the hub its terms / blocked / no-camera states render as the card alone (no
  `<main min-h-screen>` frame — which also removes a `<main>` nested in the hub's `<main>`).
  `/papic/guest` passes `embedded={false}` and is unchanged. Agreement logic unchanged. At 390px the
  terms block went from 844px (a full viewport) to the card's own 496px.
- Tests: two install-platform tests removed with the helpers; `the-invitation-opens-on-the-mark`
  drops `<KeepOnHomeScreen` from its lists. New guards:
  `lib/the-event-hub-has-no-home-screen-card.test.ts`,
  `app/[slug]/_components/the-hub-camera-terms-is-only-the-card.test.ts`.
  `scripts/port-control-baseline.json` regenerated for the deliberate removal.

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-30 (no home-screen card on the Event Hub; hub camera terms
is the small card only) — applied directly in the corpus.
