## 2026-11-25 · fix(sign-up): final check area 1, launch batch — a supplier's sign-up keeps the shop (A1-059, Add 33)

Owner ruling Add 33 (25 Nov): a supplier is a user with a shop.

- **A1-059:** the round trip /signup?as=vendor → "Have an account? Sign in" → "New here? Create account" no longer drops
  the shop intent, and a Google / Apple start error from the supplier sign-up carries it back too. One helper,
  `signInHrefKeepingIntent` (`lib/signup-intent.ts`), builds both sign-in addresses; a supplier's bare `/` becomes
  `/open-shop`, the same rule `signUp` applies, so they land where they continue their shop. The sign-in card already put
  `as=vendor` back on its "Create account" link.
- Nothing new for the model: `/open-shop` takes any signed-in user and self-heals `account_type` (so an account filed as
  a couple is never blocked from a shop), and a shop's team acts as the same supplier through the shipped
  `resolveActiveShopId` / `vendor_team_members` code.

SPEC IMPACT: None — implements the owner's Add 33 ruling; no sign-in rule, plan or price changed.
