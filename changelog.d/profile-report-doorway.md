## 2026-07-16 · feat(profile): /u report button + share doorway + personalized OG card

Item #7c (final piece) of the Social-Sharing Follow-Through plan
(`Social_Sharing_Followthrough_Build_Plan_2026-07-16.md`), building on #7a/b
(slug editor + public/hidden toggle) and #8 (report queue extension). Lights the
public account profile `/u/[slug]` as a real, safe share surface.

- **Report path** — mounts the reusable `ReportPageButton`
  (`target_type='user_profile'`, `target_id = profile owner user_id`) on the
  `/u/[slug]` page, ONLY on the publicly-visible render (opted-in AND has ≥1
  public chapter). Files into the single existing `/admin/user-reports` queue via
  `lib/reports.ts`; no second moderation surface. No new migration — the
  `user_profile` target landed with #8 (`20270812329751`).
- **Share doorway** — new `app/_components/profile-share-button.tsx` (native
  `navigator.share` + copy-link fallback, URL-only). Placed (a) in the profile
  settings "URL & handle" section and (b) on the `/u` showcase. GATED on
  `public_profile_enabled = true` AND ≥1 public chapter; never offered on the
  disabled owner-preview or the empty state.
- **Personalized OG** — new `app/api/og/u/[slug]/route.ts` + card renderer
  `lib/social/profile-card.tsx` (satori + sharp, bundled fonts, mirrors the
  realstory-slug pattern). 1200×630 card: display name over the most-recent
  public chapter's hero. Renders the name-bearing card ONLY when
  enabled + ≥1 public chapter; otherwise 302s to the static brand card — no name
  leak for a dormant/empty profile. Wired into `/u/[userSlug]` `generateMetadata`
  `openGraph`/`twitter` under the same gate.
- **DRY** — extracted the "who is a public profile / what counts as a public
  chapter" resolver into `lib/public-profile.ts` (`resolvePublicProfile`,
  cache()-wrapped) so the page body, `generateMetadata`, the OG route, and the
  settings share-doorway gate share ONE definition (no name/hero leak divergence).

SPEC IMPACT: None (spec side is the plan itself — item #7, PR 7c). Logged in
`DECISION_LOG.md` (corpus). No schema change; no locked SKU/entity-ID/RLS change.
