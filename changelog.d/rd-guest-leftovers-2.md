## 2026-10-12 · fix(guest): the last presses under 44px on the Me tab and find-my-table, and 247 faint ink tints on guest pages

The independent walk of release a5c36f4 found three presses still under 44px: the Terms (39×18) and Privacy Notice
(90×18) links and the 20×20 tick under "Save to my account" on the Me tab, and the "Setnayan" header link (113×28) on
`/[slug]/find-my-table`. The reply page and the Me tab now draw the Terms line from ONE piece
(`app/[slug]/_components/terms-tick.tsx`): the links are plain inline links padded to 44px (no box round the word, so no
gaps in "the Terms and the" and "Privacy Notice" wraps as ordinary text at 375px), and the tick is a 20px drawing inside
a real 44×44 checkbox. The find-my-table link takes `/seat`'s `min-h-[44px]`. Separately, 247 of the 282 faint ink
tints frozen in `scripts/guest-faint-ink.baseline.json` (`text-ink/30–60`) now wear `text-ink/70` — at least 4.5:1 in the
house look and every Event Hub theme, light and dark; the record is 34. Only inks and press areas change; guests see the
same words. Guarded by `the-walked-pages-read-and-press.test.ts` (new rows + a box test) and the `lint:contrast` ratchet.

SPEC IMPACT: None
