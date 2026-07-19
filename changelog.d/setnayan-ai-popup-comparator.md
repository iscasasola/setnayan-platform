## 2026-07-03 · feat(marketing): Setnayan AI pop-up = the interactive savings comparator

Owner 2026-07-03: "the widget you showed is the pop up. the text on hero is the benefits." The
hero story keeps the benefits; the nav pop-up becomes the burden-and-cost comparison:

- **"My wedding is in N months" slider** (1–24) + three compare modes — *vs hiring it* (2–3
  person team, ₱50,000+/mo, labeled typical-PH-rates/illustrative) · *vs other AI apps*
  (₱2,900/mo top of range, category-level only — no named competitor) · *vs doing it yourself*
  (25–50 hrs/month, shown as hours returned).
- A live "**you save ₱X**" line + bars drawn to honest scale. Setnayan's side computes
  `intro + regular × (months − 1)` from **raw catalog prices** — `PricingData` gains
  `aiRegularPhp`/`aiIntroPhp` (pricing-data.ts) so the client math is never re-hardcoded.
- Jobs list removed from the pop-up (benefits live on the hero per the owner split). CTAs kept.
- **Scroll contract:** desktop fits with no scroll (card ~586px @ 900px viewport); mobile scrolls
  via the existing overlay wrapper (verified at 375×812).

Verified live in a local preview: default 12-month state saves ₱590,712 vs a team; at 24 months
₱1,181,124 / ₱50,724 (apps) / 600–1,200 hours (DIY) — all matching the math by hand. Radius lint
clean (the one advisory hit is a pre-existing vendor-dashboard file from another workstream).

SPEC IMPACT: None new — implements the comparator strategy the owner approved in-session; cost
anchors remain labeled illustrative (GTM guardrail 4 amended by owner direction: anchors now
appear in the pop-up).
