## 2026-07-02 · feat(marketing): Setnayan AI copy → the monitoring-engine positioning (GTM framework)

Applies `Setnayan_AI_GTM_Content_2026-07-02.md` — shifts the public Setnayan AI copy from the old
"finds your fit / matchmaking" framing to the **monitoring-engine** positioning ("it doesn't chat,
it watches"), obeying the framework's honesty guardrails.

- `/setnayan-ai` page (`page.tsx` + `_setnayan-ai-motion.tsx`): new hero ("It doesn't chat. It
  watches your wedding for you."), monitoring-first subhead, the "a chatbot waits, Setnayan AI
  watches" comparison, a watch-focused how-it-works, "let it watch your back" CTA, and refreshed
  metadata + SoftwareApplication JSON-LD featureList. FAQ reworked to the watch framing + a
  "will it spam me?" (restraint) answer + a **future-tense "coming soon"** answer for the dormant
  personalization/cohort layers (never presented as live). Accuracy guardrail comment updated.
- `/pricing` Setnayan AI card: value line → "the paid brain that watches your vendors so you don't
  have to… flags a deposit, a price change, or a clash before it costs you," + all-events + 0%
  commission.

Guardrails honored: shipped-only features live (Inference/Trend only as "coming"); no tech named;
no fake urgency; free-floor + 0% commission preserved; prices stay catalog-driven (no hardcode).
Pop-up overlay is the remaining GTM surface (separate PR — it needs a new glass-nav overlay).

SPEC IMPACT: None — marketing copy to the recorded GTM framework (DECISION_LOG 2026-07-02).
