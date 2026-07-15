## 2026-07-16 · fix(sharing): Library Photos "Share to Facebook" only offers effectively-public events

SPEC IMPACT: None (bugfix; matches Social_Share_Settings_Council_Verdict_2026-07-16.md sign-off #7)

`getPhotosAlbums()` in the account Memories Hub now gates a shareable event's slug through `resolveEffectiveVisibility()` (lib/launch-save-the-date.ts), so the Photos tab only renders a "Share to Facebook" card when at least one of the user's events is effectively PUBLIC. Private/unlisted/scheduled-but-not-due events no longer contribute a slug, so the share button can no longer hand out a link that lands the recipient on a locked/404 page.
