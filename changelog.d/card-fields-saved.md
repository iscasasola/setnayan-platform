## 2026-10-14 · fix(vendor): the service-card maker's sheet fields are saved again (LIVE FIX)

Since a1e6887ceb (2026-09-07) every `CanvasSheet` in the live service-card maker portals to
`<body>` to escape `.sn-page-enter`'s identity transform. The browser builds a form's data from
its DOM descendants plus `form=`-associated controls only, so the photo, price, Setnayan gift,
what's included, discounts, crew and book-ahead fields never reached `commitVendorService`: the
card never painted them, Publish never opened, and "Save as draft" saved kind, name and coverage.

- The portal stays. The card `<form>` now has `id={CARD_FORM_ID}`; each of the six sheets inside
  it passes `formId`, and `CanvasSheet` joins every control under its portaled root to that form
  with `form=` — now and as nodes mount later (an upload that lands, a row added) —
  `lib/portaled-fields-join-their-form.ts`. The audience sheet keeps its own form.
- The live card read and the local keep listen on the document, filtered to the card's own fields
  (`ownerFormOf`) — a listener on the `<form>` element never heard a sheet.
- `FileUpload`'s "save cannot outrun the upload" refusal finds its form with `ownerFormOf`; from
  inside a sheet `closest('form')` found nothing and the refusal had switched itself off.
- Enter in a joined sheet input is swallowed (`enterWouldSubmit`): joined fields would otherwise
  implicitly submit the card through its default button — Publish. Since the portal shipped, Enter
  there did nothing, and it still does.
- The card form is `noValidate`: with the sheet fields now joined, a native refusal over a field in
  a CLOSED sheet would focus nothing and say nothing. `commitVendorService` re-validates.
- Guard `every-sheet-field-posts-with-the-card.test.ts` (sabotaged 6 ways, each red); re-pointed
  `canvas-field-parity` and `save-cannot-outrun-the-upload` to the fixed shape.

SPEC IMPACT: None — restores the shipped behaviour; no product decision changes.
