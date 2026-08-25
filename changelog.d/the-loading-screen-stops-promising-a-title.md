## 2026-08-25 · fix(loading): the loading screens stop drawing the page title that was retired four months ago

**Measured before scoping.** The item said 98 loading screens. Re-run against `origin/main` @ `d5f18e49c`: **144** `loading.tsx` compose a shared skeleton template, and **100** of them reserved a page header their route never draws — plus two hand-rolled boundaries (`/admin` and the non-event `/dashboard/*` shell) doing the same by hand. So the defect was real and one third larger than the brief. It is closed at **the measured number, not the quoted one**.

### What a person saw

Open Guests, or Payments, or your profile. For a beat you get a small grey pill with a wide grey bar under it — the shape of an eyebrow and a page title. Then the real screen lands, has neither, and **everything jumps up about 52 pixels**. The skeleton was causing the exact layout shift a skeleton exists to prevent.

### Why it was there

`<PageMasthead>` was emptied in four steps and `HeaderSkeleton` never followed: the eyebrow went **2026-07-21**, the lede **08-18**, the title and back chevron **08-21** (owner, pointing at the Alaala page: *"i still see this across most of pages"*), the (i) hours later. The masthead's own rule became *"on a page with no actions — which is most of them — render nothing"*. The skeleton kept drawing `h-3 w-28` above `h-8 w-56` on every screen that used it.

🔑 **NEITHER FILE WAS WRONG ON ITS OWN.** Each reviews cleanly, typechecks, and passes every other guard. The defect lived only in the RELATIONSHIP between the loader and the page it replaces, and only at render — the same shape the budget-only `the-skeleton-matches-the-page.test.ts` was written for in one route. This generalises it to all of them.

### What changed

- `components/skeletons/index.tsx` — `HeaderSkeleton` now **renders `null`** unless the caller asks for something, mirroring the masthead's own early return and reusing its exact wrapper classes so the strip cannot land somewhere the skeleton did not reserve. `title` is **opt-in** and `actions` defaults to **0** on all eight templates.
- ⛔ **The eyebrow bar is DELETED, not made opt-in.** A prop named after a retired element is an invitation to bring it back. The ~10 door screens whose card really does carry a terracotta eyebrow lose one 12px pill from their shimmer — the deliberate price of not keeping the retired shape alive in the shared component.
- **43 loaders opt back in to a title**, because their route genuinely draws one: every door (`/join`, `/papic/*`, `/samahan/join`, `/vendor/claim`, `/host/accept`, `/panood/cam`, `/[slug]/welcome`), the Studio buy heroes, the guest add/import/edit forms, the vendor-dashboard pages that never migrated to the masthead, `/explore`. That list is **derived by walking each route's own page and the components it imports**, not typed out.
- **10 loaders reserve the header buttons their page really renders** (orders' *New order*, budget's `.ics` export, hosts' *Everyone in this event*, …). `/dashboard/[eventId]/guests` deliberately reserves **none**: its buttons are inside a `hidden … lg:flex` shell, so a phone never sees them and one skeleton cannot be right about both widths.
- **Two phantom action rows found by the new guard, not by review** — `/dashboard/[eventId]/vendors` (no masthead at all) and `/dashboard/[eventId]/pabuya` (masthead with a title and nothing else) both promised a button. Both now promise none.
- **91 loaders needed no edit at all** — the default flip fixed them, including **all 44** under `/admin`.
- `scripts/port-control-baseline.json` regenerated (the `/admin` subtitle shimmer is a real, intended removal). **Set-compared before → after: 0 destinations lost, 0 actions lost, 0 routes removed**; the only block removed is that `SkLine`.

### The guard

`app/_components/the-skeleton-promises-only-what-the-page-draws.test.ts` — 7 rules, every expectation derived, nothing hand-listed.

- It lives beside `page-masthead.test.ts` because `test:unit` globs `lib/**` and `app/**` only. **A guard under `components/` would never run and would be decoration.**
- The bill of loaders is grepped out of the app and **comment-stripped** — one loader names `GridPageSkeleton` only in a docblock explaining why it deliberately renders nothing — then **floored at 100**, so a sweep that silently stops matching fails instead of passing.
- It **runs the real components** and reads the real element tree rather than grepping their source, so a class rename cannot quietly make it vacuous.
- It asks `PageMasthead` itself whether it still returns a lone `<h1>`. If that stops being true, every other rule here is stale and says so.
- 🔑 **The route rule is ONE-DIRECTIONAL on purpose.** *"This route shows no heading anywhere, so do not shimmer one"* cannot produce a false alarm. The inverse would fire on a heading that only appears in an empty state or an error branch, and a guard that cries wolf teaches you to skim past the one time it is right.
- A seventh rule covers the **28 hand-rolled loaders** the template bill cannot see — which is exactly where the next one hides, and where two of these were.

🛡 **9 mutations, each printed before → after, all RED, restored green:** default the title back on (9→8) · make a template swallow `title` (8→7) · shimmer a heading on a route with none (0→1) · drop the orders button (1→0) · reserve a button a page has not got (0→1) · let the masthead draw a box again (1→0) · rename the templates out of the module (1→0) · put the `/admin` header shimmer back (0→1) · shrink the title bar below the size the rule recognises (1→0).

✅ typecheck exit 0 · `next lint` exit 0 · **9954 unit tests pass**.

⏭ **Not done, and not an oversight:** the door loaders draw a full-width form shell while the real door is a centred paper card. That mismatch predates this and is a shape job, not a retired-element job.

SPEC IMPACT: None — no SKU, price, schema or copy change. Loading-state shape only.
