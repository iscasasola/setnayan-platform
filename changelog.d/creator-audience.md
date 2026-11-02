## 2026-07-16 · feat(creator): viewer counts + lightweight follow (notify followers on new chapter)

Owner decision 2026-07-16: "creator = user; the differentiator is
followers/viewers." Builds the AUDIENCE layer on top of the user-native creator
model (PR #3314): aggregate, privacy-safe viewer counts + a lightweight follow,
with a notify-on-new-chapter fan-out. No PII, no public follow graph.

Viewer counts (aggregate, no per-viewer row):
- `creator_chapters.view_count` + `users.profile_view_count` BIGINT counters,
  bumped by two atomic, self-gated SECURITY DEFINER RPCs
  (`increment_chapter_view` / `increment_profile_view`) that no-op on a draft
  chapter or a hidden profile — a counter can never be inflated for a
  non-public target. Granted to `service_role` only (mirrors
  `increment_discount_uses`).
- Counted from a client `ViewBeacon` island → `recordChapterView` /
  `recordProfileView` server actions (service-role admin client). Keeps the
  ISR-cacheable `/u` + chapter pages off the cookie/auth path. CRON-FREE — a
  plain per-view UPDATE, no scheduler. Light dedup via a first-party httpOnly
  rolling cookie (cap 60 ids) avoids refresh-spam. View counts render on the
  chapter detail, the timeline cards, and the profile header.

Lightweight follow:
- `user_follows(follower_user_id, followed_user_id, unique, CHECK follower<>followed)`.
  RLS Pattern A — the follower owns their rows (`follower_user_id = auth.uid()`
  for select/insert/delete) + admin override. The follow GRAPH is PRIVATE: a
  caller only reads their own follows; who-follows-whom is never publicly
  queryable.
- `users.followers_count` — the ONLY publicly-surfaced audience number,
  maintained by an AFTER INSERT/DELETE trigger (`sync_user_followers_count`,
  SECURITY DEFINER, clamped >= 0). `/u` reads the aggregate WITHOUT touching the
  graph.
- Follow/Unfollow: `getFollowState` / `followUser` / `unfollowUser` server
  actions + a `FollowButton` client island shown only to a signed-in visitor
  viewing SOMEONE ELSE'S public profile (never self/signed-out). Follow guarded
  to public-profile targets; idempotent (unique-violation → no-op).

Notify-on-new-chapter (REUSES the 0028 pipeline):
- New `new_chapter_from_followed` notification type (enum migration; separate
  file so the value commits before runtime use). On publish (draft→published
  only), `lib/creator-notify` fans out via `emitNotification` to the author's
  followers (follower lookup via service-role — the author is the followed
  party). In-app for all followers; EMAIL consent-gated via a new
  `MARKETING_GATED_EMAIL_TYPES` set — an opted-out follower still gets the in-app
  notification but no email (RA 10173). Fired from `after()` — never blocks the
  author's publish.

Locked constraints honored: canonical RLS patterns + 4 helpers only (Pattern A
+ admin override); RLS at CREATE; no entity-ID change (user_follows is internal
plumbing — hidden bigserial, no S89 public_id); cron-free (no new Vercel cron).

SPEC IMPACT: Fills the AUDIENCE layer of
`Creator_Adventure_Chapter_Build_Plan_2026-07-16.md` (viewers + followers = the
user-native differentiator). Corpus `DECISION_LOG.md` row appended.
