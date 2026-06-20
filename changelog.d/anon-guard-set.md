## 2026-06-20 · feat(anon): guard set — block anonymous users from vendor contact, money, and bouncing email (pre-flip)

Completes the anon-draft onboarding model (PR #1912): an anonymous user is a real `auth.uid()` that *passes* every `if (!user)` check, so without these guards an account-less couple could fire a real vendor inquiry or place a real order under a throwaway, un-emailable, unrecoverable identity (a vendor could even burn ₱100–300 in answer-tokens replying to a ghost whose reply bounces). Two code-grounded audits confirmed the gaps; this enforces the owner's model: **discovery + planning are free while anonymous; touching a vendor / spending money / needing a real email requires securing the account first** (convert-in-place keeps the same uid + event, so nothing is re-entered).

**Vendor-contact guards** (return `not_secured` → UI routes to `/signup`):
- `app/v/[slug]/inquiry-actions.ts` `startServiceInquiry`, `vendors/_actions/unlock-category.ts` `unlockCategoryWithInquiry`, `vendors/actions.ts` `finalizeVendor`, `lib/vendor-invite-actions.ts` `sendVendorInvite`.
- `onboarding/wedding/actions.ts` — the commit inquiry fan-out now **skips for anon users** (picks stay held in `style_preferences`; they send from the dashboard after securing).

**Money floor**:
- `checkout/actions.ts` `submitOrderAction` returns `{ needsAccount: true }`; `orders/actions.ts` `createOrder` redirects anon → `/signup`. `inline-checkout-drawer.tsx` routes `needsAccount` to `/signup?next=<here>` so they return to checkout with the plan intact.

**Bouncing-email fix**:
- `lib/notification-emit.ts` skips the Resend send when the recipient email is the `@anon.setnayan.local` placeholder (the in-app notification row still lands, so they see it once secured). New `isPlaceholderEmail` / `ANON_EMAIL_DOMAIN` helpers in `lib/anon-onboarding.ts`.

**UI cleanup** (no more raw `anon+<uuid>@…` leak):
- Profile page shows "Not secured yet — add an email"; account-switcher hides the placeholder; `requestAccountDeletion` routes anon → `/signup` (no throwaway deletion requests in the admin queue).

Primary anon-reachable callers (`inquiry-composer`, `unlock-categories-list`, checkout drawer) handle `not_secured`/`needsAccount` with a `/signup` redirect; long-tail callers degrade to their generic error (still safely blocked).

All guards are unconditional `user.is_anonymous` checks — dormant until anon-draft is live (no anon users exist until the Supabase toggle + flag are on), so **zero behavior change today**. Owner ruling: `/[slug]` stays auto-public (publish-gate intentionally NOT added). Deferred polish: hiding the change-password / sign-out-other-devices controls for anon (low-harm; the dashboard SecureAccountBanner already nudges), and auto-dispatching held picks on conversion (couples send from the dashboard for now).

No schema change. tsc clean.

SPEC IMPACT: onboarding/vendor/checkout auth model — anon guard set. Logged in `DECISION_LOG.md`.
