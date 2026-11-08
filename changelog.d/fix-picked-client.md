## 2026-11-08 · fix(clients): the picked client's thumb rows can be tapped, and its first load carries Details, not nine pages

- **Taps lost under the picked client.** `SupplierThumbRow` portalled to `<body>` at `--sn-z-thumb` (25) while the
  picked client sits at `--sn-z-pop` (40), so Schedule's "My times · + My moment" (and the rows on Payment, Forms, Hub,
  Report) were drawn UNDER it. The shell now keeps a thumb host inside its own layer and hands it down through
  `ThumbLayerContext` (`vendor-dashboard/_components/thumb-layer.ts`); the row portals there (and never moves up into the
  page's pinned row behind the client). The client's page body also leaves `--sn-thumb-room` under the row.
  Guard: `clients/[eventId]/the-thumb-row-floats-over-the-picked-client.test.ts` (sabotaged red ×4, restored).
- **First Load JS 510 kB.** Every body's client code shipped with the route because Details' Decisions renders the
  thread page and `pickedPageBodies` builds all nine. The heavy parts now load on demand, same components under the
  same names: `_pages/lazy.tsx` (Forms · Files · Report · refunds · thumb row, `React.lazy`),
  `messages/[threadId]/_components/on-demand.tsx` (message stream, send row, quote builder… `next/dynamic`, SSR +
  preload, so the full-screen thread paints as before) and `on-the-day/_components/on-demand.tsx` (the Hub's panels).
  Data is unchanged — still one server draw, page switch still `history.replaceState`. The shell warms every chunk at
  idle after the open. Guard: `_pages/the-picked-pages-load-their-code-on-demand.test.ts` (sabotaged red ×3, restored).
- Guards updated with intent kept: `the-maker-sheets-open-on-top`, `one-chat-look-on-every-thread`,
  `the-conversation-list-says-what-it-shows` (accept the on-demand re-export of the ONE shared component),
  `files-folders-are-the-three-sources` (renders after the finder's code has loaded).

SPEC IMPACT: None
