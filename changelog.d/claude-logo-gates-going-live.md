## 2026-11-06 · fix(supplier-setup): the logo gates going live, not the shop pages

Owner, verbatim, 2026-11-06: *"Yes, logo gates live."* A brand-new shop with no logo was held by the basic-setup
hold ("Finish your basic setup first · Left: Logo.") on the Shop tab and on `/vendor-dashboard/services/new`, so it
could not make its first service card.

- `lib/basic-setup-gate.ts` — `basicSetupHoldOf` no longer counts the logo (`NOT_A_HOLD`). A shop whose ONLY missing
  item is the logo is not held anywhere; any other missing item holds exactly as before, and the hold's line no
  longer names the logo ("Left: Company address." instead of "Left: Logo · Company address.").
- Unchanged: `businessProfileChecklist` still counts the logo, so `verificationSubmitMissing`
  (`lib/vendor-verification.ts`, via `profileComplete: profileChecklist.complete`) still refuses going live with
  "Add your logo"; Today keeps its "Add your logo — needed to go live" step; publish rules untouched.
- `lib/basic-setup-gate.test.ts` — the old "Left: Logo · Company address." pin retargeted; new cases: only the logo
  missing → not held (Shop, New service, Your page all open); contact number missing → held; and a guard that going
  live still reads the whole checklist including the logo.

SPEC IMPACT: DECISION_LOG row already recorded in the specs repo ("THE LOGO GATES GOING LIVE, NOT THE SHOP PAGES",
2026-11-06). No further corpus edit.
