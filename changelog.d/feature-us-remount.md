## 2026-06-22 — Re-mount the Feature-Us opt-in (close the social flywheel gap)

The Social Sharing & Featuring consumer (`lib/social/flush.ts` `sweepCoupleCreations`
→ Facebook + Instagram dispatch; admin `social-queue` reading the same table) was
fully wired but received no rows: the producer UI — `FeatureUsCard`, which writes
`marketing_share_consents` via `grantShareConsent` — was rendered nowhere. The
monogram maker became studio-only (owner 2026-06-21, commit `ffd4ca20`) and the
Save-the-Date builder never had it.

Re-mounted `FeatureUsCard` on the two surfaces where a couple finishes a shareable
creation, as a tasteful opt-in (default off — public-share consent, never
pre-checked):

- `apps/web/app/dashboard/[eventId]/studio/animated-monogram/page.tsx` — in
  `OwnedView`, after the live-preview of the finished animated monogram.
  `artifactType="monogram"`, `artifactRef=""` (the event's singular monogram). The
  studio-only Monogram Maker is left untouched per the 2026-06-21 owner constraint;
  the opt-in lives on the paid surface where the finished creation is shown.
- `apps/web/app/dashboard/[eventId]/studio/save-the-date/page.tsx` — after
  `LaunchStdButton`, gated on the launched state (`std_launched_at` /
  `landing_page_visibility = 'public'`). `artifactType="save_the_date"`,
  `artifactRef=""`.

Both pages query the live (un-revoked) consent row inline so the card flips to its
"already allowed" state, degrading to null on a drifted DB. No changes to
`flush.ts` / the consumer / the admin queue. The app-side publish gate
(`event_date + 7 days`) is unchanged — nothing posts before the wedding.

SPEC IMPACT: 0037 monogram / 0024 save-the-date / 0038 social — re-mounts the
Feature-Us opt-in so finished creations can be queued to Setnayan's FB/IG
auto-publish; opt-in, default off.
