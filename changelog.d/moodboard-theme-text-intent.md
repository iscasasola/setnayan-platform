## 2026-09-03 · feat(mood-board): the theme description is read, and an eleventh mood exists for what it says

**The defect.** `events.moodboard_theme_description` has been saved since migration
`20271193183599`, shown on the vendor mood board and printed on the concept-PDF cover — and
read by **nothing**. Its placeholder ("Describe the feel in a sentence or two — the colors,
the mood, what makes it yours") invited exactly the sentence the field then ignored. The owner
typed *"i want to feel christmas vibe with a hint of classy elegance"*, nothing happened, and
said: *"if this will not help me generate a theme, remove it."* They chose to make it work.

**An eleventh mood — `festive_celebratory` / "Festive & Celebratory".** All ten existing moods
are aesthetic REGISTER (how polished, how dark, how ornate); not one expresses OCCASION ENERGY,
so the first half of that sentence had nowhere in the taxonomy to land. Measured across all
2,600 rows of `moodboard_theme_templates` before adding it: `christmas` 0 · `parol` 0 ·
`pasko` 0 · `evergreen` 0 · `poinsettia` 0. Migration
`20271199557759_moodboard_theme_templates_mood_festive_celebratory.sql` widens the `mood_tag`
CHECK to a `_v3` with eleven values, following `20271195711446`'s widening idiom verbatim.

⚠ **IT SHIPS WITH ZERO THEMES, ON PURPOSE.** Regenerating the 2,500 seeded rows to populate it
would rewrite a committed seed migration and every count the tests assert against — a separate
owner decision. So `lib/moodboard-theme-generator.ts` now keeps its own `ALL_MOOD_TAGS` list of
the **ten it actually generated** (it used to be `= MOODBOARD_MOOD_TAGS`), with
`UNGENERATED_MOOD_TAGS` naming the gap and two tests holding the subset relationship. Measured
for the owner's decision: running the new reader over every seeded theme's own name +
description, **4 of 2,600** read as festive (3 `bold_contrasting`, 1 `maximalist_complex` — all
hand-authored "fiesta" rows; the 2,500 generated rows produce none).

**A pure, deterministic reader** — `apps/web/lib/theme-text-intent.ts`. Sentence in, structured
reading out: `{ moods, families, colours, motifs, unrecognised, conflicts, excluded, notes }`.
It may only ever SELECT from shipped vocabularies (`MOODBOARD_MOOD_TAGS`,
`MOODBOARD_STYLE_FAMILIES`, `color-names.ts`, `RECEPTION_PARTS`) — never invent a hex, a label
or an option id — and two sweeps in `theme-text-intent.test.ts` fail if any dictionary entry
names something the app no longer stocks. Covers seasonal/occasion, Filipino heritage, plain
feeling words and Taglish; **scores every matched token rather than stopping at the first**, so
*"simple lang pero engrande"* keeps both halves and reports the conflict instead of confidently
returning half a sentence. Reads intensity too — *"a HINT of classy elegance"* weights 0.4
against christmas at 1.0 — and negation, so *"not too formal"* cannot read as a request for
formal. Everything it could not place comes back in `unrecognised` **and is shown to the
couple**; a reader that silently drops half a sentence is the inert field again, quieter.

**A model fallback, reached only when the dictionary finds nothing** —
`apps/web/lib/theme-text-intent-model.ts`, following `category-proposal-draft-server.ts`'s
shape exactly (`aiConfigured()` gate, `claude-haiku-4-5`, timeout, `maxRetries: 1`, catch
everything, never throw). It degrades silently to the deterministic reading when
`ANTHROPIC_API_KEY` is unset, and caches on the normalised sentence in a bounded in-process map.

🛑 **The sentence is treated as an INJECTION SURFACE, contained four ways**, because it is also
on its way toward the paid render brief: capped at 280 chars (the column's own CHECK) before
anything reads it; passed to the prompt as `normalizeThemeText`'s output, which is `[a-z0-9 ]`
and nothing else, so no bracket, quote, backtick or newline survives to forge a turn; framed as
data the classifier may never obey; and every returned value filtered through
`validateThemeSelection`. The strongest successful injection can therefore only produce a
different VALID chip the couple could have tapped by hand — and still sees and can remove.

**The couple sees the reading before anything changes.** Interpretation is an explicit act
("Read my description"), never on keystroke. What we understood arrives as removable chips,
what we did not is shown in their own words, and nothing reaches the board until "Use these" —
which fills empty palette/reception slots only (`mergeRolePalette` / `mergeReceptionDesign`,
the same never-overwrite rule as applying a template) and lands them on the matching themes in
the gallery below. `applyThemeIntent` re-validates the browser's payload through the same
whitelist the model's reply passes through, and always re-derives a colour's hex from the name
we stock rather than trusting the caller's.

**The placeholder no longer over-promises** — it now says what the button under it does.

**And an eleventh mood with no themes degrades to a sentence, not an empty grid.**
`ThemeTemplatePage` gains `moodTotal` (rows carrying this mood in ANY setting, a `head: true`
count), which separates two different zeroes: "not in this setting — N carry it elsewhere" from
"we haven't designed any themes with that feeling yet". Measured per fetch, so the copy corrects
itself the day the seed is regenerated; nothing in the code names which moods are empty.

**Also:** `color-names.ts` gains `namedColor` / `hexForColorName` — the name → hex direction,
an EXACT table lookup that returns null for a word we don't stock rather than guessing a colour.

Files: `apps/web/lib/theme-text-intent.ts` (new) · `apps/web/lib/theme-text-intent.test.ts` (new)
· `apps/web/lib/theme-text-intent-model.ts` (new) · `apps/web/tests/db/an-eleventh-mood-arrives-empty.db.test.ts` (new) · `apps/web/lib/color-names.ts` ·
`apps/web/lib/moodboard-templates.ts` · `apps/web/lib/moodboard-theme-generator.ts` (+ its test)
· `apps/web/app/dashboard/[eventId]/studio/mood-board/actions.ts` ·
`_components/theme-card.tsx` · `_components/theme-studio.tsx` (new) ·
`_components/template-gallery.tsx` · `studio/mood-board/page.tsx` ·
`supabase/migrations/20271199557759_moodboard_theme_templates_mood_festive_celebratory.sql`

SPEC IMPACT: **Yes — a taxonomy change.** The mood axis goes 10 → 11 with
`festive_celebratory` ("Festive & Celebratory"), and `events.moodboard_theme_description`
changes from inert stored prose into a read input. ⚠ **NOT applied to the corpus by this
change, deliberately.** The mood taxonomy has never been written into
`~/Documents/Claude/Projects/Setnayan/` — it lives only in `lib/moodboard-templates.ts` and the
CHECK constraint (grep for `dark_moody` across the corpus returns one unrelated music-catalogue
hit) — so there is no existing row to amend, and a NEW `DECISION_LOG.md` row would assert an
owner decision the owner has not made: the eleventh mood was proposed by engineering, and
whether to regenerate the 2,500 themes to populate it is explicitly left open. Surfaced for
owner sign-off rather than written as settled. Affects iteration 0010 Mood Board.
