## 2026-08-21 · style(palette): the page is white again

Owner, 2026-08-20: *"let's also make the background not beige. let's keep it
same color as facebook/youtube. having a white background."*

⚠ **THIS REVERSES AN OWNER LOCK AND IS RECORDED, NOT QUIETLY APPLIED.** The page
was moved cream → `#FDFBF7` on **2026-07-13**, and `globals.css` carried a rule
saying the palette lock *"forbids [pure white] outright"*. Only the owner can
lift that, and he did. A later reader will find the old lock and needs to know
who lifted it and when.

**Changed at the source, in four places — the value was written four times:**
`--color-cream` (page + card), `--surface`, `--m-paper`, and the front door's own
`--fd-cream`. The token NAME `cream` is kept: renaming it would churn every
`bg-cream` / `text-cream` call site for no behaviour change — the same reason
`mulberry` and `terracotta` kept theirs.

✅ **EVERY LOCKED PAIRING IMPROVED AND NONE REGRESSED.** White is lighter than
cream, so text-on-page rises AND a page-coloured label on a coloured fill rises
too. Re-measured by reading the tokens back **out of the edited stylesheet**,
the same way `palette-lock.test.ts` does:

| | cream | white |
|---|---|---|
| ink on page | 13.82 | **14.28** |
| link on page | 8.22 | **8.50** |
| gold-700 on page | 4.86 | **5.02** |
| label on the CTA | 4.61 | **4.76** |
| label on gold-700 | 4.86 | **5.02** |
| gold on page (UI-only by rule) | 3.37 | 3.48 |

Gold stays under the floor and its rule is **unchanged** — never body copy.

🔑 **THE CTA SURVIVED ONLY BECAUSE IT WAS CHOSEN WITH HEADROOM.** `#C24E25` was
picked in 2026-07 precisely because it clears AA against BOTH cream and white;
had it been tuned to cream alone, this change would have needed a new CTA
colour. Its docblock said *"the target is not white"* — now false, and rewritten
rather than left to mislead.

**Comments carrying the old measurements are corrected, not left to rot** —
three of them stated ratios against `#FDFBF7`. A comment stating a stale number
is the trap this repo keeps paying for.

**Six hard-coded literals updated** (labels on coloured fills, one paper
fallback, one canvas fill). ⛔ `lib/thank-you-video-shared.ts` is deliberately
LEFT — that is a rendered video's own palette, pinned by its own test, not the
page ground.

🛡 **THE GUARDS RE-MEASURE THEMSELVES.** `palette-lock.test.ts` DERIVES the page
colour from `--color-cream` rather than hard-coding it, so it now checks against
white automatically — the difference between a guard that adapts and one that
would have kept measuring a colour that no longer exists.
🪤 My own verification tool then reported a false "`--m-paper` has drifted"
because IT compared hex case-sensitively while the real guard `.toUpperCase()`s
both sides. Checked the guard before believing my checker.

Not verified locally: no `node_modules` and `npm run build` cannot complete here.
**Nobody has SEEN this yet** — it is ~400 pages of ground colour and the owner
looking at it is the real test.

SPEC IMPACT: `DECISION_LOG.md` row + the palette memory both need the reversal.
