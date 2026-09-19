## 2026-09-19 · fix(chat): "Send a deal" waits for a quote — the supplier's 🧾 sends the first quote

Owner live test: as the supplier, the composer's 🧾 icon opened "Deal or
meeting → Send a deal" — the AMENDMENT builder, first line "Freebie" — when he
wanted to send a first quote ("deal doesn't look like a proposal?"). On the
couple's side, a "🧾 Send a deal" chip rendered under the couple's own opening
inquiry before any quote existed. A Deal amends a quote; with none there is
nothing to amend.

One pure decision, `dealEntryFor({ side, hasQuote })` in
`apps/web/lib/deal-entry.ts`, imported by both thread pages. `hasQuote` is
`threadHasQuote({ stage, liveQuoteTotalPhp })`, built from the pipeline rung and
the live quote total both pages already read. No new query (the supplier page's
two reads moved above its tool panels).

- Supplier, no quote yet: the composer 🧾 reads "Send a quote" and opens
  `#build-quote`, the one quote tool. The Deal-or-meeting panel, still reachable
  from the rail, offers "Send a quote" first and "Request a meeting". It does
  not offer "Send a deal".
- Couple, no quote yet: no "Send a deal" in the menu and no chip under a
  message. The 🧾 is labelled "Request a meeting". A `?compose=deal` link lands
  on the menu, not on an amendment builder over nothing.
- Once a quote exists, or a booking stands: unchanged on both sides.

This honours the council verdict (`Negotiation_Exchange_Council_Verdict_2026-07-24.md`).
Both of the owner's entry points stay, the "+" and the auto-suggest chip, and
Meeting stays. The Deal is "current total → changes → new total", so it now
waits for a current total. Still behind `NEXT_PUBLIC_CHAT_NEGOTIATION_V1`.

Guarded by `apps/web/lib/deal-waits-for-a-quote.test.ts`, which executes the
helper (both sides × quote / no quote, and every rung) and pins the menu, the
composer icon and the stream on both pages to it. Each assertion was sabotaged
once and went red.

SPEC IMPACT: None. The change applies the council verdict's own definition of a Deal, and no decision changed.
