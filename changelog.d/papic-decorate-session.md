## 2026-07-09 · fix(papic): token→session bridge so raw-token guests can decorate

The Kwento Decorator (`/papic/decorate`) and its `/api/papic/guest-capture` upload are
session-scoped, but the guest gallery (`/papic/me/[token]`) is token-scoped. A guest who
only had their raw personal-QR token link (never redeemed an invite) had no session cookie
and hit "open your invitation first".

- New bridge route `app/papic/me/[token]/session/route.ts` — mints a guest session from a
  valid `qr_token` (the same pattern `/[slug]/redeem` + `/[slug]/seat/claim` already use;
  the token is the guest's camera credential), then redirects to `/papic/decorate`.
- The "Decorate a photo" link goes through it. Fixes the whole session-scoped guest surface
  for the raw-token case, not just the decorator.

Verify: `tsc --noEmit` + `next lint` → 0 new errors (pre-existing errors are unrelated files).

SPEC IMPACT: None (edge fix).
