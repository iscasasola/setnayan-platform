## 2026-09-11 · feat(story): a published story shows its own card on an Unlisted site — owner ruling item 13

Owner ruling 2026-09-11 (DECISION_LOG ⚖️ row, NEEDS_THE_OWNER item 13 → A). Measured before: https://www.setnayan.com/songdesk-story-proof while Unlisted → `og:image` = `/brand/og-card.webp`; Public → the story card. A host who pressed "Published — everyone can read it" on the default Unlisted site shared a link that previewed as "Setnayan".

- `lib/who-sees-the-link-preview.ts` (new, pure): public → the couple's card + names, indexable · unlisted + published → card + names, **noindex** · everything else (unlisted-unpublished or taken back, private, invited_accounts, unknown) → the stub, nothing that names the couple. **Decided and stated:** on an Unlisted+Published site the TITLE carries the names too — the page is noindex (no search snippet exists) and the card itself names them.
- `app/[slug]/page.tsx` `generateMetadata` asks it; the story's state comes from `readStoryShareState` (new, beside `readStoryVersionAt`: one read for stamp + status, fails CLOSED to "not published").
- `app/[slug]/recap/page.tsx` — **found building this:** the recap's metadata never asked who may see the site, so a PRIVATE celebration's published recap previewed the couple's names and card to anyone with the address. It now asks the same rule (its own `isRecapPublished` is the "published"). And its `og:image` is now the VERSIONED `recapCardUrlFor` address S14 built — the share button used it, but the og:image every platform reads was still the bare URL, so a withdrawal never moved the recap's link preview.
- ⚠ Noted, not changed: `/api/og/realstory-slug/{slug}` renders the monogram card (names + date) for ANY slug regardless of site visibility — flagged to the owner.
- Tests: `lib/who-sees-the-link-preview.test.ts` (every row + both pages ask the rule). Sabotage: dropping the unlisted+published arm (1 → 0) → fail 1; restoring the old `visibility !== 'public'` gate in the page (rule-gate 1 → 0) → fail 1.

SPEC IMPACT: DECISION_LOG 2026-09-11 ⚖️ row updated with this PR's number (item 13).
