## 2026-11-27 · fix(social): Facebook post templates say what ships (content finalization S1–S9)

The drafted Facebook captions in the admin Social queue now follow the word and claim rules:

- **S1** The verified-suppliers milestone reads "✅ {n}+ verified suppliers on Setnayan. A person checks each one's business papers. Set na 'yan."
- **S2** The events milestone thanks hosts with "Salamat for planning with us. ✨" instead of a trust line.
- **S3** Badge posts link the supplier search (`routes.suppliers()`, new builder), not `/vendors`, which redirects to the supplier sales page.
- **S5** The named supplier welcome reads "Welcome to Setnayan, {name}! A newly verified {category} serving {region}. Set na 'yan."
- **S6** The logo share is labelled "Logo" and its caption credits Logo Maker.
- **S7** The retired reel is gone from the share flow: `ShareArtifactType`, its label, its caption, and the consent action's allow-list (now read from `SHARE_ARTIFACT_TYPES`). Prod had 0 reel consents.
- **S8** Anonymous credits say "one of our Setnayan hosts"; the recap title falls back to "A Setnayan event".
- **S9** The Social-queue composer no longer suggests raw CHANGELOG headlines (`lib/social/changelog-suggestions.ts` removed; no server action added).

S4 and the `flush.ts` half of S8 live in `lib/social/flush.ts`, a file PR #8268 changes, so they ship there. Guard: `lib/social/the-post-templates-say-what-ships.test.ts`.

SPEC IMPACT: None. Applies the approved L9 list (`docs/content-finalization-2026-11-27.md` § S); no product decision changes.
