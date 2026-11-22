## 2026-11-21 · fix(shop-page): About reads in the app's own type · Back from "View shop" returns to Shop

Owner: *"fix text. it feels lost from the design"* (the shop's About in a 28–37 px italic serif) · *"pressing back from
the view shop. returned to user profile page … back should go back to their last screen before they viewed it"*.

- **About** (real shop page + the sample shop): Hanken `text-sn-xl` (17), relaxed line height, `max-w-2xl` — the house
  standard keeps Cormorant for the guest Event Hub only. Was `font-serif italic text-[1.75rem] lg:text-[2.3rem]`.
- **Back from View shop** (measured live): the Shop tab frames the public page; with no arrival its Back read "Home" →
  `/dashboard?hub=1`. The frame and "Open in browser" now open it with `?src=page&from=/vendor-dashboard/shop`
  (`lib/view-shop-frame.ts`, the shipped `withShopArrival`), and inside the frame Back closes the frame
  (`FramedBackCloses`) — the supplier is on Shop as they left it. A new tab's Back goes to Shop.

Guard: `apps/web/lib/back-from-view-shop-returns-to-shop.test.ts` (reverting the shop page turns 2 of 4 red);
`lib/shop-back.test.ts`'s top-left pin now allows the wrapper.

SPEC IMPACT: None
