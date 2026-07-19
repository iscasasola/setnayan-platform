## 2026-06-20 · feat(marketing): public-surface positioning pass — lead with the media layer (SEO + GEO)

Acts on the demand-research verdict: the SEO/GEO plumbing was strong, but the human-visible surface didn't lead with the proven differentiators (Papic + Setnayan AI). Consolidates the public-surface pass (originally stacked PRs #1881/#1883/#1884/#1888, which stalled on `CHANGELOG.md` conflicts — moved here per the `changelog.d/` system).

- **`/papic`** — new server-static landing page for the guest photo-gallery differentiator. Benefits-only copy, no hardcoded price (links to `/pricing`). `SoftwareApplication` + `FAQPage` JSON-LD. Registered in `NAV_ROUTES` + sitemap (0.8).
- **`/setnayan-ai`** — new landing page for the planning-intelligence differentiator. Accuracy guardrail honored: "matchmaking, not a chatbot" (deterministic, not an LLM). `NAV_ROUTES` + sitemap (0.8).
- **`/why-setnayan`** — new comparison/GEO page ("three apps in one"); non-disparaging, names no competitor. `WebPage` + `FAQPage` JSON-LD. `NAV_ROUTES` + sitemap (0.7).
- **SEO plumbing** — `/our-story` + `/monogram` added to `sitemap-static` (were in no sitemap); `/explore/compare` metadata completed (canonical + `openGraph`).

Not built locally (pnpm worktree node_modules); required CI + Vercel previews are the surface.

SPEC IMPACT: None (new public marketing pages + SEO metadata; no SKU / schema / pricing / branding change).
