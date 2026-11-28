## 2026-11-29 · fix(auth): G13 — the Google door comes after email and password in the Tab order

On /login and /signup `GoogleAddressDoor` sat between the email box and `PasswordField`, so Tab went email, Google door, password. It now renders last in each form (after Continue / Create account). It is hidden unless a Google address is typed, and it still hides every `[data-password-only]` part, so the visual order matches the DOM order. `lib/one-tab-stop-per-control.test.ts` (6) fails if the door sits between email and password on either page.

SPEC IMPACT: none.
