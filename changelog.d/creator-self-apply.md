## 2026-07-16 · feat(creator): self-apply → admin-approve onboarding (grants is_creator)

CP-1b of the Adventure Chapter creator program — the follow-up the CP-1 foundation
(PR #3304) flagged as "admin-granted for now; self-apply→approve a follow-up". Adds
the self-serve pipe so a non-creator can request creator access and an admin can
grant it. Creators stay FREE — `is_creator` is an access flag, never a SKU.

- New table `public.creator_applications` (migration
  `20270813536704_creator_applications_self_apply_cp1b.sql`): public_id `S89C-…`,
  `user_id`, `status ∈ pending/approved/rejected` (default pending), `pitch` +
  `links` free text, review audit (`applied_at`/`reviewed_at`/`reviewed_by`/`note`).
  Partial-unique index enforces one open (pending) application per user; a rejected
  applicant may re-apply. RLS **enabled at CREATE**, canonical patterns ONLY —
  Pattern A (`user_id = auth.uid()`, applicant owns their rows) + Setnayan admin
  override (`is_admin()`). No public-read policy (an application is private to its
  author + admins).
- Applicant flow: the creator dashboard's non-creator branch
  (`app/dashboard/(account)/creator/page.tsx` — `BecomeCreator`) now renders a
  "Become a creator" pitch+links form and reflects pending / approved / rejected
  state. `applyForCreator` server action (in that folder's `actions.ts`) inserts a
  pending row via the authenticated client; it NEVER writes `is_creator`. The
  existing chapter-authoring UI is untouched.
- Admin approval: new queue `app/admin/creator-applications/` (page + actions),
  registered in the admin nav (Overview/queues group). `approveApplication`
  flips `users.is_creator = true` + stamps the row approved; `rejectApplication`
  stamps rejected with a required note. Both are `requireAdminAction()`-gated and
  write via the service-role client. This admin action is the ONLY code path that
  grants `is_creator` (besides a direct admin DB grant) — a user filing/reading
  their own application can never self-grant.

SPEC IMPACT: Creator_Adventure_Chapter_Build_Plan_2026-07-16.md (CP-1b — self-apply
→ admin-approve onboarding lands; supersedes CP-1's "admin-granted for now" note).
Corpus DECISION_LOG.md row appended.
