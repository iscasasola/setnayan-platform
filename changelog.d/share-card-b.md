## 2026-11-18 · feat(brand): the link share card is B — dark, gold mark centred

Owner, 18 Nov: *"Ship B"*, picking from the 15 Nov link share card prototype (`Setnayan/prototypes/link_share_card_options_2026-11-15_fable.html`). He raised it because Google still showed the May card. That card was the live `og:image` on every page, not a stale Google copy.

- New `apps/web/public/brand/og-card-2026-11.png` (1200×630): card B rendered from the prototype unchanged — black ground, gold mark, SETNAYAN, "Plan any event free. Every photo in one album.", setnayan.com. PNG, as the prototype asked, so every app reads it.
- A NEW file name, so Messenger, Facebook and Google re-fetch it instead of keeping a cached copy under the old address. `og-card.webp` (the "Set na 'yan." / "Filipino wedding planning · verified vendors" card) is deleted.
- Every page that named the old card now names the new one (`lib/brand-og.ts`, the root layout, the home page, the studio-app pages, the share-card API fallbacks). The alt text now describes the new pixels, and `type` is `image/png`.

After it is live the owner requests indexing for setnayan.com in Search Console. Google refreshes the picture on its own schedule, usually within days.

SPEC IMPACT: `DECISION_LOG.md` row 2026-11-18 "THE LINK SHARE CARD IS B" (already pushed to the corpus).
