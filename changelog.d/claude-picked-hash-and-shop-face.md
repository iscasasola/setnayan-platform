## 2026-11-12 · fix(picked,chat,clients): legacy `#page` links open their page · the shop speaks with its logo · Details loses its second menu

- **Live bug — `workspace#payments` opened on Chat.** The picked shell routes by `?tab=`; a notification written before
  that (`…/vendors/<id>/workspace#payments`) fell to the menu's first page. The ONE `PickedShell` now reads, after mount,
  a legacy `#<page>` when `?tab=` is absent — through the side's alias table (`pickedSupplierPageOf`, so `#quotation` →
  Quotation) — and rewrites the URL to `?tab=`. A hash that names no page (`#promote-coordinator`) is left alone. No
  shipped emitter writes `workspace#<page>` any more (guarded). New `app/_components/picked/picked-url-page.ts`;
  guard `app/_components/picked/legacy-hash-opens-its-page.test.ts`.
- **The shop's face in the couple's chat is its logo.** `chat-message-stream.tsx` takes `shopLogoUrl`; the couple's
  thread page presigns the logo `couple_thread_supplier_names` already sends (revealed only) with `displayLogoUrl`. A
  shop-side message's 28px round avatar shows it, falling back to initials (also on a load error). Plain `<img>`, no new
  imports in the client bundle. Guard `lib/the-shop-speaks-with-its-logo.test.ts`.
- **The supplier's Details page drops its old pill row** (Chat · Quote · Files · Details) from the returning-client card —
  the picked-client menu already opens each page, and its Quote went to the chat's `#build-quote`, not Quotation. The
  marker stays and draws nothing for a first-time client. Guard `lib/the-details-page-has-no-second-menu.test.ts`; two
  door-count floors relaxed by one (`one-quote-tool`, `the-thread-tools-open-what-they-name`).

SPEC IMPACT: None
