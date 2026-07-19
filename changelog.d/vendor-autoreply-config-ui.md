## 2026-07-19 · feat(vendor-autoreply): Phase 4 — My Shop Auto-Reply Assistant config card (flag-dark)

- New "Auto-Reply Assistant" section on My Shop (`/vendor-dashboard/shop`, under Services, anchor `#auto-reply`), rendered ONLY behind `NEXT_PUBLIC_VENDOR_AUTOREPLY_V1` — flag-off/absent = today's page exactly.
- Card (WebsiteEditor idiom): instant optimistic enable/disable switch, dirty-save daily reply cap (0–200, whole numbers), and a STATIC explainer mirroring the deterministic engine's real intent set — what it answers (price/availability/inclusions/coverage/lead-time/discounts/reviews) vs. what it hands to the vendor (customization/booking/low-confidence/no-data), plus the §2B AI-label + §2A own-catalog-only disclosures.
- Server action `updateAutoReplyConfig` (non-redirecting, `useActionState`-shaped) partial-upserts `vendor_bot_config` under RLS `current_vendor_ids('admin')` — RLS refusal maps to a friendly "only shop admins" message; the action itself also refuses while the flag is off.
- Pure form validation split into `lib/vendor-autoreply/config.ts` + unit tests (16 cases: bounds, negatives/decimals/exponents, partial patches, unknown-field ignore, empty form).
- Scope held to columns that exist: the Phase-1 schema carries NO greeting/handoff copy columns, and the Pro columns (`mode`, `voice_profile`, `auto_accept_*`) wait for Phase 5/7 — no fake doors.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/Vendor_Front_Desk_Chatbot_Whats_Next_2026-07-18.md` §Phase-4 — config UI shipped flag-dark (enable toggle + daily cap + static explainer on My Shop; voice/auto-accept/Sources-&-Data surfaces remain for Phase 5/7).
