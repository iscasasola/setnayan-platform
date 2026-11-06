## 2026-11-06 · feat(seo): be findable by AI — let Gemini read our public pages

Owner, 2026-11-02 ("add this to our queue", DECISION_LOG row "BE FINDABLE BY AI: LET GEMINI READ OUR PUBLIC PAGES").

- `apps/web/app/robots.ts`: `Google-Extended` moves OFF the blocked training list into its own explicit group with exactly the `*` rule (same public allow list, same private + query disallows), so Gemini may read the public pages. GPTBot, Applebot-Extended, Amazonbot, cohere-ai, Bytespider and Diffbot stay `Disallow: /`. The answer-engine list (ChatGPT-User, OAI-SearchBot, PerplexityBot, ClaudeBot) is unchanged.
- Sitemap checked, no gaps found: home, /explore, /for-suppliers, /creators (static) · /help + articles (help) · /realstories + consent-gated public Event Hubs (weddings) · /tl/about, /tl/features (static) + every /tl/features/<slug> twin (features) · published, verified, non-demo shops (vendors). No sitemap change.
- New guard `apps/web/app/robots-lets-gemini-read.test.ts`: pins Google-Extended allowed (and still kept out of signed-in surfaces, identical to `*`), the six scrapers blocked, the answer engines unchanged, and that robots.txt names `/sitemap.xml`, which exists, and every child the index lists has a route handler (and every `sitemap-*.xml` route is listed). Sabotage-checked: re-blocking Google-Extended fails it.
- `app/features/features-tagging.test.ts`: Google-Extended dropped from its "stays blocked" list.

SPEC IMPACT: `02_Specifications/17_SEO_and_AI_Discoverability_Playbook.md` (+ `.docx`) §8 posture, §8.1 table and §8.2 robots block amended for the Google-Extended exception — specs commit 474fc692. The DECISION_LOG row already existed (2026-11-02).
