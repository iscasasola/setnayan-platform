## 2026-11-14 · fix(papic): main builds again — one import of displayChallengePrompt per file

Two merges (#7677 and an earlier one) each added `import { displayChallengePrompt }` to the Papic challenge
card row and add sheet, so main stopped compiling at b325988 ("Identifier 'displayChallengePrompt' has already
been declared", TS2300). Production was not affected: deploy-prod builds before it ships, so the site stayed
on 5cbf166. The second import in each file is removed; nothing else changes.

SPEC IMPACT: None.
