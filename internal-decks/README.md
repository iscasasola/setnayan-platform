# Internal decks — NOT published

These are the dated internal pitch and prototype decks. They used to sit in
`apps/web/public/`, which Next.js serves at the site root, so **anyone with a
link could open them on the live site**. Owner decision 2026-08-12: take them
off the open web. They were moved here, not deleted — you still have them, you
just don't publish them.

## ✅ The prices were CORRECTED on 2026-08-12 (owner: "fix them")

Everything in the next section is **what was wrong before that pass** — kept
because it is the reason these came down, and because knowing what drifted tells
you what to re-check next time. **The two decks that actually render
(`engineering.html`, `vendors.html`) now carry figures read straight out of the
live catalog**, not retyped:

| | now says |
|---|---|
| Live Studio (was "Panood ₱18,000") | **₱2,999 / event** |
| Papic (was a flat ₱8,000) | **50 free, then ₱50 – ₱5,000** — credits, not a fee |
| Patiktok (was ₱6,500) | **₱1,500 / day** |
| Pakanta (was ₱4,500) | **₱2,500** |
| Vendor verification (was ₱1,499 once) | **FREE** — free during launch |
| Solo · Pro · Enterprise (Pro was ₱1,999, Ent. ₱5,499) | **₱1,000 · ₱2,500 · ₱8,000 / 28 days** |
| Bidding tokens (₱1,000–₱18,000 packs) | **gone** — the currency was retired 2026-08-07; answering is free on every tier |
| Pailaw · LED background loops ₱6,000 | **gone** — the product was removed 2026-08-11 |

**Rows deleted rather than repriced**, because nothing on sale corresponds to
them: *AI Highlight Reel ₱12,000* · *Photo Delivery ₱3,500* · *Invitation Widgets
Pro ₱1,500* · *Document update ₱499* · *Boosted Ads ₱1,200/wk*. Quoting a price
for something we do not sell is the exact defect this pass existed to remove. **If
any of those is real, restore it with its true rate.**

⏭ **Still open, because it is a product question and not a price:** the
engineering deck still has a whole chapter on an **"AI Highlight Reel"**, and
there is no such thing in the catalog. Deleting a chapter is the owner's call,
so it was left and named here instead.

⚠ **The other 30 component files in `keynote/components/` are never loaded by any
of the three decks** (621 KB of dead code) and were NOT corrected — including
`admin-dashboard.jsx`, which holds the worst content of all: every add-on with a
`takeRate: 5`, contradicting the "0% commission" the decks themselves promise.
Nobody can reach it. If you ever wire one of those files into a deck, read it
first.

## What was in them, and why that mattered

They are a **snapshot of 2026-05-28** and the product moved a long way after
that. `apps/web/app/robots.ts` had already blocked crawlers from them on
2026-06-13 for exactly this reason ("drifted from the live product… carried
retired claims"). Crawlers obeyed; people with the link did not.

By the time they came down, verified against the live catalog:

- **Every à-la-carte price was wrong.** The engineering deck's "Setnayan
  Productions · Pay-per-use" list quoted the paparazzi app at ₱8,000, the
  livestream at ₱18,000, the same-day reel at ₱12,000, the photo booth at
  ₱6,500, the song at ₱4,500, photo delivery at ₱3,500 and invitation widgets
  at ₱1,500. None of those are what the catalog charges.
- **It listed a product that no longer exists** — "Pailaw · LED background
  loops · from ₱6,000 · 8K, USB-deliverable" — removed from the product on
  2026-08-11 (`DECISION_LOG.md`, PRs #4356 · #4362).
- 🚨 **The vendors deck made a commercial promise about it.** Verbatim:
  *"Vendors can purchase Setnayan Productions services (Panood, Papic, AI Reel,
  Pailaw, Pakanta) at the platform rate and resell them as part of their own
  package… you keep the markup, we deliver the service."* That is an offer to a
  business partner to resell something we cannot deliver. It is the reason this
  was worth acting on rather than filing.
- Retired names throughout: "Panood" (now Live Studio), a "Today's Focus" panel.
- The prototype page put the LED backdrop inside its **"Grand Bundle"** as a
  **₱2,499 line item**, against a ₱20,000 "outside Setnayan" comparison price.
  (The bundle itself has no single price — it is four items: livestream ₱3,499
  + LED backdrop ₱2,499 + photo wall ₱2,499 + indoor blueprint ₱1,499.)
  ⚠ An earlier draft of this file called ₱2,499 *the bundle's* price. It is not,
  and being wrong about a price in the document that exists to record wrong
  prices is worth saying out loud.

## Two things that looked worse than they were

Both are recorded because counting matches, rather than reading them, produced
a false alarm in each case:

- `keynote/components/admin-dashboard.jsx` carries the scariest-looking row of
  all — every paid add-on with `takeRate: 5`, i.e. a 5% cut, contradicting the
  "0% commission · we never touch your transactions" the same decks display.
  **No deck ever loaded that file.** It was dead code; nobody saw it.
- "commission" appears across nine files. Every one of them says **"0%
  commission"**, which is the correct, owner-locked line — not a stale claim.

## How to view one now

They are plain static files. Serve this directory locally, e.g.:

```bash
npx serve internal-decks
```

Then open `keynote/index.html`, `keynote/vendors.html` or
`keynote/engineering.html`.

⚠️ Open the **`index.html`** form, not a bare directory path. On the live site
`/keynote` (no filename) never worked: the page resolves its scripts relative to
the URL, so from `/keynote` it looked for them at the site root, got 404s, and
sat on "Loading the keynote…" forever. Anyone sent that shorter link saw a blank
page.

## If you ever want them public again

Moving either folder back under `apps/web/public/` republishes it — and
`apps/web/lib/no-published-decks.test.ts` will fail on purpose to make sure that
is a decision someone took deliberately, not an accident. ⚠ That test knows the
two names `keynote` and `proto` and nothing else: publishing this material under
a *different* folder name would sail straight through. **The à-la-carte and tier
prices were fixed on 2026-08-12** (see the top of this file) — what remains before
a republish is the "AI Highlight Reel" chapter, the prototype page's own numbers,
and a fresh read of anything not listed there.

⚠️ **And republishing is not the only way these stay readable.** Vercel keeps
every past deployment URL alive, this repo is public, and GitHub's deployments
API lists those URLs to anyone — so deployments built *before* 2026-08-12 still
serve the decks in full. Taking them out of `public/` fixed the canonical site
(`www.setnayan.com/keynote*` → 404, verified) but does not reach history. Closing
that needs an infrastructure action — Vercel deployment protection, or expiring
the old deployments — not a code change. Flagged to the owner 2026-08-12.
