## 2026-08-21 · fix(seo): stop printing "· Setnayan · Setnayan" on 11 pages

`app/layout.tsx` sets `title: { template: '%s · Setnayan' }`. Eleven pages also
ended their own `PAGE_TITLE` with `· Setnayan`, so each served the brand twice —
in the browser tab and in the ~60 characters Google prints in a search result,
on the highest-value product pages we have: Papic · Live Studio · Event Hub ·
3D Plan · Logo Maker · Setnayan AI · Alaala · Patiktok · the monogram maker ·
our-story · why-setnayan.

**Confirmed live before touching anything** — fetched the reachable pages and
read the `<title>` off production; `/setnayan-ai` printed the word three times.
`/pricing` and `/help` were already clean, which is what pointed at the cause.

🔑 **THE NAIVE FIX MAKES IT WORSE, AND THAT IS THE INTERESTING PART.**
`PAGE_TITLE` is used four times per page: the document title, `openGraph.title`,
`twitter.title`, and sometimes a structured-data `name`. **Only the document
title passes through the template.** Stripping the brand from the constant would
have silently removed it from every Facebook and X share card — trading a
cosmetic doubling for a real loss of branding. So `DOC_TITLE` strips it for the
document title alone and the share cards keep the full string, verified
unchanged on all 11 (`shareCards=2` each).

Anchored on indentation, not on the string: the metadata-level `title:` sits at
two spaces, the share-card ones at four. That distinction is the whole fix.

🛡 New guard `lib/titles-do-not-double-the-brand.test.ts`, **mutation-proved
without the toolchain** (this checkout has no `node_modules`, so its logic was
executed directly with plain Node): 402 pages scanned → exactly **11** examined
→ **0** offenders; reverting one page to the old shape makes it report that file
and only that file; restoring returns it to zero. The sabotage was confirmed to
land by occurrence count (`DOC_TITLE` uses 1 → 0) rather than assumed. It also
asserts `examined >= 10`, so renaming `PAGE_TITLE` cannot quietly turn the guard
green while examining nothing.

⚠ Reads SOURCE, not rendered output — it proves no page hands the template a
pre-branded string, not what Next finally emits. The live symptom is what
established that.

Not verified locally: no `node_modules` in this checkout and `npm run build`
cannot complete on this machine. Typecheck, lint and the unit run are CI's.

SPEC IMPACT: None.
