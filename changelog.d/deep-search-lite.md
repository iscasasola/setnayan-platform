## 2026-07-03 · feat(admin): deep-search free Lite mode + Haiku default

Owner ask (2026-07-03): "is there no free version?" of the vendor deep-search
dossier, and keep the paid path cheap. Owner decision: build a keyless Lite mode
as the no-key default, gate the AI dossier on `ANTHROPIC_API_KEY`, and default
the paid path to Haiku (~₱9/run) instead of Opus (~₱28/run).

- **Keyless Lite mode (the free, ₱0 default).** When `ANTHROPIC_API_KEY` isn't
  configured, "Run deep search" no longer just fails — `runLiteDeepSearch()`
  fetches the vendor's own website and deterministically extracts the page
  title + meta description, any ₱ / PHP price signals on the page (each with the
  site as source), and the known presence links. No AI, no cost. The admin reads
  and judges (`category_match`/`confidence` stay `unknown`/`low` — no machine
  verdict). Pairs with the always-on Meta Ad Library + Google Ads Transparency
  deep links, which never needed a key.
- **AI dossier gated + defaults to Haiku.** `runDeepSearchOrLite()` picks the AI
  pass only when the key is set; the model default moved from `claude-opus-4-8`
  to `claude-haiku-4-5-20251001`. The row's stored `model` records which ran
  (`lite` vs the model id); the /admin/verify card labels the block
  "Lite · free · no AI" vs "AI-generated" accordingly.
- **Fault-tolerant.** A dead/blocked/timed-out website yields an honest
  empty-but-useful dossier (never throws for a normal miss); 8s fetch timeout,
  HTML-only, 500KB body cap.
- Unit tests: URL normalization, title/description/price extraction (incl.
  ranges, dedup, `₱` entity decode), and the Lite/mode-selection paths
  (9 tests). typecheck + lint + prod build green.

SPEC IMPACT: None. The deep-search feature is an internal admin verification
tool (no public-surface or pricing change); the Lite/paid split and Haiku
default are captured in DECISION_LOG 2026-07-03 and the deep-search memory.
