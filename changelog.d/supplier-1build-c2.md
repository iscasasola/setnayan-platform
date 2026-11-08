## 2026-11-08 · feat(supplier): THE ONE BUILD lane C2 — data (hosts, hearts, gift limit, booked loops)

Lane C2 of the supplier dashboard redesign (owner-approved prototype v113). Four migrations, allocated with
`pnpm migration:new`, each with its db test (each sabotaged once and watched red):

- `20271324946509_the_brief_names_the_hosts` — NEW internal `event_chat_hosts(event)` (couple members as
  `{user_id, first_name, name, role, label}`; joins `u.user_id = em.user_id`, emits the AUTH uid, never the
  `users.id` BIGSERIAL) and the supplier brief re-created verbatim from `20271304542745` plus a `hosts` key on every
  rung. Test: `tests/db/the-brief-names-the-hosts.db.test.ts`; the brief key-set contract gains `hosts`.
- `20271325581544_a_message_can_be_hearted` — NEW `chat_message_hearts` (RLS at CREATE, mirrors the as-built
  `chat_messages_member_read`; own-row writes; no DELETE — `authenticated`'s default DELETE grant is revoked;
  realtime on the existing publication). Its block guard is a RESTRICTIVE policy over NEW
  `chat_pair_is_blocked()` (SECURITY DEFINER, answers about the caller only), because the inline form the plan
  copied is defeated by the caller's RLS. Test: `tests/db/chat-message-hearts-rls.db.test.ts`.
- `20271326463501_the_gift_limit_is_an_admin_setting` — `platform_settings.gift_limit_pct` (default 40, CHECK
  0–100); `setnayan_gift_for_fee(BIGINT)` re-created verbatim with the 40 constant turned into a read. TS:
  `GIFT_LIMIT_PCT_DEFAULT`, `giftLimitPctOrDefault`, `setnayanGiftForFee(…, { limitPct })`. Test:
  `tests/db/the-gift-limit-reaches-the-bill.db.test.ts` (TS == SQL at 40 and 25).
- `20271327129110_a_shop_counts_its_booked_loops` — NEW `shop_booked_loop_count(vendor)`: families (keyed by their
  first booked event with the shop) who booked it on 2+ events; service_role only. Test:
  `tests/db/a-shop-counts-its-booked-loops.db.test.ts`.

Then, on top of the data:

- **Gift limit = one admin setting.** `getGiftLimitPct` (fails toward the ruled 40); `GiftQuoteBasis.limitPct` and
  `ShopGiftQuoteBasis.limitPct` carry the live % into `judgeQuoteGifts` / `addGiftMenu` / `giftLimitCentavos` and the
  Setnayan gift sizing; `GIFT_SHARE_OF_FEE_PCT` retired. Admin › Gifts "Gift limit · % of the booking fee" with
  `saveGiftLimitPct` (0–100, audit row `gift_limit_pct_edit`, settings tag cleared). Guard
  `lib/the-gift-limit-is-one-setting.test.ts` (shrink-only list of other lanes' typed "40%").
- **Quotation** (`clients/[eventId]/_pages/quotation.tsx`): ProposalMaker in the owner's eleven steps — Start from · Name ·
  Pick service cards (one multi PickMenu) · From your catalogue · Gift · Travel and crew meal · Discount · Payment
  schedule · Payment method (one multi PickMenu) · Effectivity · pinned Total + Save + Send quote; a line drops by swipe
  with Undo. The card gift does not pre-fill (unruled money).
- **Chat** (`_pages/chat.tsx`): `SupplierThreadBody` renders the shipped thread page with an internal `__embed` view —
  one read path, one stream mount, the full-screen route unchanged. Hosts read through `event_chat_hosts`; the stream
  draws the hosts strip (presence ring from its existing channel), host first names + initials on incoming runs, and
  tap-to-heart (browser upsert under RLS, a second `.on()` on the existing channel).
- **Hub** (`_pages/hub.tsx`): the shipped on-the-day page for ONE event (`__embed=hub`) — Open Hub · Launch Hub, then
  Set up · Crew · The event's pages.
- Guards updated honestly (quote section order, "Their event" placement, the frame's child read through the one
  `chatBox` const, the embedded head, one Undo host) and new ones added — each sabotaged once.

SPEC IMPACT: None to the corpus from this lane (the controller writes the build's DECISION_LOG row). Flagged for
the controller: the shipped `chat_messages_block_guard` has the same caller-RLS gap (see
`build-notes/supplier-1build-c2.md`).
