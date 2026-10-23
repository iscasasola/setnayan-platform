## 2026-10-23 · feat(iap): five more Apple products — Setnayan AI, Music Maker, Patiktok, Thank You, Mood Board pack

Owner, verbatim (23 Oct): *"Add Setnayan AI, Music Maker, Patiktok, Thank You and Mood Board pack as Apple products
before submitting build 6."* Web-only change: the iPhone 1.0 (6) shell already announces `SetnayanIAP/2` and its
StoreKit plugin takes any `com.setnayan.app.` id from the web. Everything below sits behind the one gate
(`getIapGate().iap` — store shell + `/2` + `NEXT_PUBLIC_APPLE_IAP_ENABLED`); with it false the app, the web and the
desktop are exactly as before.

- `lib/iap/products.ts`: `com.setnayan.app.setnayan_ai` (SETNAYAN_AI), `music_maker` (PAKANTA), `patiktok`
  (PATIKTOK_COMPILER), `papic_thank_you` (PAPIC_ADDON_THANK_YOU) — kind `event-unlock`, one per event; and
  `mood_board_renders_50` (MOODBOARD_RENDER_PACK) — kind `mood-board-pack`, repeatable like Papic credits. All
  CONSUMABLE.
- `startAppStorePurchase`: the Mood Board pack is couple-only and on sale only while `moodboard_render_config` grants
  exactly 50 from its own row; Patiktok keeps the day-of `event_over` refusal; Setnayan AI is refused when owned (order
  or the stored flag), when the paywall is off, and for any event whose web price row is not the product's own
  (`lib/iap/setnayan-ai-in-app.server.ts` — one Apple price cannot honour the per-event-type ladder; today that sells
  Tier A / weddings only, the other bands are an owner decision).
- The four studio homes open in the app (`IAP_OPENED_ROUTE`); each page's existing pay step becomes
  `IapUnlockSheet` (new, the Live Watch sheet's look; Apple's `displayPrice` only, no web price, no GCash / BDO, no web
  link). Mood Board mounts Make it real in the app with Apple's pack sheet. A web- or Apple-bought Setnayan AI lights up
  in the app (`storeShellAllowsPaidFeature(…, iap)`), and the Suppliers page's Sai banner shows there for an event
  Apple sells it to.
- Refund: `deactivateOrderSku` now takes back a refunded Mood Board pack's render-credit grant (by `order_id`) — on the
  web's admin refund AND Apple's REFUND. It had no reversal at all. Held by
  `tests/db/an-app-store-purchase-is-one-order.db.test.ts`.
- Restore hides Mood Board packs like Papic packs.
- `/dev/iap-doors-lab` draws the five doors for walks (404 in production).

SPEC IMPACT: DECISION_LOG.md row "23 Oct: five more Apple products" (corpus) — the second wave of In-App Purchase,
the product ids, and the Setnayan AI band question left open for the owner.
