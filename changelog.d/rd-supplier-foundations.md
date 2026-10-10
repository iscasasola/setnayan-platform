## 2026-10-08 · feat(supplier): the redesign's foundations — thumb row, button-rule submit, the envelope, two tour keys (S-PR0)

First of the supplier dashboard redesign's PRs (corpus
`SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 6, row S-PR0; prototype
`prototypes/supplier_dashboard_2026-10-08_fable.html`). Nothing a supplier does
changes yet; this lands the pieces every later page uses.

- **`SupplierThumbRow`** (`app/vendor-dashboard/_components/supplier-thumb-row.tsx`)
  — the frosted floating row for the supplier side: the shared `.sn-glass-row`
  recipe, portalled to `<body>`, slides up once the page has rendered and slides
  down first when the supplier taps a link that leaves the page; its buttons
  change state as one (`useFitRow`) and a text field in it keeps ≥ 60 %. Not
  mounted on a supplier page yet — People, Dates, Money, the customer card,
  Services, Page and the Event Hub mount it in their own PRs.
- **`SupplierSubmit`** (`…/supplier-submit.tsx`) — a form's submit drawn by the
  button rule: the shipped `SubmitButton` (pending word, double-tap lock, the
  no-touch veil) wearing `ActionButton`'s class list, icon and `.lbl` word.
- **The shell** — the supplier top-bar cluster gains the envelope
  (`UnreadMessagesBadge`, the same live badge the event bar carries), seeded
  from the unread-messages count the layout already reads, landing on the inbox
  through `customerLandingHref('messages')`. The bar names the SHOP beside it
  (from 640 px up), not the person. The bell stays until Settings ›
  Notifications › Recent exists (S-PR9).
- **Tour keys** `vendor_shop_v1` and `vendor_hub_v1` registered in
  `lib/tours.ts`, one slide each, in the prototype's words. Neither is mounted:
  each mounts with the page it describes (S-PR6, S-PR11).
- **Guard** `app/vendor-dashboard/every-supplier-action-is-a-button.test.ts` —
  no bare `<button>` in a swept supplier file, counted PER COMPONENT and printed
  (a file-level count cannot say which component still holds one). The sweep
  list grows with each supplier PR.
- `app/vendor-dashboard/_components/the-supplier-foundations-hold.test.ts`
  holds the row, the envelope and the tour keys; the row joins
  `lib/floating-rows-are-glass.test.ts`; `one-top-bar.test.ts` now names the
  envelope among the shop's doors.
- `/dev/supplier-lab` — a no-session fixture lab (404 in production) that draws
  the real components; baselines regenerated (`port:baseline`, `ugat:screens`,
  `root-map --baseline`: one `no-door` line for the lab).

No migration · +0 exported server actions (1,199 before and after) · no new
rule in `globals.css` · nothing added to the shared client bundle (the new
client code is imported only under `app/vendor-dashboard/**` and the dev lab).

SPEC IMPACT: None — builds `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` row S-PR0 as written. One deviation recorded in the build status file: the bell stays beside the envelope until S-PR9.
