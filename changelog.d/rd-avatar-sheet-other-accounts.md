## 2026-10-22 · feat(account): other accounts on this phone — instant switch between email logins, + Add another account, Sign out of all accounts

Owner, 22 Oct: *"Like in facebook how i can switch to different email addresses"* (option B — instant). Stacked on the Direction 2 sheet.

- One ACTIVE Supabase session (the `sb-*` cookies, unchanged); every other login PARKED in `sn_acct_<uid>` — its refresh token only, httpOnly · Secure · SameSite=Lax · **Path=/auth/accounts**, so no page, API or RLS read ever receives another account's credential. `sn_accts` holds the display list (no credential).
- `POST /auth/accounts/switch` refreshes the target's jar, refuses unless the refreshed user IS the target, then parks the current session and writes the target's (`lib/account-switch.ts · performSwitch`). `POST /auth/accounts/add` parks the current session and opens the shipped sign-in. `POST /auth/accounts/sign-out-all` revokes every parked session at Supabase, expires every jar, then signs out the active one. `/auth/sign-out` removes the leaving account from the phone.
- The sheet: "Other accounts" rows (ACCOUNT tag) + "+ Add another account" in the Switch-to card; max 5 logins per device; other tabs reload when the account changes (`BroadcastChannel`).
- Guard: `lib/accounts-on-this-phone.test.ts`.

SPEC IMPACT: `DECISION_LOG.md` row 2026-10-22 "THE AVATAR SHEET IS DIRECTION 2" (corpus 6555c1f8) names this PR2 and its feasibility-first condition. No iteration doc changes.
