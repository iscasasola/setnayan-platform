# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · feat(website): dress code + photo moments edit inline (PR-8)

The multi-field authoring settings come into the editor rail, taking it to **10 of 12** settings edited without leaving the page.

- **Dress code** — headline, guidance, palette and the do/don't lists, inline. Its form body was **extracted to `dress-code/_components/dress-code-fields.tsx` and is now rendered by BOTH the sub-page and the panel.** ⚠ That sharing is a correctness requirement, not tidiness: `updateDressCode` reads **every** field on each save, so a hand-written partial form would have silently **wiped the palette and lists it didn't post**. One set of fields makes that impossible and stops the two surfaces drifting. The JSONB parser moved with it (`normalizeDressCodeConfig`) so page and panel can never disagree about a malformed row.
- **Photo moments** — the existing self-contained `PhotoMomentsEditor` client component is embedded directly. Its action returns state rather than redirecting, so it **saves in place** with no navigation at all — the most WYSIWYG behaviour in the rail so far, and it needed no `return_to`.

**Editing inline (10):** sections show/hide/reorder · hero photo · photo gallery · background music + hero video · who can view · colors · special message · what to bring · dress code · photo moments.
**Still their own focused editor (2):** **our story** (17 fields + a milestones builder) and **editorial** (the long-form "After" writing desk) — both are large authoring surfaces where a full page genuinely serves the couple better than a rail panel; they stay one tap from the rail. No migration.

SPEC IMPACT: None — panels over the existing write layer; the dress-code extraction is behaviour-preserving (the sub-page renders the same fields it did before).
