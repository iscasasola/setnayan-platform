## 2026-07-03 · feat(admin): deep-search "run it in your own AI chat" — free, zero-cost tier

Owner ask (2026-07-03): "can we make a prompt to copy and send to Google AI or
any AI chat, so our deep search about them can be free?"

- **Copy prompt for your AI chat** — a new button on every /admin/verify
  application card generates a fully self-contained research prompt with the
  vendor's facts baked in (name · claimed services · location · website · social),
  the Meta Ad Library + Google Ads Transparency links, and the exact JSON schema
  the dossier uses. The admin pastes it into Gemini / ChatGPT / Copilot — which
  does the web research for free — with no API key and no per-run cost.
- **Paste the result back** — a paste box + `saveManualDossierAction` runs the
  chat's reply through the SAME `parseDossierText` the API path uses and stores it
  as a completed dossier tagged `model = 'manual-chat'`, so it renders identically
  to Lite/AI dossiers.
- This is the third, ₱0 research tier alongside **Lite** (keyless website fetch)
  and the **AI dossier** (paid API, Haiku default). The prompt and the API share
  one `DOSSIER_JSON_SCHEMA_BLOCK` constant so they can never drift.
- Refactor: vendor-input resolution extracted to a shared `resolveDeepSearchInputs`
  helper (used by the run, copy-prompt, and paste-back actions).
- Verified: 12 unit tests (prompt bakes in vendor/ad-links/schema · round-trips
  through parseDossierText · bare-vendor case) + typecheck + lint + full prod build.
  Internal admin tool behind auth — not preview-verifiable without seeded data.

SPEC IMPACT: None (internal admin verification tool).
