## 2026-11-07 · fix(shop-page): "Back" from a shop goes where you came from, on every screen the shop opens

Owner, 7 Nov 2026, verbatim: *"there are links on the supplier website that is incorrect. example. back to suppliers? it went to a wrong shell … i tapped setnaprod then pressed inquire. then pressing back to suppliers led to this."* He had opened SetnaProd from Discover. The foot of the Inquire section was a fixed `<Link href="/explore">Back to suppliers</Link>`, so every arrival landed on `/explore`. Only an arrival from `/explore` should.

- **One rule: `lib/shop-back.ts` `shopBackDoor`.** It reads the arrival the shop page already carries: `?src=` (the attribution tag) and `?event=` (only after the page has CHECKED it is one of the viewer's own events, never the `events[0]` fallback). Discover → `/` "Back to Discover". `/explore` → `/explore` "Back to suppliers". A saved supplier → `/dashboard/library?tab=vendors` "Back to saved suppliers". An event's Suppliers → `/dashboard/<id>/vendors` "Back to suppliers". With no arrival (a shared link) the door goes to `/explore` but says "See more suppliers", never "Back".
- **The doors into a shop now say where they are.** Discover's shelf adds `?src=discover`. Discover search hits and the signed-in search add `?src=search`, so those inquiries are also stamped "Search Inquiry". The event pages that open a shop add `?event=` (Find › categories, a package, the review page, the review thank-you).
- **The arrival survives every screen the shop opens.** Check a date ("See the shop" ×2, "Try again"), the reviews pager, the event picker rows, the waitlist join redirect, and the booth's soft gate all carry it there and back.
- **Share** now sends the shop page without the sharer's `src`, `event`, `wl` or `reviewsPage` (it used to send `window.location.href` whole, event id included).
- Copy: the booth soft gate's "View X's profile →" is now "Back to X's shop page". The review page's "Open supplier profile" is now "Open their shop page".
- `lib/page-home.ts`: `/v/[slug]` changes from `{ home: '/explore' }` to `{ none: 'computed', by: 'lib/shop-back.ts' }`.
- Lab: `/dev/shop-back-lab` (dev-only) shows each door in, each plan pill and the real back door.

Guard: `lib/shop-back.test.ts` holds the rule per arrival, the round trip through every sub-screen and the source wiring. Two sabotages were run: the fixed `/explore` link put back, and Discover returning `/explore`. Each one went red, then green again once restored. Regenerated: `lib/design-rules.baseline.json` (the shop page's hand-drawn back is paid down), `lib/ugat/screens.generated.json`, `scripts/port-control-baseline.json`.

SPEC IMPACT: None. The 28 Oct back-links audit row for `/v/[slug]` ("goes to the front page" → `/explore`) now reads per arrival, and the map comment records the change. No locked decision changes.
