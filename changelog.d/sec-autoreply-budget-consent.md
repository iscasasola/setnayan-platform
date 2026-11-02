## 2026-07-30 · fix(security): the vendor auto-reply reconstructed the couple's EXACT budget past a default-off opt-in

`SECURITY_HANDOFF_2026-07-26.md` §4 "SEC-2b residue", item 1 — and the shape is
worse than the handoff recorded.

`EventBriefLite` — the payload the vendor auto-reply engine reads — carried
**both `pax` and `budgetPerHeadPhp`**. Per-head × pax **is** the exact figure: on
the live event, ₱2,250,000 to the peso. It was derived straight from
`events.estimated_budget_centavos` in `toEventBriefLite`, with **no
`share_budget_band` check anywhere in `lib/vendor-autoreply/`**.

The opt-in it bypassed governs `public.get_vendor_event_brief`, whose own header
is explicit: shown as a **RANGE**, *"never an exact number"*, and only when the
couple has an allocation **for the calling vendor's category**. This TypeScript
lane honoured **none of the three**. Both prod events have
`share_budget_band = false`.

- **`types.ts`** — `budgetPerHeadPhp: number | null` is **replaced** by
  `budgetBand: string | null` (the coarse band, e.g. `'premium'`). The type now
  has nowhere to put a figure, which is the point: the old field was read by **no
  template**, i.e. a loaded gun — the first auto-reply that wanted to mention
  budget would have leaked the exact number with nothing in review flagging it,
  because the value was already sitting in the payload looking legitimate.
- **`adapter.ts`** — `toEventBriefLite(brief, consent)` takes the opt-in as a
  **required** argument, not an option with a default: a caller that forgets it
  is a **TypeScript error**, never a silent opt-in. Consent off → `null`;
  consent on → the coarse band only.
- **`inbox-hook.ts`** — reads `share_budget_band` off the same `select('*')` row
  and passes it explicitly, with `=== true` so a pre-migration row stays on the
  closed side rather than inheriting a truthy `undefined`.
- **Tests.** `adapter.test.ts`'s existing case **asserted the leak**
  (`budgetPerHeadPhp === 3000` beside `pax: 150` = ₱450,000); it now asserts the
  consent-off silence, plus the per-head key is `undefined` anywhere on the
  payload. Two new cases: consent-on shares the word and **no centavos or
  per-head figure survives serialisation**, and a **source guard** — the adapter
  may not reference `perHeadCentavos` or `amountCentavos`, and the consent
  argument must stay required.

Full unit suite green, `tsc --noEmit` clean.

SPEC IMPACT: None on decisions — this enforces the existing owner-approved
2026-07-03 opt-in (`20270508637171_customer_card_budget_band.sql`) on a code path
that had been ignoring it. Logged in `DECISION_LOG.md`; the handoff's §4 item is
marked fixed.
