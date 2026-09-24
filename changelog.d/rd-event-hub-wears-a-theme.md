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

SPEC IMPACT: None. The theme ids, tiers and `feels` mapping are unchanged; only the labels a couple
reads, plus four registrations that render nothing.
