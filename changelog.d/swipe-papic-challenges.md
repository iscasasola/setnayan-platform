## 2026-11-03 · feat(papic): a couple's own challenge deletes by its swipe, with Undo

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"). The Challenges page
row (`ChallengeRow`, studio/papic/couple-challenges-manager.tsx) loses its visible trash. A couple's own challenge is
wrapped in the shared `SwipeToDelete` (new client wrapper `_components/challenge-row-swipe.tsx`): swipe left on a phone,
the hover trash on a computer. It reaches the same soft remove (`deleteCoupleChallengeAction`, photos keep the
challenge) through the in-place door, after the Undo window (`deleteWithUndo`); a refusal brings it back and says so.
Setnayan / supplier challenges were never deletable and stay plain rows. The page mounts the one `UndoToastHost`. Lab:
`/dev/papic-camera-lab?lane=challenges`. Held by `the-challenge-row-deletes-by-its-swipe.test.ts`.

SPEC IMPACT: None
