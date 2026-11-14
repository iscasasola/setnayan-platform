## 2026-11-14 · fix(papic): one `displayChallengePrompt` import, not two

`main` carried the same `import { displayChallengePrompt } from '@/lib/papic-missions'` twice in
`studio/papic/_components/challenge-card-row.tsx` and `challenge-add-sheet.tsx` (two walk-fix merges each added it), which
fails `tsc` (TS2300) and every production build. The second copy is deleted in each; nothing else changes.

SPEC IMPACT: None.
