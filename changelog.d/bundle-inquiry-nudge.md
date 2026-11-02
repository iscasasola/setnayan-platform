## 2026-06-20 · feat(inquiry): proactive bundle nudge — "add their other services for one bundle price"

The inquiry composer already let a couple opt into a vendor's other services (`alsoServiceIds` → one thread). This makes it proactive: when a multi-service vendor's "also ask about" section shows, it's reframed as a **bundle ask**, and the couple can request a single combined price — which the vendor sees as an explicit ask.

- **`app/v/[slug]/_components/inquiry-composer.tsx`** — flag-gated (`NEXT_PUBLIC_BUNDLE_NUDGE_ENABLED`): the "also ask about" fieldset gains a callout ("{vendor} also offers these — add any that fit your day and ask for one bundle price"), and once ≥1 extra service is checked, an "Ask {vendor} for one bundle price for everything above" toggle (default on). Flag OFF → today's plain "also ask about" checkboxes, unchanged.
- **`app/v/[slug]/inquiry-actions.ts`** — `startServiceInquiry` gains `requestBundleQuote?`. When set (and ≥1 extra service added), the first inquiry message appends "We'd love to book a few of your services together — could you send us one bundle price?", so the vendor prices the set as one deal. The thread interests already list which services.

Built on the existing `alsoServiceIds` + `recordThreadInterests` + packages plumbing — no schema change, no new tables. Per-couple bundle pricing happens in the quote (the listing-vs-inquiry model). Fit-filtering the cross-sell to the couple's picks + a structured bundle-quote object are noted follow-ups. Flag-gated (default OFF) so merging is inert and the live inquiry composer is unchanged until flipped; wants a couple+vendor smoke-test. tsc clean.

SPEC IMPACT: 0019/0022 inquiry cross-sell + bundle. Logged in `DECISION_LOG.md`.
