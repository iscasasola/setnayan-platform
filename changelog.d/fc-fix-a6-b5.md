## 2026-11-25 · fix(supplier): final check area 6, batch 5: quote cards and the notifications list say a failed read

Lane A fixes from the 25 Nov final check (area 6, plan batch A4). No look change, no amount, fee or rule changed.

- **Quote cards' "comes with" (A6-07).** The `vendor_service_links` read in the supplier chat binds its error and logs it; a picked card then says "We couldn’t read what this card comes with. Try again in a moment.", never an empty bundle.
- **Notifications (A6-15).** `readOwnNotifications` (lib/notifications.ts) answers `{ items, unread }`; a refused read, a missing relation included, is unread and logged. The supplier Notifications page says "We couldn’t load your notifications right now." with Try again, never "Nothing yet.". `fetchOwnNotifications` now throws on every refused read (the bell already says a thrown read; the other pages show their error page), so no caller turns a failure into an empty list.
- **Not done here — A6-08 (🟠):** the notification links in the chat's payment and guest-count actions stay typed. The email-link guards (`scripts/lint-email-links.mjs`, `lib/couple-supplier-notices-reach-email.test.ts`) read each `relatedUrl` as a literal to prove its page exists; a `lib/routes.ts` call blinds them. Which wins is the controller's call.
- **Guard:** `app/vendor-dashboard/area-6-batch-5-holds.test.ts`. Server actions: no new export. No migration.

SPEC IMPACT: None. Honest-state and wiring fixes against CLAUDE.md §5 rule 4 and design-and-wiring A3; no product decision changed.
