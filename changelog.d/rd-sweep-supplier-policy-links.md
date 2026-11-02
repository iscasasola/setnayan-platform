## 2026-10-19 · fix(supplier-settings): the policies sit under supplier Settings, from the drawer's one list

Sweep 2026-10-19, row A2 (App Store 5.1.1(i)): a signed-in supplier must reach the Privacy Policy, Terms and
Acceptable use inside the app.

- New `lib/policy-links.ts` — `POLICY_LINKS` (Terms · Privacy · Acceptable use · Cookies, the ☰ drawer's second
  small-print line, same order and words). The drawer's small print (`front-door-shell.tsx`) now maps it instead of
  four hand-typed links; the rendered markup is unchanged.
- Supplier Settings (`settings-view.tsx`) shows the same four as plain small print under the list, outside the
  `manager` gate, so an owner, an admin and a scoped team member all see it. Each link is ≥ 44 × 44 px; no frame.
- Account deletion was already reachable and is unchanged: Settings › Account and the avatar's "Profile & settings"
  both open `/dashboard/profile` › Delete my account.
- Guard `lib/every-signed-in-menu-reaches-the-policies.test.ts`: reads the roles from `UserRoleSummary`'s
  `has<Role>Access` flags (a new console with no menu named fails), checks each role's tree mounts the shell (☰ drawer →
  policies) and the account sheet (→ deletion), renders supplier Settings for owner / team member × web / store shell,
  and checks no policy is bounced or hidden in the store shell.

SPEC IMPACT: None.
