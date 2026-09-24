## 2026-09-24 · feat(themes): the picker speaks the couple's vocabulary, and four more doors are registered

The invite picker named its five doors after Filipino materials — House, Capiz, Velvet, Galeriya,
Abaca — with an owner word beside each (Generic, Elegant, Classy, Sophisticated, Rugged). Those
names describe the DESIGNS accurately and describe nothing a bride types. The couple now reads
**Classic · Elegant · Opulent · Modern · Rustic**, and four more registers are registered:
**Minimalist · Fairytale · Vintage · Custom**.

🔑 **The ids did not move, and that is the whole reason this was cheap.** `id` is pinned by a
database CHECK constraint, eight theme files, roughly four dozen source references, two guards and
every row a couple has already saved. `name` is one line. Renaming `capiz` → `elegant` would have
cost a migration rewriting live choices for a change no guest can see. Re-measure the id set with
`grep -n "INVITE_THEME_IDS" apps/web/lib/invite-themes.ts`.

⚠ **The four new doors are registered `ready: false`, so nothing renders and NO migration is
needed.** An unready theme is never offered on the picker and never drawn, and the CHECK constraint
only has to widen on the day a couple can actually save one — she cannot save what she is not
shown. `apps/web/lib/invite-themes.test.ts` holds that invariant directly: *"every theme a couple
can actually SAVE exists in the database"* passes today precisely because the four are unready.
Flip `ready` in the same PR as each skin, not before.

🧹 **Nine docblocks were naming a word that no longer exists.** `abaca.tsx` said "the Rugged invite
theme", `galeriya.module.css` said "the Sophisticated theme" — accurate the day they were written
and unfindable after the rename. They now carry the shipped word. Nothing user-visible changed in
those files; a docblock rots fastest where it is read most.

`apps/web/tests/e2e/invite-themes-look.spec.ts` writes the looking pass as a spec the owner can
run, rather than a checklist somebody remembers.

Merge note: `build-sessions/MERGE-CONTROL.md` conflicted add/add against `main`. It is a GENERATED
snapshot whose own header says to re-run the script rather than trust it, so `main`'s newer
2026-09-23 snapshot was taken whole. A generated file is regenerated or replaced, never hand-merged.

🔒 **One guard went red, and it was right to — but for the wrong reason.**
`the-site-wears-the-doors-theme.test.ts` demanded a material block for `minimalist`, a door that
cannot be opened. Its `PAINTED` set was `INVITE_THEME_IDS.filter(id => id !== 'house')` — an
**exclusion list**, which is a guard that breaks on the next registration rather than on the next
defect. It now reads `ready`, so PAINTED is what the picker actually offers.

**That is a narrowing, not a weakening, and the ratchet is what proves it.** `ready` is the same
flag the picker reads, so the moment a skin is switched on PAINTED grows and every assertion starts
demanding its material block, its token prefix and its pair count. Probed both ways: flipping
`minimalist` to `ready: true` with no skin takes the file to **2 failures**; restoring returns it to
**13 pass** with `dirty=0`. A new sibling test asserts the narrowing's own premises — that PAINTED
still holds at least four, that `house` stays out, and that every exempt theme is `ready: false` in
the REGISTRY rather than merely absent from a list in the test, which is how an exclusion list grows
back.

SPEC IMPACT: None. The theme ids, tiers and `feels` mapping are unchanged; only the labels a couple
reads, plus four registrations that render nothing.
