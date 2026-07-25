## 2026-07-25 · feat(vendor-ai): ADVANCED voice-match via precompute — the first real Advanced capability (flag-dark)

The Vendor AI **Advanced** rung existed but granted nothing (level marker `vendor_profiles.ai_addon_level`, `lib/vendor-ai-level.ts`, SKU `vendor_ai_addon_advanced` seeded `is_active=false`). This ships its headline capability — **voice-match** — behind a NEW flag `NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH` (default OFF). Flag off = byte-identical to today: zero extra queries, zero column names, the neutral house-voice reply unchanged.

**The load-bearing constraint: per-reply marginal cost stays ₱0.** A model call per reply is forbidden ("Setnayan AI is deterministic and free"). The design makes that structural rather than a rule to remember:

- A phrasing is an **ENVELOPE**, never an answer — `"<greeting> <lead-in> {{answer}} <signoff>"`. The `{{answer}}` slot is filled at reply time by the existing deterministic `buildAnswer()` output, whose every number comes from a live vendor row. Voice is precomputed; facts are resolved live; the reply path is a string substitution.
- **No model call anywhere** — not even in the precompute. Derivation is by COUNTING (honorific rate, emoji density, Tagalog/Cebuano marker ratio, message length, most-used opener/closer), so the precompute is ₱0 too, reproducible, and auditable — which is what makes the "view & edit your voice" panel honest.

**New (all pure, `tsx --test`-able — no env, no clock, no I/O):**
- `lib/vendor-voice-profile.ts` — the § 6 schema + total coercion + form parse. `sanitizeVoiceFragment` rejects digits, ₱, `@` and URLs in a greeting/sign-off: a voice fragment is DECORATION, never data, so it cannot smuggle a price/date/phone into a bot message or route a couple off-platform.
- `lib/vendor-voice-derive.ts` — derives a profile from the vendor's own replies. **Closed vocabulary**: greeting/sign-off are chosen from a fixed list, never copied from a message, so a past customer's name or number can never be quoted back to a different couple.
- `lib/vendor-autoreply/phrasings.ts` — the precompute combinator + deterministic FNV-1a rotation + `assertFactFree` (exactly one slot; no digit/₱/@/URL in the decoration). Lead-ins and effusive closers are **per `language_mix`** (english · taglish_light · taglish_heavy · cebuano), so the § 6 language field is load-bearing rather than decorative — a vendor who picks Cebuano sees Cebuano move in the preview. `po` is deliberately kept OUT of every lead-in/closer: honorifics apply only to the greeting and sign-off, so baking it in would contradict a vendor who turned honorifics off. Unknown/future language values fall back to English rather than dropping the lead-in.
- `lib/vendor-autoreply/voice-serve.ts` — **THE gate**: flag → Advanced entitlement → `mode==='smart'` → a usable phrasing. Every failure degrades to the neutral answer, never to silence, and an over-long voiced reply falls back rather than truncating (a cut mid-number turns a correct quote into a wrong one).
- `lib/vendor-autoreply/{voice-runtime,precompute,voice-learning}.ts` — the thin I/O layers.

**⚠ `vendor_bot_config.mode` is a PREFERENCE, not the entitlement.** It is vendor-writable under `vendor_bot_config_write`, so trusting it would let any vendor self-grant Advanced. Serving gates on `vendorAiAdvancedActive` (level marker AND live `ai_addon_expires_at` window) FIRST; `mode` can only ever decline voice-match, never grant it. Pinned by tests over every (level × window × mode) combination.

**Isolation (§ 2A):** derivation reads `chat_messages` with three mandatory predicates — this vendor's `vendor_profile_id`, `sender_role='vendor'`, `is_bot=false` — never a couple's text, never another vendor's, never the bot's own output. It runs on the vendor's **authenticated** client so `chat_messages_member_read` RLS re-asserts the same scope. The § 7B `learn_from_past_messages` opt-out is honoured, and the derived profile is a **proposal the vendor approves**, never auto-applied.

**Surface:** My Shop → "Your voice" (`_components/voice-match-card.tsx` + `voice-match-section.tsx`, self-gating on the flag) — learn / edit / preview / save. The preview renders through the *same* pure functions the server precomputes with. `ai_addon_level` and the voice columns are named ONLY inside their flags (a `select` on an unmigrated column answers 42703 and nulls the whole row).

**Still AI-labelled.** A voiced reply is inserted with `is_bot: true` exactly as before, so `chat-message-stream.tsx` keeps rendering the `⚡ AI auto-reply · [Business]` tag. Voice-match changes the *tone*, never the disclosure — an unlabelled voice-matched reply would be impersonation (§ 2B).

**Not built here (Advanced remains partly an empty rung):** reply in the *couple's* language (auto-detect — distinct from the vendor's own `language_mix` shipped here), lead analytics, and the higher/uncapped daily cap. The § 7A Deep Search enrichment is untouched.

No migration — `vendor_bot_config.voice_profile` / `vendor_reply_templates` already exist (20270822679405). Tests: 4 new files (95 cases incl. the no-facts invariant over every profile × intent, flag-OFF byte-identity over every state, and language-mix being load-bearing) + 4 added to `config.test.ts`. Typecheck clean; full unit suite green (3426).

**Deviation to flag for owner sign-off:** § 7 describes phrasings per *(intent × service/package)*; because the envelope carries no facts it stays correct across catalog edits, so rows are stored **per-intent** (`service_id`/`package_id` NULL) and only a VOICE edit regenerates. This removes a whole class of staleness bug (a precomputed phrasing quoting last month's price) by construction, and means no cross-track hook into the catalog-edit path is needed.

SPEC IMPACT: `Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md` §§ 6/7 — voice-match is implemented DETERMINISTICALLY (no LLM at derive or serve time), and the precompute is keyed per-intent rather than per (intent × service/package); § 7's "a one-time LLM pass generates ~15–20 natural phrasings" is superseded by a pure combinator. No pricing change, no schema change, no SKU activated.
