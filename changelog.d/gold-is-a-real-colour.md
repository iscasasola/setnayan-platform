## 2026-08-15 · fix(design): three colour families were used everywhere and existed nowhere — every one of those classes emitted zero CSS

Owner approved fixing the gold finding reported from the year-plan work. Looking for the second one found two more, and then a guard found the shape of the mistake.

**🚨 TAILWIND DROPS A CLASS WHOSE COLOUR IT CANNOT RESOLVE.** No error, no warning, no build failure — the rule is simply absent from the stylesheet, and the element falls back to whatever it inherits. For a `border-*` utility that is preflight's cool grey `#e5e7eb`, on a palette that contains no grey. **Rejected, not thrown; the only symptom is an absence** — the same family as the phantom column, the phantom enum value, the phantom RPC argument and the blocked iframe. It has now happened in CSS.

**Measured with the shipped config, before → after:** gold rules in the generated stylesheet **0 → 19** (control `border-ink/10` = 1 throughout).

| family | uses | what a person saw |
|---|---|---|
| `gold` | **78** across 12+ files | The Year view's whole *"Worth planning for"* band and the home *"This year"* milestone row rendered with **no fill and a cool-grey border** — the row meant to be the most emphasised was the only off-palette one on the tile. |
| `champagne` | 17 | `bg-` / `ring-` / `border-champagne-gold` on the arrival greeting and the guest hub — nothing. |
| `sage` | 4 | The vendor script desk's accent — nothing. |
| `canvas` · `page` | 4 | `text-canvas` on an ink button (**invisible text**) and `bg-page` as a page ground. |

🔑 **THE HEXES ARE NOT INVENTED — THE CONFIG ALREADY NAMED THEM.** `champagne gold (--m-orange #C5A059 / --m-orange-2 #A88340)` is written in `tailwind.config.ts` itself; `--m-sage` / `--m-sage-deep` are in `globals.css`. Both had been folded into the `warn` and `success` SEMANTICS, and nothing carried the plain names the components actually use. Registered under their own names rather than pointed at the semantics, because **a celebration is not a warning** — a value whose NAME misleads is a defect this repo has already paid for twice (`sponsored_included`, `tagged_only`).

⚠ **THE SHADES ARE CHOSEN BY MEASURED CONTRAST, NOT BY TASTE.** Against cream `#FDFBF7`, AA text needs 4.5:1 — `#A9834B` → **3.37 ✗**, `#95713D` → 4.32 ✗, `#8A6B39` → **4.79 ✓**, `#5C4726` → 8.52 ✓. So `DEFAULT` is the brand gold for **fills, borders and decorative icons** (3.37 clears the 3:1 non-text bar) and any real TEXT uses `deep`/`dark`. Two label sites and two `text-sage` sites move to the readable tone for exactly that reason; the remaining `text-gold` uses are all `aria-hidden` icons. **`globals.css` already stated this lock verbatim** — *"champagne on cream 3.37:1 NON-TEXT UI + LARGE TEXT ONLY"* — so the mapping agrees with the design system rather than reinterpreting it. `canvas`/`page` are just the cream ground and their four call sites now say `cream`; **no palette name was invented to cover a typo.**

🛡 **NEW GUARD, WIRED INTO CI WITH ALL THREE EDITS** (step + env binding + `check` line — miss one and a guard runs but can never fail the job). `lint-colour-exists.mjs` fails when a colour utility names a palette entry that does not exist. **4 mutations, each measured to land, all caught**, including "introduce a brand-new phantom colour", which is the case that matters.

🪤 **AND THE GUARD ITSELF WAS WRONG THREE TIMES BEFORE IT WAS RIGHT — each caught by running it, not by reading it:**
1. A substring scan reported **1484** failures, every one a **CSS property name** (`border-radius`, `text-transform`, `stroke-width`). Fixed by requiring the whole whitespace-delimited token.
2. Still **191**, now quoted CSS keys in style objects and ordinary English in content files (*"text-only"*, *"to-scale"*). Fixed by scanning only `className=` regions.
3. Still flagged `text-shadow` — from a **comment inside a className expression**. **The fifth time a text-searching guard here has matched its own explanation**, so it now imports the same string-aware lexer `port-controls.mjs` already uses rather than hand-rolling a fourth.

🪤 **AND MY OWN EDITS SILENTLY DID NOTHING.** Five `sed -i '' 's/\bfoo\b/…/'` calls reported success and changed not one byte — **BSD `sed` has no `\b`**. Only re-counting before → after caught it; `sage` had stopped being *reported* purely because the config key now existed. Redone with `perl`, occurrence counts printed. **The same lesson as verifying a sabotage landed, applied to an ordinary edit.**

SPEC IMPACT: `DECISION_LOG.md` — new row 2026-08-15 recording that `gold` · `champagne` · `sage` are registered palette keys, that text tones are contrast-derived, and that a colour name is now guarded in CI.
