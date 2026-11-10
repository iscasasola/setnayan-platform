## 2026-11-10 · feat(social): Build 6 Lane S backend — supplier badge posts, a users milestone, real-data-only counts

Owner, 10 Nov 2026 (Build 6 · Lane S): post when a supplier earns a badge, post user-count milestones, and keep test
and sample data out of every milestone count. Backend only — the admin screen waits on an approved prototype.

- **Badge earned → one post.** `lib/social/badge-post.ts` (`composeBadgeSocialPost`) copies the recap pattern: one
  `social_posts` row, `source_type='supplier_badge'`, deterministic `source_ref = <vendor_profile_id>:<reward_key>`
  (the partial-unique index makes it compose-once), never throws, fired from `after()` by the two doors that run the
  badge grant sweep (`GET /api/vendor/badges?view=facts`, the admin's manual Spotlight award). `grantOwedBadgeRewards`
  now returns the `grantedKeys` it just paid. Of several keys paid in one sweep, ONE is posted (`pickBadgeToPost`).
  `verified` never posts as a badge — the vendor_feature sweep already announces it. Gated on its own switch
  `badge_autopost_enabled` and on the shop: live in the marketplace, never `is_demo`, never an internal owner, never
  `social_feature_opt_out`; Free shops are posted unnamed (the vendor_feature hybrid). Dispatch re-asks the same gate
  (`isBadgeSocialShareAllowed` in `flush.ts`) and pulls the row if the shop changed after compose.
- **Users milestone + real counts.** The milestone sweep moved whole to `lib/social/milestones.ts`. Its numbers now
  come from ONE call, `social_milestone_real_counts()`, which leaves out internal / team / admin accounts, `is_sample`
  events (and their guests and couples), demo shops and internally owned shops. A fourth metric `users_joined`. Its
  own switch `milestone_autopost_enabled`. A refused count posts nothing — there is no fallback to a raw COUNT(*).
- **Migration `20271336072378`:** `supplier_badge` added to `social_posts_source_type_check`; two per-type switches on
  `social_publish_settings` (default ON); the counting function (SECURITY INVOKER, service_role only). RLS untouched.
- Admin queue label + card phrase for the new type / metric (no new UI).
- Tests: `lib/social/lane-s.test.ts`, `badge-post.test.ts`, `milestones.test.ts`,
  `tests/db/social-milestones-count-real-data-only.db.test.ts`.

SPEC IMPACT: Social Sharing Program § 8 gains a `supplier_badge` post type, a `users_joined` milestone and the rule
that milestone counts exclude test and sample data — corpus edit owed (`03_Strategy/Social_Sharing_Program_2026-06-12.md`
+ a DECISION_LOG row); the corpus is not reachable from this cloud session.
