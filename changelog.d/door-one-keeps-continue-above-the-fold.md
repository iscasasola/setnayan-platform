## 2026-09-14 · fix(door): door 01 keeps "Continue" above the fold, for every theme and every name length

Row 4a (owner 2026-09-14, *"fix all 4a-4d based on your recommendation"* — the 4a
recommendation being **fix the DOOR, not the theme**).

**Measured in a browser at 375×812 on door 01's real component tree** — the top of
the "Continue" button, event carrying a date and no venue. BEFORE (these are the
Galeriya session's numbers, reproduced exactly by this session's harness before
anything was changed) → AFTER:

| theme | 10 chars | 27 chars | 45 chars |
|---|---|---|---|
| House | 599 → **452** | 599 → **450** | 615 → **463** |
| Capiz | 622 → **497** | 622 → **495** | 638 → **508** |
| Galeriya | 635 → **523** | 654 → **557** | 691 → **564** |
| Velvet | **648** → **550** | **669** → **588** | **720** → **596** |

Bar is **640**. Velvet is merged and live and missed it on a TEN-character name.
With a venue line as well (a two-line meta, which is what a real couple has) the
worst cell is Velvet at 45 characters: **708 → 612**.

🔑 **THE BAR BELONGS TO THE DOOR, NOT TO A THEME**, so all three parts are in
`DoorShell` and Abaca inherits them without knowing they exist:

1. **The column is top-ranged below `sm`** instead of centred. A centred card
   spends the fold twice — once on the air above it, and again on every pixel
   saved below it, because the column moves half as far as the content it lost.
   That is why "shorten the theme" could never win: Galeriya's whole 186px print
   was worth 93px of lift. Every one of these doors was DESIGNED as a top-ranged
   375×812 column; the centring is the port's.
2. **A tighter page rhythm below `sm`** — `py-4`, the wordmark gap, the rail's
   margins, the gap above the content. ⛔ NOT the card's own `p-6`:
   `capiz.module.css` positions its seal with `calc(-1.5rem - 33px)` and
   `galeriya.module.css` ranges its accent tab off `--ga-card-pad: 1.5rem`, and
   both of those literals ARE DoorShell's `p-6`. Tightening the card would have
   moved a seal and an accent tab off the edge they trace, on the live themes,
   silently.
3. **The name is FITTED, never truncated** — `lib/door-fold.ts` turns the name's
   length into a RATIO (untouched to 26 characters, floor 0.72), carried as
   `--door-title-fit` and applied by ONE phone-scoped `zoom` rule in globals.css.
   A ratio and not a size, because each theme sets its own name size in its own
   stylesheet and out-specifies anything the shell could say about `font-size` —
   a ratio multiplies whatever the theme asked for, so the shell imposes a
   ceiling without ever naming a size or knowing which themes exist. `zoom` and
   not `transform: scale()`, because only `zoom` changes LAYOUT: Velvet's
   four-line 168px name becomes 91px of recovered fold instead of the same 168px
   painted smaller.

**No skin file was touched.** No theme was shortened. The card, its 3px top edge
and its one action are untouched.

**The guard** — `app/_components/door/the-door-keeps-its-action-on-screen.test.ts`
— is built on a 27-character name and a 45-character one, asserts the y against
the 640 bar and prints every number. ⚠ It does NOT measure a pixel: `tsx --test`
has no layout engine, so it is an arithmetic model of the stack, calibrated
against 24 browser-measured cells and re-checked against every one of them
(within 4px), plus text pins on the three mechanisms. It calls the SHIPPED
`doorTitleFit`, re-reads each theme's name size from the skin's own stylesheet,
and fails if a `ready` theme has no entry — so a fifth theme cannot ship
invisible to it.

⚠ **WHAT IS NOT GUARANTEED, STATED PLAINLY.** `events.display_name` has no length
cap anywhere in the app. The fit's floor is a design limit — below it the
couple's name would be set under the body copy it sits above — so past roughly
**50 characters with a venue line** Velvet crosses the bar again (measured: 50 →
612, 55 → 642). Every length is still 90–110px better than before.

SPEC IMPACT: None. The 640 bar and the Q4 = B ruling it comes from are already in
`DECISION_LOG.md` (2026-09-11) and in `galeriya.module.css`'s port note; this
moves the fix from one theme's print height to the door itself and states the new
numbers.
