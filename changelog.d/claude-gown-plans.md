### Attire Maker: a monthly plan for gown designers, with a 30-day free trial (owner 2026-11-28)

- **Who:** only a supplier with a custom gown design service card. Never sold to hosts or guests. It no longer needs a Plus, Pro or Ultra plan, and is no longer a one-time Toolkit buy (the one-time row is retired; it was never bought).
- **Trial:** 30 days free from the shop's first open of the Attire Maker. No card, no limit, once per shop.
- **Use and save (monthly):** her clients, their measurements, their designs and every record kept.
- **Full (monthly):** everything in Use and save, plus pattern templates, full-size printing and the plotter sheet, and the gown quotation (the costing, her estimate and the Make-a-quote pre-fill). On Use and save she can still quote by hand with the chat's quote card; brides see "Ask for a quote" instead of an estimate.
- **Paused:** when the trial or a plan ends, her clients, designs, numbers and the order sheet stay readable. Nothing new is made until she picks a plan.
- **Paying:** the panel shows where she stands ("Free trial · 22 days left") and the two plans, priced from the catalog. One press goes to the shipped checkout. Each approved month adds 30 days, stacking on what is left; a refund winds 30 days back.
- **Under the hood:** one rule set (`lib/gown-plan.ts`) asked by the server before every Attire Maker action. A new server-written table, `vendor_gown_plans` (the trial start and the plan; the shop reads its own, nobody writes it). Two catalog rows.

SPEC IMPACT: The owner's pricing decision of 2026-11-28 (DECISION_LOG "Attire Maker plans", recorded by the coordinator). No other spec change.
