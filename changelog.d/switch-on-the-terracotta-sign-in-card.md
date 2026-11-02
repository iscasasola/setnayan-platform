## 2026-08-21 · fix(auth): /login wears the same sign-in card as the rest of the site

Owner: *"switch it on."*

The seam panel — the one sign-in panel for the whole public site (front door,
marketing nav, public shop page) — has worn the terracotta card since
2026-08-13. `/login` did not. Same `<SignInCard>` inside both, two different
shells: signing in from anywhere on the site showed the designed card, while
landing on `/login` from a redirect, a refresh, a bookmark or a deep link
showed a plain greige one.

"One login everywhere" is owner-locked (2026-07-18). It was true of the FORM and
false of the SHELL.

**A shared inner component is not a shared look.** Now pinned by a guard that
asserts the wrapper, not just the card inside it.

### What /login was actually wearing

`--hr-pop1` = `#9a7bc9`, described in the stylesheet's own token block as
*"a la ELN's purple"* — the accent of the cinematic homepage the owner
**retired completely** on 2026-08-13. Two links on the sign-in page were the
last thing still painted in it.

### Switching it on would have propagated a sub-AA colour

Measured on this card's greige (`#f2f2f0`), not the cream the palette lock is
usually quoted against:

| element | before | after | bar |
|---|---|---|---|
| in-card links | `#9a7bc9` — **3.10:1** | `#b04722` — **4.97:1** | 4.5 text |
| eyebrow (10.5px) | — | `#b04722` — **4.97:1** | 4.5 text |
| submit button | ink | white on `#c24e25` — **4.76:1** | 4.5 text |
| 3px top edge | — | `#c24e25` — **4.25:1** | 3.0 non-text |
| "stay signed in" tick | gold `#a9834b` | `#c24e25` — 4.25:1 | 3.0 non-text |

**The locked action colour is not tuned.** `#C24E25` stays exactly where it
acts — the button fill and the top edge, both of which clear their bar. Only
small TEXT moves, and it moves to `#B04722`, which was already three rules above
as that same button's hover.

This is the rule the gold already has in this codebase: decorative `#A9834B`,
text `#8A6B39`. A brand colour that carries an action does not automatically
survive as body text on a darker surface.

⚠ This also raises the **seam panel**, which had been shipping its links and
eyebrow at 4.25:1 since 2026-08-13.

### Neither existing contrast guard could see it — and neither was broken

`doorway-palette.test.ts` reads `globals.css` and the `(shell)` doorways; this
card lives in `home-reskin.css`. `lint-label-on-fill-contrast.mjs` judges a
LABEL on a FILL declared with it — a link colour over a card background is not
that shape. It passes 1368 pairings and never examined this one.

New guard computes the ratios from values **parsed out of the stylesheet**,
never re-typed, so it follows the CSS instead of drifting from it.

### Mutations, all measured by occurrence count

- **M50b** — sub-AA colour back on the text (2 → 0): **RED**
- **M52** — vacuity: delete both text rules entirely (2 → 0), so the loop has
  nothing to iterate: **RED** (the `length >= 2` assertion catches it)
- **M51b** — take the card class off `/login` (1 → 0): **RED**

9097 unit pass · 0 fail (both new tests confirmed running in the suite, not just
standalone) · typecheck 0 errors · radius, port-controls and label-on-fill green.

SPEC IMPACT: None.
