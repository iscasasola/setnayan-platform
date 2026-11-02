## 2026-07-03 · feat(admin): vendor deep-search analytics on the verification queue

Owner ask: "Once they give us their soc med and website, can we have the deep
search analytics that would show us what their business is, what they serve,
the prices they have on the web … search their ads and posts across the
internet?"

- **"Run deep search" on every /admin/verify application card** — a server
  action runs a live web research pass (Claude Opus 4.8 + the `web_search`
  server tool, first Claude API integration in this repo) over the vendor's
  website + social link + shop name + location and stores a structured
  dossier: business summary, detected services, **published prices with
  source URLs**, web presence, ads findings, and consistency flags vs. the
  claimed category (match / partial / mismatch badge).
- **Ad transparency deep links** — every card links straight into Meta Ad
  Library (FB + IG ads) and Google Ads Transparency Center pre-filtered to
  the vendor's name — the public, login-free way to "search their ads"
  (FB/IG post content itself is login-walled; the dossier reads what's
  publicly reachable and says so).
- **New table `vendor_web_dossiers`** (migration 20270505500000, applied to
  prod) — admin-only RLS in all four directions; keeps a run ledger
  (running / complete / failed with the error surfaced on the card);
  snapshots the searched inputs. No public_id (letters A–Z exhausted).
- New dep `@anthropic-ai/sdk`; new env `ANTHROPIC_API_KEY` (in .env.example —
  owner must add it to Vercel for the button to work; missing key fails
  gracefully with a clear message). `/admin/verify` sets `maxDuration = 300`
  for the research pass.

SPEC IMPACT: DECISION_LOG.md row (corpus) — deep-search due-diligence added to
the vendor verification review; 0023 admin-console archive stub untouched per
the de-drift policy.
