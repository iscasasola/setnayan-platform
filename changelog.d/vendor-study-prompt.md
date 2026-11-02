## 2026-07-03 · feat(admin): vendor "study for interview" prompt (free, staff-facing)

Owner ask (2026-07-03): "our staff will get a prompt to study the vendors we
handle so we know if they're fit for us — we'll use this for the interview."
(Vendors only — businesses, not private individuals.)

- **"Copy study prompt (for interview)"** — a second free copy-paste prompt on the
  /admin/verify deep-search block, beside the verification prompt. `buildVendorStudyPrompt`
  produces a staff research brief: what the business is + apparent price tier ·
  quality/reputation signals · strengths · concerns/red flags · a one-line FIT
  VERDICT · and 6–8 tailored INTERVIEW QUESTIONS drawn from what the AI found.
  Includes the Meta/Google ad-transparency links.
- Distinct from the verification dossier: it's a **readable prep brief, not a
  stored JSON dossier** (no schema, no paste-back). Copy → paste into any
  web-browsing AI chat (Gemini/ChatGPT) → read before the interview. ₱0.
- Reuses the shared `resolveDeepSearchInputs` + `adTransparencyLinks`; the two
  prompt buttons share one clipboard/copy handler in the client component.
- Verified: 13 unit tests (study prompt has fit-verdict + interview-questions
  sections and is deliberately NOT a JSON prompt) + typecheck + lint + prod build.

SPEC IMPACT: None (internal admin tool; vendors are public businesses).
