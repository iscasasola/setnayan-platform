## 2026-06-28 · fix(anon-draft): close remaining live gaps (email bounce · vendor-save · sign-out)

Second, broader audit pass (3 parallel lenses) over the LIVE anon-first model,
fixing the real gaps the first pass missed:

- **Email-to-placeholder bounces — fixed at the ROOT.** Anonymous (not-yet-secured)
  users carry a non-routable `anon+<uuid>@anon.setnayan.local` address; several
  senders (papic-sampler expiry, patiktok "reel ready", anniversary digest, order
  receipts) called `sendEmail` with it → hard bounce at Resend. Rather than guard
  each call site, added one short-circuit in `lib/email.ts` `sendEmail`: if the
  recipient is a placeholder, no-op and return `{ ok:false, reason:'placeholder_recipient' }`.
  Covers every current AND future sender; the in-app notification still lands, only
  the dead email is skipped; they start receiving email the moment they secure.
- **`saveAttendedVendorAction` (`app/[slug]/actions.ts`)** — saving a vendor is
  account-required but only checked `!user`; an anon guest could bookmark. Now
  also routes `user.is_anonymous` → `?save=needs_account` (the existing claim box).
- **Profile-page footer "Sign out"** — for an anon user, signing out destroys
  their only key to the plan. Swapped for a "Secure your plan" → /signup link when
  `isAnon` (matches the already-shipped account-switcher treatment in #2316).
- **Profile polish for anon:** hid the marketing-email opt-in (would target the
  placeholder) and replaced the Delete-account confirm box with a short "nothing to
  delete yet — secure your plan" note (the action already redirected anon → /signup).

Verified not gaps: `connectExistingVendorProfile` + profile Change-password/Sessions
were already fixed in #2316 (the audit read a pre-merge checkout); `ProfileMenu` is
dead code (never rendered); admin/vendor sign-out aren't anon-reachable. `tsc` + lint
green. Ships to www.setnayan.com via main auto-deploy.

SPEC IMPACT: None.
