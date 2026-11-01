## 2026-10-30 · feat(shop-page): supplier website by plan, slice 4 — the card column beside the page on every plan, full width

Owner-approved 2026-10-30 ("Supplier website by plan approve" — the prototype's tablet + desktop views; owner 2026-10-29 "always maximize the screen"; the "universal" calling card 2026-09-10 §C).

- **Two columns on every plan** from 768 px: the shop's card (name, badges, facts, actions, map) is a sticky column — 300 px on a tablet, 360 px on a computer — and the page body reads beside it. A card taller than the screen scrolls inside itself. A phone keeps one column, unchanged.
- **Full width on every plan** — the article and the header are `max-w-screen-2xl` for all plans (was Pro+ only; Free/Solo sat at `max-w-3xl`).
- **The Pro-only sticky Inquire rail is retired** — every fact and button it repeated (rating, Inquire, Share, city, events through Setnayan, years) is in the card, which is now sticky for everyone; the action row is no longer hidden on a computer. `one-inquire-button.test.ts` now expects two Inquire buttons (hero · action row).
- One home for the classes, `app/v/[slug]/_components/shop-columns.ts`, shared by the page and the dev lab `/dev/shop-layout-lab` (404 in production).

SPEC IMPACT: None — builds the approved contract.
