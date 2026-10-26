## 2026-10-26 · feat(setnayan-ai): Setnayan AI is offered only when the event has Suppliers on

Owner, verbatim: *"so when suppliers are deactivated on the event to be created, Setnayan AI does not need
to show."* — and *"it is based on the onboarding"*. One predicate, `setnayanAiOffered(needs)` in
`lib/setnayan-ai.ts`, over the onboarding's "What do you need?" Suppliers row (live in the create flow,
`events.suppliers_on` after it; NULL = never asked = on). Every offer site calls it:

- **Create flows** — the services step's Setnayan AI card, tick and total line (`services-step.tsx`
  `suppliersOn`); the simple flow feeds it live from the needs screen through `SimpleSuppliersOnContext`,
  the generic wizard from its `needs` state. Both commits (`simple/actions.ts`, `_shared/commit-event.ts`)
  drop an AI pick made on a Suppliers-off draft. The wedding has no Suppliers choice and is unchanged.
- **After creation** — Home's comeback card, Next card and "Your services" Setnayan AI row
  (`dashboard/[eventId]/page.tsx`, `home-first-screen.ts` `ai: null`); the Setnayan AI page's buy state
  (one plain line instead, no redirect); the Suppliers page's Unlock banner; the free venue-shortlist upsell.
- An event that already OWNS Setnayan AI (bought, or a payment waiting) keeps every row and state as before.

Held by `apps/web/lib/setnayan-ai-needs-suppliers.test.ts` (named offer sites + a discovery sweep).

SPEC IMPACT: None new — implements corpus DECISION_LOG 2026-10-26 "SETNAYAN AI SHOWS ONLY WHEN THE EVENT HAS SUPPLIERS ON" (already recorded).
