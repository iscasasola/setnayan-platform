## 2026-07-10 · fix(seo): verification meta, canonical-fallback alignment, sitemap orphans, /tl OG

Technical-SEO gap-closing pass surfaced by the 2026-07-10 SEO/GEO audit. The
foundation (5-sitemap index, AI-aware robots, rich JSON-LD, llms.txt) was
already solid; this fixes specific mechanical gaps.

- **Search-engine verification** — added `verification: { google, other:
  { 'msvalidate.01' } }` to `app/layout.tsx` `baseMetadata`, reading
  `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` / `NEXT_PUBLIC_BING_SITE_VERIFICATION`.
  Inert until the owner pastes the tokens into Vercel env (no code redeploy
  needed); when unset Next emits no meta tag. Unblocks Google Search Console
  (feeds Google AI Overviews) + Bing Webmaster (feeds Copilot) property
  verification. Documented in `.env.example`.
- **Canonical/sitemap host mismatch** — `app/robots.ts` and all six
  `sitemap*.xml/route.ts` files fell back to
  `https://setnayan-platform-web.vercel.app` when `NEXT_PUBLIC_APP_URL` is
  unset, while page metadata falls back to `https://www.setnayan.com`. If the
  env var ever went missing, canonicals and the advertised sitemap URLs would
  point at different hosts. Aligned every fallback to `https://www.setnayan.com`.
- **Sitemap orphans** — `/explore/compare` (vendor comparison) and `/open-shop`
  (vendor onboarding) are indexable but were in no sitemap. Added to
  `sitemap-static.xml` with honest lastmod. (`/alaala` intentionally left out —
  its Life-Flash feature is flag-off in prod; not indexing an unshipped feature.)
- **`/tl/how-it-works` OpenGraph** — the one marketing route missing `openGraph`
  (its EN twin has it), so chat/social unfurlers fell back to the generic site
  card. Added with `tl_PH` locale, mirroring the EN page.

SPEC IMPACT: None (technical SEO plumbing; no SKU / schema / pricing / branding
change). Owner action to fully realize: paste GSC + Bing verification tokens
into Vercel env.
