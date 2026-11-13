## 2026-11-12 · feat(portfolio): the viewer slides · Send to a chat · Your best work first · Reorder

Rulings 5951 and 5940 (supplier portfolio), approved prototype
`prototypes/shop_discounts_bundle_card_open_2026-11-09/portfolio.html` (v3).

- **The shared photo viewer SLIDES** (`gallery-lightbox.tsx`, the `screen` layout every `PhotoViewer` uses): the photo
  follows the finger, and on release it slides fully out while the next slides in (280 ms, ease-out); a short drag
  springs back; ‹ › and ← → do the same slide. Reduced motion = a short crossfade. Before, the next photo SNAPPED in.
- **A portfolio photo opens in that viewer** (was the hand-over Show, which stays on the Show button) with ONE action:
  **Send to a chat**. The panel is the card share list (`ShareTargetList`, now with a search box — Shop › Services'
  share sheet gets the same search), listing only accepted, not-removed client chats (`readShareTargets` /
  `isShareableThread`). Pick → an optional note → Send. The post goes through the SHIPPED door
  (`offerServiceInterest`, `via=photo` → `sharePhotoCore`), which re-checks the chat on the server and posts the photo
  as an ordinary chat attachment (`sendChatMessageCore`). The toast says "Posted in <client>’s chat" — never
  "notified". No new server action (the export budget is at its ceiling).
- **Your best work** is the FIRST section: the page photos couples opened most, from the counter that already exists
  (`vendor_portfolio_photo_views`, migration 20271331531509 — no new counter). Empty = its title, the placeholder tile
  and the Upload door; an unread count says so.
- **Reorder** closes the list: a sheet with ↑ ↓ per section, saved to the new
  `vendor_profiles.portfolio_section_order` (migration 20271342126686) through the shipped field save
  (`updateVendorProfileField`, field `portfolio_order`). No stored order can hide a section
  (`lib/portfolio-section-order.ts`).
- Already shipped and unchanged: who-sees-it and "Show plays" (one dropdown) live in the Portfolio ⚙; empty sections
  keep their title, placeholder tile and door.

SPEC IMPACT: None — builds the approved v3 prototype's NEW items (best work, Reorder, slide, Send to a chat).
