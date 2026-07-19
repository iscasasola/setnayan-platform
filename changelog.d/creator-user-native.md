## 2026-07-16 · refactor(creator): creator is now user-native — any user authors/publishes chapters; retire is_creator gate + apply/approve flow

Owner decision 2026-07-16: "creator = user." Any authenticated user can be a
creator — they become one simply by publishing a public Adventure Chapter. The
apply/approve gate and the `users.is_creator` permission flag are RETIRED. This
supersedes the gated model in
`Creator_Adventure_Chapter_Build_Plan_2026-07-16.md`.

Ungated authoring:
- `/dashboard/creator` (route path UNCHANGED — no wayfinding break) is now open
  to EVERY authenticated user. Removed the `is_creator` gate + the entire
  "Become a creator" apply branch (`BecomeCreator`); reframed the copy from
  become/apply to "Your story / Your Chapters". `requireCreator()` →
  `requireUser()` (auth-only; RLS Pattern A still scopes writes to the owner).

Retired the application/approval flow:
- Deleted the apply form + `applyForCreator` server action, the admin queue
  `app/admin/creator-applications/` (page + `approveApplication`/`rejectApplication`),
  and the admin nav entry + description.
- Migration `20270815042234_creator_user_native_drop_applications_and_is_creator.sql`
  DROPs the `creator_applications` table (added the same day, unused).

Retired `is_creator` as a permission gate — "is a creator" now = has published
>=1 public chapter:
- `creator_chapters` public-read RLS rewritten to drop the `is_creator`
  condition → `status='published' AND EXISTS(users u WHERE u.user_id =
  creator_chapters.user_id AND u.public_profile_enabled)` (same migration).
- `/u/[userSlug]` timeline: loads chapters for any enabled/owner-preview profile;
  gates the timeline + gold creator badge + no-auto-redirect on `hasChapters`
  (>=1 published chapter) instead of `is_creator`.
- `/u/[userSlug]/c/[chapterId]` detail: gates on `public_profile_enabled` only
  (the published-chapter lookup is the "is a creator" test).
- Badge shows for a public storyteller (>=1 published public chapter);
  `CREATOR_BADGE_LABEL` constant kept unchanged (owner decides label separately).
- `users.is_creator` column DROPPED (same migration) — grep confirmed zero
  remaining code/schema references after the edits (only explanatory comments).
  The #3313 users-privilege guard does NOT guard `is_creator`, so the drop
  doesn't touch that trigger.

Unchanged: `creator_chapters` table + owner/admin RLS, chapter timeline/detail
rendering, teaser render, and `lib/creator-chapters.ts` embed allowlist + sandbox
(embed-only, sandboxed, owned-music-only red lines intact).

SPEC IMPACT: Supersedes the GATED apply→approve model in
`Creator_Adventure_Chapter_Build_Plan_2026-07-16.md`. Corpus `DECISION_LOG.md`
row appended.
