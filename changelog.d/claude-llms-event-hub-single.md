## 2026-11-24 · fix(llms): llms.txt sells the Event Hub single, after the plans

The AO batch (migration 20271359355225, now live) put a new **Event Hub** single on sale: the whole Hub for one event, with no Papic credits. Source: specs DECISION_LOG 2026-11-23 "EVENT PLANS ARE PACKAGES; SINGLES ARE THE SECOND CHOICE" ("Event Hub unlock 2790"). `llms.txt` did not name it. Same treatment as Setnayan AI:

- `EVENT_HUB` joins `REQUIRED_RETAIL`, and its fixture row joins `llms-txt-guard-input.ts`. The price is read from the catalog row, never typed.
- The planning tiers keep the plans first. One line under them names the single: "The whole Event Hub (every theme, every part to design) comes with every plan, and is also sold on its own at … one-time per event, without Papic credits."
- The Event Hub line and its FAQ answer ("Is Setnayan free?") no longer say only Event Pro designs it. Every plan does since 20 Nov (`eventHubOwnership`), and so does the single.
- Guard: `llms-txt.test.ts` holds the single by name beside its catalog price, after the plans. It must be by name, because the figure equals Setnayan AI's, so the "every active price is quoted" test alone cannot see the line go missing. It also holds that the "only Event Pro" wording stays gone. Two sabotages seen red.

SPEC IMPACT: None. This describes the 23 Nov ruling as it is.
