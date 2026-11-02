## 2026-07-16 · feat(sharing): one-tap public share on the invitation page + event/profile abuse-report targets

Ships item #8 of the Social-Sharing follow-through (owner-approved 2026-07-16) plus the shared report-queue foundation it — and profile item #7c — depend on. Two deliverables in one PR.

**(A) Report-queue foundation (shared with #7c).** The abuse-report queue is the check-constraint text column `user_reports.target_type` (NOT a Postgres enum), previously `('photo','comment','user','ai_output')`, resolved at the single `/admin/user-reports` surface.

- `supabase/migrations/20270812329751_user_reports_event_and_profile_targets.sql`: widens the `target_type` CHECK to add `'event'` and `'user_profile'` (both now, so #7c needs no second migration), using the same drop-by-definition-then-readd pattern as the `ai_output` widening. Makes `event_id` nullable (a profile report is not event-scoped) with a guard CHECK so every event-scoped target still requires an `event_id` (only `user_profile` may omit it). No RLS change — the existing couple/admin policies still hold; a NULL-event profile report simply never matches a couple, so admins-only see it. Idempotent.
- `apps/web/app/admin/user-reports/page.tsx`: renders the two new targets in the existing queue (target phrases, no "in {event}" clause when event_id is NULL, mono target-id line). No second moderation surface (solo-op red line). `escalate`/`dismiss` resolve them; `hide`/`block` stay photo/user-only.
- `apps/web/lib/reports.ts` + `apps/web/app/_components/report-page-button.tsx`: a reusable "Report this page" entry — a discreet client control that files a report of a given `target_type`/`target_id` via a shared server action (service-role write, so a signed-OUT public visitor can report, mirroring the guest-camera report path; stamps `reporter_user_id` + dedups when signed in).

**(B) Invitation one-tap share (item #8).**

- `apps/web/app/_components/public-page-actions.tsx`: a discreet floating chrome cluster — a `navigator.share({title,url})` button with copy-link fallback, plus the `event` report entry. Share is URL-only; the shared artifact stays UNBRANDED (no "made with Setnayan" watermark on the couple's hero/monogram — brand rule #4).
- `apps/web/app/[slug]/page.tsx`: renders the cluster inside `PublicLanding` + `InvitationSite`. Gated on `resolveEffectiveVisibility(event)` — the whole cluster is hidden on a private page; the Share button appears ONLY when effective visibility is `'public'` (i.e. the couple launched their Save-the-Date). Report entry files `target_type='event'`, `target_id=event_id`.

Verified: `pnpm typecheck` + `next lint` clean on touched files; `pnpm migration:check` green (774 migrations, unique prefixes).

SPEC IMPACT: Social_Sharing_Followthrough_Build_Plan_2026-07-16.md item #8 (invitation one-tap share + event report target) is delivered; the report-queue extension it specifies (event + user_profile targets, shared with item #7c) also lands. DECISION_LOG.md row appended (2026-07-16).
