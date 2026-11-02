## 2026-10-25 · fix(copy): the footer pages say what ships today

Owner, 25 Oct, on the sidebar footer: *"fix all the content here as well. Check if all of these are updated."*
Each footer page was read against the live catalogue (`platform_retail_catalog_v2`), `event_type_vocab`
and the shipped code. What was false, and what it says now:

- **/about (+ /tl/about)** — "every guest goes home with their own highlight reel" (a paid add-on, said
  as a default) → every guest can find the photos they're in. "Every service is free to use" (Music
  Maker and Patiktok are paid) → some start free, the rest are on Pricing. "as birthdays, debuts…
  unlock" (20 event types are live) → the same tools already run them. Free list names the Event Hub.
- **/help (`lib/help.ts`)** — four Papic answers still taught setting credits aside for one camera,
  retired 2026-09-16 and removed in #5905; rewritten to the one shared pot. "There's a free tier"
  (Papic sells only credits) → one free camera + the first-event free credits. The event bar gained
  Memories (2026-10-23). Supplier plans name Solo too. `HELP_LASTMOD` → 2026-10-25.
- **/pricing** — the Papic estimator promised "set some of it aside for a particular camera later"
  (retired) → removed. Free list: seat plan names the free 3D walkthrough; "Memories hub" → Memories.
- **/download** — "inside your wedding" → your events; one line for phone visitors (home-screen
  install; the iPhone app is linked only once `NEXT_PUBLIC_IOS_APP_STORE_URL` is set).
- **Rail footer in the iPhone app** — Pricing, Download and For suppliers showed in the store shell, where
  /pricing and /for-suppliers are refused doors and /download offers other apps (owner #6729). Each now
  carries `data-web-only` (hidden before first paint in the app; web unchanged), held by the new
  `the-app-footer-names-no-paid-door.test.ts`, which asks `isStoreShellWebOnlyPath` so a newly refused
  door is covered too (seen to fail on /for-suppliers, and on /pricing with the attribute removed).
  `doorway-shell.test.ts`'s presence check now allows an attribute after `href`.
- **Help · What is Live Watch?** — "one unlock covers the whole event" → streaming one camera is free;
  Live Watch is a one-time unlock that stays with the event and adds all your cameras.
- **llms.txt** — the retired one-camera credit hand-out (two places) and "per-guest highlight reels"
  removed; photos are matched to guests who consent.
- Checked, already true: /open-shop, /blog, /creators, /for-suppliers (spot-checked), footer labels.

SPEC IMPACT: None — copy now matches rulings already in DECISION_LOG (2026-09-16 Papic one pot,
2026-09-23 #5905, 2026-10-23 event bar).
