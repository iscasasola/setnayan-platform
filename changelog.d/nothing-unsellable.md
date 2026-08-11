## 2026-08-11 · fix(catalog): stop selling what we cannot deliver — and a retired SKU that kept advertising itself

Three live promises the app could not keep. All read out of **prod**, not out of a document.

**1 · The Custom Subdomain is off sale.** ₱999/year for *"your own web address —
yourname.setnayan.com"*. **No such address resolves** — there is no wildcard DNS and no
subdomain-aware routing. Owner ruled it off sale 2026-08-10; migration
`20271128898031` implements it.

🔑 **A STATUS LABEL IS NOT A GATE.** `lib/v2-catalog.ts` already marked this SKU
`'partial'`, which renders *"Partial · in active build"* on `/pricing`. That chip is
decoration — `build_status` is read only for styling and the onboarding list, and gates no
buy path. `is_active` is the only real switch and it was `TRUE` the whole time.

**2 · The Animated Monogram stops promising the LED screen.** Its own prod description
said *"…and up on the LED stage screen. **Includes the Live Background.**"* The monogram
works and **stays on sale**; the LED half does not — the maker saves a design and nothing
anywhere produces a file (`led_background_renders`: zero rows, **zero writers**), so a
couple cannot hand anything to their venue. The SKU is kept and the sentence corrected;
withdrawing a working product would have been the wrong fix.

**3 · 🪤 THE DEACTIVATION ALONE WOULD HAVE BEEN A NO-OP.** `llms.txt` — the machine-readable
file AI assistants read — is generated from the catalog for **figures only**; the prose and
its `REQUIRED_RETAIL` list are hand-written by design. **Nothing there filters
`is_active`**, so taking the subdomain off sale would have left it advertised at ₱999/year
to every assistant, indefinitely. That file's own docblock already records **two** earlier
cases that shipped exactly this way, green: Camera Bridge advertised after retirement, and
the long-retired Live Studio device split.

⇒ `buildPriceBook` now **refuses to render** when any prose-named SKU is off sale
(`RetiredSkuError`), matching the fail-safe already in the route: serve the short pointer
file. **Serve less rather than serve wrong.** Verified against prod first — all 18
prose-named retail codes are `is_active = TRUE`, so this throws for nobody today.

**4 · The supplies page told couples to do something impossible.** Step 2 of its "How it
works" read *"Tap **Checkout via Orders** — your cart becomes a draft order"*. **There is
no such handoff**; the cart's own code says checkout is *"intentionally NOT built"* and
renders a disabled notice. A couple following those instructions hit a dead end and would
reasonably conclude the app was broken. The badge also read *"Web V1 · launching"*. Now:
**"Not open yet"**, and the copy says plainly that the items and prices are placeholders,
nothing can be ordered, and nothing in the basket is charged, kept or sent.

### Guards

`apps/web/tests/db/sellable-promises.db.test.ts` (4 tests, replayed migrations) and four
new cases in `lib/llms-txt.test.ts`.

⚠ **THE GUARD CRIED WOLF ON ITS FIRST RUN AND THAT IS IN THE FILE.** The LED check started
as `ILIKE '%LED%'` and flagged `PATIKTOK_COMPILER`, whose blurb says clips are
"compi**LED** into post-ready reels" — prod holds exactly **one** offending row. Now
`~* '\yLED\y'`, matching the acronym and not the tail of an ordinary word. A guard that
cries wolf gets skimmed past on the one day it is right.

**Mutations, each verified applied before the red was trusted:** re-adding the LED sentence
→ 1 fails · putting the subdomain back on sale → 1 fails · flipping a prose-named SKU
inactive → `RetiredSkuError`. Plus a cry-wolf case: the Setnayan AI ladder's B/C/D rows are
inactive **by design** as price sources and must NOT trip the refusal.

### ⚠ Still on sale, deliberately

**`PAPIC_ADDON_THANK_YOU` (₱2,499) remains active with nothing producing it** — the owner
ruled "BUILD IT" on 2026-08-10, and taking it off sale would reverse that. The rails are
real: `lib/reel-render.ts` is a 1,214-line client-side 9:16 encoder already shared by two
shipping products. 🔑 **The server-side render path is the phantom** — `render_jobs`,
`patiktok_render_jobs` and `led_background_renders` are all **empty in prod**, no worker
exists anywhere in the repo, and the one thing that looked like a worker was deleted on
2026-08-09 for faking completion. The maker is the next PR; until it lands this is the one
remaining thing on sale that nothing delivers.

SPEC IMPACT: `DECISION_LOG.md` — the subdomain retirement, the monogram's corrected
promise, and the rule that a SKU description is a promise.
