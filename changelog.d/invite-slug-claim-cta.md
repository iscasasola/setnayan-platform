## 2026-06-26 · feat(guests): "claim your account" CTA on the lifecycle event page (Invite/Join v2)

The last deferred Invite/Join v2 nice-to-have. An accountless guest on their event
page (`/{slug}`) now sees a "Keep this on your phone — get a sign-in link by email"
prompt, so they can turn their cookie-only session into a real Setnayan account with
the event attached (reusing `sendEventAccountMagicLink`), from the page they keep
returning to — not just at join time.

Gated per the agreed lifecycle table:

| Phase | CTA |
|---|---|
| Save the Date | no (too early; focus is the reveal) |
| RSVP | yes |
| Event (day-of) | yes |
| Editorial (post-event) | yes |

…and **only for accountless viewers** — `showClaimAccountCta` is computed at the page
level as "no signed-in Supabase account for this viewer", so a logged-in account-holder
never sees it.

- `app/[slug]/page.tsx` — computes `showClaimAccountCta` (one `auth.getUser()` on the
  guest path), threads it into `InvitationSite`, which renders the CTA after the Guest
  Hub card when `showClaimAccountCta && lifecyclePhase !== 'save_the_date'`.
- `app/[slug]/actions.ts` — new `claimAccountAction`: reads the SIGNED guest-session
  cookie (never a form field) for identity, emails the passwordless sign-in link, routes
  to the existing check-email screen.

No migration. typecheck ✅ · lint ✅ · production build ✅. **This completes the
Invite/Join v2 series — no deferred items remain.**

SPEC IMPACT: covered by `0000_ADDENDUM_invite_join_model_2026-06-25.md` §5 (email-link
account); the lifecycle-phase gating is the new detail.
