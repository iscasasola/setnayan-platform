## 2026-06-25 · feat(dashboard): Phase-C entrance — couple Galleries source list

Wrapped the below-the-fold gallery-source card list on `apps/web/app/dashboard/[eventId]/galleries/page.tsx` in the shared `RevealList` (`as="div"`) and marked each `<article>` card with `data-reveal-item`, giving the source cards the quiet Phase-C staggered settle. The header (eyebrow + h1 + lede) stays static as the fold; page.tsx stays a Server Component.

SPEC IMPACT: None
