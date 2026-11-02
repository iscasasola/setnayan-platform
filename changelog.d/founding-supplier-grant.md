# founding-supplier-grant

## 2026-08-09 · fix(admin): a business can actually be marked a founding supplier

**The gate with no handle, fourth instance — and the longest-running one.**
`vendor_profiles.is_founder` shipped on 2026-06-09 with a migration, a column
comment and two live readers in `app/vendor-dashboard/services/actions.ts`. It
had **ZERO writers anywhere in the app.** The single row that has ever carried
it was set by a hardcoded UUID *inside* migration `20261013000000`, so the perk
— unlimited parent-categories and unlimited services-per-leaf — was real,
working and tested, and **no second business could ever receive it.**

Note how thoroughly wired it looked: the column name appears in the admin
export column list, in the anon-column-scope migration, and in a db test. Every
one of those is a read.

### What changed

- **`app/admin/vendors/actions.ts`** — new `setVendorFoundingSupplier` server
  action: admin-gated, service-role write of `is_founder`, audit-logged as
  `vendor_founding_supplier_grant` / `_revoke`. Posts an explicit `on`/`off`
  rather than a checkbox, because an unchecked box posts *nothing* and a
  checkbox-shaped control cannot tell "remove it" from "the field wasn't sent".
- **`app/admin/vendors/[vendorProfileId]/plan/page.tsx`** — a "Founding
  supplier" section with the one button that calls it, next to the existing tier
  form. No new admin page; the surface already shipped. The `is_founder` read is
  a *separate* select on purpose: a column Postgres rejects takes the whole
  select down and resolves `{ error }`, which folded into the main read would
  404 the page and remove the tier form — the only door to Pro/Enterprise. A
  failed read renders a warning and hides the buttons rather than rendering
  "No", which is indistinguishable from a real no.
- **`lib/gates-have-handles.test.ts`** — `is_founder` registered in `SWITCHES`,
  plus a reachability test asserting the plan page renders
  `<form action={setVendorFoundingSupplier}>` and posts `name="is_founder"`.
  Comment lines are stripped before matching so the docblock explaining the
  control cannot *be* the control.

### Scope

No migration. No tier, pricing or money change — `is_founder` composes on top of
`tier_state` and grants category/service caps only; the old token-gate bypass in
`unlock_vendor_event` was dropped at migration `20270221294989` and the token
currency is retired.

### Mutation tests

| sabotage | applied? | result |
|---|---|---|
| rename the `is_founder` key in `.update({ … })` | yes (verified by grep) | RED — `NOTHING WRITES \`is_founder\`` |
| drop `action={setVendorFoundingSupplier}` from the form | yes (0 matches after) | RED — reachability test |
| typo the posted field to `name="is_founder_TYPO"` | yes (1 match after) | RED — reachability test |

Baseline before any sabotage: 7 tests, 7 pass, 0 fail. Restored: 7/7 green.
Every sabotage left all the explanatory comments in place, so the guards are
demonstrably not passing on their own prose.

SPEC IMPACT: None — the founding-supplier override and its perk were already
decided (owner 2026-06-09); this only adds the missing way to grant it.
