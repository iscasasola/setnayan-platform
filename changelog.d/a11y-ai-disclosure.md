## 2026-06-25 · feat(a11y/honesty): disclose AI-generated content (item 4/4)

Audit of generative-AI surfaces for user-facing AI-content disclosure. Only the
Pakanta song (AI-composed music) was live + undisclosed; the monogram studio is
now deterministic (vector engine, DALL-E removed), SDE is human-crew, reels are
template-driven — none need a disclosure. Fixed:

- New shared `components/AiDisclosure.tsx` — caption/badge that resolves its copy
  INTERNALLY from a `generator` enum, so the brand is always "Setnayan AI" and a
  vendor/model name (Suno/DALL-E/Claude/OpenAI) can NEVER leak into customer copy
  (enforces the CLAUDE.md no-vendor-naming lock in one place; one grep target for
  future generative SKUs).
- `pakanta/page.tsx` — the delivered-song `<audio>` player now renders
  `<AiDisclosure generator="song" />`; the in-production copy now says "being
  composed with Setnayan AI from your story" instead of implying a human team.
- `panood/setup/page.tsx` — the "AI Edited Highlight" blurb said "chosen by
  Claude vision" (a customer-facing vendor-name lock violation) → "chosen by
  Setnayan AI".

Left intentionally: admin-internal copy that names vendors (operational), and the
privacy policy's "Anthropic Console" sub-processor disclosure (correct RA 10173
context). FORWARD GUARD: when the Recraft-backed mood-board AI attire figures go
live (deterministic SVG today), that surface must render `<AiDisclosure
generator="image" />`.

SPEC IMPACT: None — a11y/honesty disclosure + copy lock-compliance, no schema/SKU/pricing/flow change.
