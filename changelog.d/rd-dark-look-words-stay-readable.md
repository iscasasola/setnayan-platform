## 2026-10-08 · fix(hub): on a dark look the button's label, the footer and the host's ribbon can be read

Measured on the live page (`maria-and-jose`, 375 px): a Mood Board on a light paper wearing a DARK
ombré painted "Reply to the invitation", "Get inside" and "Upload your QR · Sign in" rgb(30 34 41)
on rgb(55 59 49) — 1.4 : 1 — the footer's "See you soon." 1.1 : 1, and the host's ribbon label in
the page's pale ink on its gold plate.

**Root cause.** `.button-primary` is `bg-mulberry text-cream`: its label IS the page's paper, and
its fill is "the colour that paper reads on". The theme block and the Mood Board size that fill —
and the accent's deeper steps (`--color-terracotta-600/-700`) and the link — against THEIR OWN
paper. The couple's background (a plain colour, an ombré, or a dark Shade on the main background)
then replaces the paper and the ink, and nothing else.

**The fix, where every layer has already been spread** (beside `pinPlateInk`, the same shape of
bug for the plate):

- `app/[slug]/_lib/pro-site-vars.ts` — `pinWordInks`: each coloured word token is re-measured on
  the paper the page ends with, against what it read at on the paper it was sized for. One that
  still reads is left exactly as it is; one that does not is moved away from the paper — its own
  hue, lighter on a dark page, darker on a light one — only as far as it needs (AA, or what it read
  at before when that was less). Where an ombré took the page to the OTHER side, each word is held
  over the whole ramp, as the ombré measures its own ink. A look whose paper never moved is the
  same object; a couple's own button colour is never moved. `pageWordBase` answers what the tokens
  resolve to under the background (`:root` → candlelight → the theme's block → the board).
- `app/[slug]/_lib/loaders.ts` — `guestLookFrom` calls it after the ombré is spread (with its
  ramp) and before the plate pin, so guests, the host's canvas, the RSVP page and the Maker's
  button sample all get the one answer.
- `app/[slug]/_lib/main-ground-layer.tsx` — a dark Shade flips the paper the same way
  (`shadeWordVars`); `shadeWordInks` sends the same words after it, in the same stylesheet.
- `app/[slug]/_components/owner-ribbon.tsx` + `tailwind.config.ts` — the ribbon is the plate's
  paper, so its label takes the plate's ink (`text-ink-on-plate`, falling back to the page ink).
- `lib/theme-colours.ts` — `themeBlockVars` exported (the theme block, already generated here).

**Guard.** `lib/a-dark-look-keeps-its-words.test.ts` runs the real `guestLookFrom` over the real
stylesheet: the label on its fill at rest and on hover ≥ 4.5 : 1 on 10 themes × 3 boards × 9
backgrounds (dark and light); the measured page with and without the fix; no coloured word harder
to read than before the background; a look that already reads is not repainted; the stylesheet
tables are the stylesheet's; the dark Shade. Sabotaged ten ways, each seen red.

No migration. No new client code (server composition and one Tailwind text colour). No new words,
no layout change.

**Not in this change (same root, reported):** `text-gild` words on the page (the plates need their
own gild-text first); the supplier's ribbon; `--color-link` on a dark THEME (no theme sets it).

SPEC IMPACT: None — applies the owner's 2026-09-25 ruling ("text colour adapts to every
background", free for every couple) to the tokens it had not reached.
