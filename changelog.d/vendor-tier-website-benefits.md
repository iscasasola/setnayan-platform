## 2026-07-03 · docs(vendor-tiers): state the website (public-page) benefits per tier

The website tier ladder shipped (#2653/#2658/#2661/#2672/#2700/#2708) but the
vendor-facing tier comparison didn't spell out what each tier gets for its public
page. Added a clear website line to every tier in the "For vendors" overlay data
(`vendor-benefits.ts`):

- **Free · Verified → Listed:** auto-built, search-ready public page.
- **Solo → Personalized:** About · accent · featured services · section toggles.
- **Pro → Premium:** 2-column layout + sticky Inquire rail · custom URL · hero · pinned review · featured Real Stories.
- **Enterprise → Flagship:** cinematic hero · "Films" YouTube video portfolio.

Also documented the as-built website ladder in `VENDOR_TIERS_AND_BENEFITS.md` §5.

SPEC IMPACT: documents (not changes) the shipped website tier gating. No code
behavior/schema/pricing change. Logged in DECISION_LOG.md.
