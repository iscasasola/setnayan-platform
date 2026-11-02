## 2026-06-25 · feat(guests): set-password step on email-link accounts (Invite/Join v2, PR4)

A guest who creates a real account via the email sign-in link is now prompted to
**set a password** on first sign-in — so they have a classic email + password login,
not just magic links. Accounts that came in via **Apple/Google** are never prompted
(OAuth is their login method).

- `lib/event-account-link.ts` — `sendEventAccountMagicLink` flags brand-new
  passwordless accounts with `user_metadata.needs_password: true`. Existing accounts
  are untouched (never re-flagged); OAuth accounts are never created here, so they're
  inherently never flagged.
- `app/join/[eventId]/connect/route.ts` — after connecting the event, if the account
  is flagged AND the provider is `email` (not Apple/Google), route to the set-password
  page (carrying `?next=` to the event); otherwise straight into the event.
- New `app/join/[eventId]/set-password/{page,actions}.tsx` — logged-in `updateUser`
  (not the recovery-token reset flow): 8-char minimum (matches signup), clears
  `needs_password`, then continues to the event. Includes a "Skip for now" (keep using
  email sign-in links) so a guest is never hard-blocked.

Applies to BOTH the guest-initiated (#2192) and host-initiated (#2194) email links —
both route through the connect step. No migration.

SPEC IMPACT: refines `0000_ADDENDUM_invite_join_model_2026-06-25.md` §5 — email-link
accounts set a password unless they authenticate via Apple/Google.
