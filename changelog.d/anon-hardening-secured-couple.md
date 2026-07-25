## 2026-07-18 · fix(security): block anonymous-draft principals from third-party-email + go-public actions (anon-onboarding hardening PR-1)

Pre-enable hardening for the `NEXT_PUBLIC_ANON_ONBOARDING_ENABLED` (anon-draft
onboarding) feature. A four-audit study found that while the feature's money
paths, data isolation, convert-in-place, and DB trigger are all safe, the
outbound-email and go-public surfaces lack the `is_anonymous` guard their
money-path siblings have — so a native anonymous principal (obtained by finishing
onboarding with the flag on) could email Setnayan-branded mail to arbitrary
third parties and publish/index their own event page before securing an account.
This PR closes the email + publish vectors; bot-flood (PR-2) and abandoned-draft
cleanup (PR-3) follow.

- **Save-the-Date launch/schedule** (`studio/save-the-date/actions.ts`): the
  local `requireCouple` guard takes an `{ secured }` option; `launchSaveTheDate`
  and `scheduleSaveTheDateLaunch` pass `secured: true`, so an anonymous principal
  is redirected to `/signup` instead of flipping the page public + fanning out
  guest emails. Design actions (reveal choice, dates) stay open — anon drafting
  still works.
- **Landing-page visibility** (`website/privacy/actions.ts`): `requireHostMembership`
  gains the same `{ secured }` option; `updateLandingPageVisibility` requires a
  secured account to set `public`/`unlisted` (setting `private` stays open).
- **Kwento assignments** (`alaala/assignments/actions.ts`): new
  `requireCoupleForKwento` helper guards `createAssignment`, `removeAssignment`,
  and `nudgeAssignee`. This ALSO fixes a pre-existing IDOR independent of the
  anon feature — these actions wrote via the service-role client with **no**
  membership check, so any authenticated user could assign/remove/nudge (email)
  a guest on any event by supplying an `eventId`/`assignmentId`.
- **Guest magic-link** (`guests/[guestId]/actions.ts`) and **dependent
  claim/handover** (`people/dependent-actions.ts`): each send action rejects an
  anonymous principal (redirect to `/signup`) before emailing a third party.

Deliberately NOT changed: guest *ingestion* (add / quick-add / CSV import) stays
open to anonymous drafts — building a guest list without an account is the whole
point of the feature. The abuse vector was *emailing* those guests, which the
send guards above close; PII-at-rest for abandoned drafts is handled by the
PR-3 cleanup sweep. Feature stays flag-OFF; behavior for real (non-anonymous)
users is byte-identical.

SPEC IMPACT: None. (Implements the launch-posture requirement recorded in the
2026-07-18 anon-onboarding safety study; no product/pricing/SKU/schema change.)
