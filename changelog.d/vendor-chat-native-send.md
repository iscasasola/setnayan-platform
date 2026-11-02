## 2026-06-29 · feat(api): native-facing vendor chat send endpoints (reuse web gating)

Thin JSON endpoints so the Expo vendor app can SEND in vendor↔couple chat without re-implementing any gating natively (the Papic-gallery reuse pattern). Each authenticates with the vendor's Supabase session bearer token and runs the SAME core the web server action runs, under the caller's RLS:

- `POST /api/vendor/chat/[threadId]/send` — plain-text reply. Reuses the new `sendChatMessageCore` (lib/chat-send.ts), extracted verbatim from `sendChatMessage` so the accept-gate, the couple one-follow-up rule, the FREE-vendor tier gate (`tierCaps().chat === 'none'`), the first-reply stamp, and the notify fan-out are single-sourced. The web action is now a thin FormData→core→redirect wrapper.
- `POST /api/vendor/chat/[threadId]/offer-service` — vendor inverse cross-sell. Reuses `offerServiceCore` (lib/offer-service-core.ts), extracted from the collocated `offerServiceInterest` action (ownership + active-service check + couple notify). Metadata only — never touches the token/accept flow.
- `POST /api/vendor/chat/[threadId]/proposal` — in-chat proposal / quote (a priced proposal is a quote). Reuses `sendProposalCore` (lib/proposal-send.ts), extracted from `sendProposalFromChat` (ownership + accepted-thread gating + draft→sent freeze + supersede-prior). Acceptance still flows through the DB-guarded `respond_vendor_proposal` RPC; no price is written here.
- `GET /api/vendor/chat/[threadId]/compose-options` — the vendor's proposal templates + packages + offerable services (active minus already-on-thread) + the thread's accepted flag, mirroring what the web thread page computes server-side.
- New shared helper `lib/api/vendor-bearer.ts` (`authVendorBearer`) — bearer-token → RLS-scoped client, factored from the papic-gallery route's inline pattern.

The three web server actions keep their exact external behavior (same thrown messages / redirect notices); only the gating moved into client-agnostic cores. Native consumers live in the separate `~/Setnayan-Native` repo (Phase 1 vendor send + custom-keyboard quick-action row).

SPEC IMPACT: None. No schema, no pricing, no SKU change — additive native-facing API surface over existing vendor-chat gating. The native Expo app remains out-of-repo (logged in DECISION_LOG + `project_setnayan_native_app` memory).
