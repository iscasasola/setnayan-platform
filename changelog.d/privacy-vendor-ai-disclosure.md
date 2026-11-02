## 2026-07-22 · docs(privacy): public /privacy disclosure for Vendor AI + Deep Search

Adds two forward-looking sections to the public `/privacy` notice — the
transparency artifact required before the two `vendor_ai_autoreply` /
`vendor_deep_search` data-privacy controls can be activated:

- **"Vendor AI assistant (automated replies)"** — discloses that a vendor may
  enable a paid assistant that reads that thread's messages + the couple's event
  brief to answer (and optionally accept) automatically; AI-labelled,
  deterministic, single-tenant, SPI-free; RA 10173 §34/§16(c) right to object +
  reach-a-human.
- **"Vendor Deep Search (vendor business research)"** — discloses vendor-initiated
  public-web research via the Anthropic web-search subprocessor, the
  "no guest/personal data sent" boundary, incidental-public-PII minimisation, and
  the 180-day dossier retention.
- Extends the `Anthropic` subprocessor line to name the AI web-research capability.

SPEC IMPACT: New corpus doc `NPC_Vendor_AI_and_Deep_Search_Processing_Addendum_2026-07-22.md`
(RoPA rows R-16/R-17 + DPIA lines, filing-ready). Per the coordinator precedent,
`lib/privacy-coverage.ts` `declaredIn` stays `[]` (coverage panel RED) until
counsel folds R-16/R-17 into the filed RoPA/DPIA; the two controls stay INACTIVE
until DPO sign-off. This PR is DRAFT notice wording for counsel review — no
control is activated by it.
