## 2026-06-25 · feat(guests): email-link → real Setnayan account (Invite/Join v2, PR2)

The bridge that turns a name-on-a-list into a real, loginable Setnayan account
with the event already attached. An accountless guest joining via the invite link
can now add their email; we email a **passwordless sign-in link**, and on click the
event is connected to their account — so it shows in their event picker and they can
sign in from any device.

- New `lib/event-account-link.ts`:
  - `sendEventAccountMagicLink()` — stamps the email on the guest row, ensures an
    auth user (admin `createUser`, idempotent), generates a magic link via the admin
    API, and delivers it through **Resend** (not Supabase's mailer, which is
    unreliable here — same reason signup uses Resend).
  - `connectEventForUser()` — creates the `event_members` link via two
    authorizations: the signed guest-session cookie (reuses the existing
    `linkGuestSessionToUser`), then an **email-match fallback** for cross-device
    (the magic link proved the address, so an unclaimed seat in this event with that
    email is theirs). Never hijacks a seat already bound to another account.
- New route `app/join/[eventId]/connect/route.ts` — post-magic-link destination:
  authenticated → connect the event → into `/dashboard/[eventId]`.
- New page `app/join/[eventId]/check-email/page.tsx` — "we sent you a sign-in link".
- `app/join/[eventId]/{actions,page}.tsx` — the accountless join form gains an
  optional email field; `selfJoinAction` sends the magic link + routes to check-email
  when an email is given (plain name-only self-join unchanged).

No migration — reuses `event_members` + `guests.email`. Held as a draft PR for owner
review (auth-path change), same as PR1. Deferred: host-initiated email invite (host
types an email on a guest → sends the link), and a `/[slug]` "claim your account" CTA.

SPEC IMPACT: Covered by `0000_ADDENDUM_invite_join_model_2026-06-25.md` §5 (email
linking → automatic Setnayan account).
