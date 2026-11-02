## 2026-07-18 · feat(vendor-autoreply): Phase 1 schema + RLS + flag for the Auto-Reply Assistant

Foundation for the vendor AI Auto-Reply Assistant ("BotCake, no flows" — full plan
at ~/Documents/Claude/Projects/Setnayan/Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md).
Schema-first, behind a default-off flag; **no behaviour ships in this PR.**

- **New tables** (`20270822679405_vendor_autoreply_v1_schema.sql`), RLS enabled at `CREATE TABLE`,
  every table vendor-scoped via `current_vendor_ids(...)` + `is_admin()` (data-isolation lock §2A):
  - `vendor_bot_config` — per-vendor settings: `enabled`, `mode` (free/smart), `daily_reply_cap`,
    `voice_profile`, `auto_accept_enabled`/`auto_accept_threshold` (default 78) /`daily_auto_accept_cap`,
    `reply_in_couple_language`, `learn_from_past_messages` (voice opt-out).
  - `vendor_reply_templates` — precomputed voice phrasings per intent×service (Pro; server-written).
  - `vendor_bot_replies` — activity log (`intent`, `confidence`, `action`, `was_llm`, `compat_score`)
    for the daily cap + analytics; 12-month detail retention (later phase).
- **New columns**: `chat_messages.is_bot` (AI-disclosure label §2B), `chat_threads.compat_score_at_inquiry`
  + `compat_reasons` (compatibility auto-accept snapshot §4A).
- **Flag** `NEXT_PUBLIC_VENDOR_AUTOREPLY_V1` (`apps/web/lib/vendor-autoreply-flag.ts`), default OFF.

Ledgers reused (not created) by later phases: `lead_token_holds` + `unlock_vendor_event_hold` /
`consume_lead_token_hold` / `release_lead_token_hold` (auto-accept token hold/settle/refund),
`get_lead_trust_flags` (fake-flag exclusion), `vendor_web_dossiers` (Deep Search).

SPEC IMPACT: None — implements Phase 1 of the existing build plan (corpus §10/§13). Open items still
flagged in the plan: the couple-faith consumption (§7C) awaits DPO/counsel review and stays flag-gated.
