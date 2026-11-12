## 2026-11-12 · fix(quote): the quote's Total · Save · Send quote bar is pinned to the screen's foot

Live bug (owner screenshot, 390 px): the quote maker's bottom bar floated mid-page with line items under it. It was
`sticky` inside the form, and the quote is mounted inside scroll boxes — the chat tool panel (`max-h-[55dvh]
overflow-y-auto`) and the picked client's body — so it stuck to THEIR bottom, then stood `--sn-bottomdock-h` (64 px)
above it inside a full-screen layer that already covers the dock.

- New `app/_components/quote-pinned-bar.tsx` (`QuotePinnedBar`): the bar is portaled and `fixed`. It lands in the
  picked client's thumb layer (`ThumbLayerContext`), else the form's nearest `position: fixed` ancestor (the phone's
  chat takeover), else `<body>` standing on the dock / thumb row. Inside a layer it is the bottom itself, clearing the
  home indicator. Up only while the quote is on screen; a spacer reserves its measured height so the last line
  scrolls clear. Phone: full width; from 701 px: the form's (or layer column's) width.
- `proposal-maker.tsx`: the form gets `id`/`ref`; Save and Send name it with `form={formId}` (a portaled control
  outside the form's DOM would post nothing).
- Lab: `/dev/supplier-chat-lab?m=quote&embed=quotation&picked=1` draws the Quotation inside the picked client's layer.
- Guard: `app/_components/the-quote-bar-is-pinned.test.ts`; `the-quote-is-one-screen.test.ts` step 11 follows.
- Shots (Now · Proposed, 390 px, mid-quote): `build-notes/shots/quote-bar/`.

No other maker shares this bar (form maker, card maker and package editor have no bottom-sticky bar).

SPEC IMPACT: None
