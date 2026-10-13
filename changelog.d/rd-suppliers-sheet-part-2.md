## 2026-10-08 · feat(suppliers): the supplier sheet, part 2 — it opens without re-rendering the page, and carries their photos, the rest of what they offer, Follow and Share

Stacked on `rd/suppliers-find-walk-fixes`. Owner 2026-10-07 (the prototype's
`SHEETS.supplier`, acceptance picture `04-supplier-sheet-light.jpg`) and the
minimum-request rules of 2026-10-08.

- **Opening a supplier no longer re-renders the Suppliers page.** Part 1 opened
  the sheet by pushing `?inspect=` — the whole page rendered again on the server
  (≈47 query sites by reading the loader, plus two for the sheet) while the
  panel said "Opening…". The sheet is now a client sheet
  (`_components/supplier-sheet.tsx`, loaded lazily on the first press): it is
  drawn AT ONCE from what the pressed card already holds, then makes ONE small
  request — five reads, one per table, together — and keeps the answer for the
  visit. A second look at the same supplier asks nothing.
- **A bottom sheet on a phone, a panel on the right from 1024 px** (the shipped
  `Sheet`), as the prototype draws it — not the side panel the guest card uses.
- **A card in "More to compare" opens it too** — a supplier who is not yet the
  couple's — with "Ask for a quote" as its verb (asking saves them first, as the
  list's own button does).
- **Their photos** — one row of three with "+N" — are the supplier's own
  published photos (`vendor_profiles.portfolio_r2_keys`, stable public URLs).
- **The rest of their portfolio** — every other category they have a live
  service in, each with "Ask about ‹Category›" (files them under THAT category,
  then the one inquiry path); a category they already sit in on the couple's
  page shows where things stand and a tick instead.
- **Follow** (the shipped `followVendor` / `unfollowVendor`: it flips at once and
  takes itself back in words if refused) and **Share** (their public page —
  native share, else copy the link).
- **A shop whose name is still withheld** is not named by its photos or its
  address either: no photos, no Share (`isVendorNameRevealed`, the list's gate).
- **While the request is out** one line says "Loading their reviews and
  photos…"; **a refusal** says so with Retry — never an empty section.
- **"More to compare" asks the marketplace once per category per visit** —
  folding and re-opening a row no longer asks again.
- The desktop quick-view (`VendorQuickViewInspector`) is back to its shipped
  shape; `supplier-sheet-actions.tsx` and the page's two sheet reads are gone.

+0 exported server actions (the request rides `fetchInlineMoreRow` as
`sheetFor`) · no migration · the sheet is a lazy chunk, not first-load JS.

SPEC IMPACT: None (the corpus status file `SUPPLIERS_BUILD_STATUS_2026-10-08.md`
is updated with what is built and the deviations).
