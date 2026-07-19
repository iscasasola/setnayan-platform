## 2026-07-19 · feat(vendor-autoreply): Phase 3b — live inbox hook (flag-dark)

- `lib/vendor-autoreply/inbox-decision.ts` — pure, unit-tested gate for the
  live hook: flag off → never · non-couple sender → never (loop-guard) · no
  config / disabled → never · daily cap reached → never; plus
  `startOfManilaDayIso` (the cap counts the vendor's Manila business day).
- `lib/vendor-autoreply/inbox-hook.ts` — `runVendorAutoReply({ threadId,
  senderRole })`: service-role orchestrator that loads the thread-scoped
  vendor store (services + inclusions/discounts/addons + packages + coverages
  + reviews/stats) and the couple's Event Brief, runs `decideReply()`, posts
  the reply as a `sender_role='vendor'` + `is_bot=true` + `sender_user_id=null`
  chat message, and records a `vendor_bot_replies` row (handoffs log with
  `message_id=null`, no message posted). Entire pipeline fail-closed — a bot
  failure can never block or error the couple's human message. Single-tenant
  isolation: every read keyed to the thread's own vendor/event ids.
- `lib/chat-send.ts` — schedules the hook via `after()` on a successful
  COUPLE insert only, behind `NEXT_PUBLIC_VENDOR_AUTOREPLY_V1` (default OFF =
  zero behavior change).
- `lib/chat.ts` — `ChatMessageRow.is_bot?` + `fetchMessages` selects `is_bot`
  with a graceful-degrade retry (pre-migration DBs keep working).
- `app/_components/chat-message-stream.tsx` — visible "⚡ AI auto-reply" label
  on `is_bot` bubbles for both couple and vendor viewers (§2B AI disclosure;
  exact copy pending §8 sign-off).
- Tests: `inbox-decision.test.ts` + `inbox-hook.test.ts` (canned Supabase
  stub; proves flag-off touches nothing, cap/opt-in gating, the bot write
  shape, and that any pipeline throw resolves instead of propagating).

SPEC IMPACT: Vendor_Front_Desk_Chatbot_Whats_Next §Phase-3b live inbox hook shipped flag-dark.
