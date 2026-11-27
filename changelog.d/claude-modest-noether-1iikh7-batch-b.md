## 2026-11-27 · ship: OLD-account Batch B (L7 #8418 + small #8426 + L4b #8436 + L8 #8421)

One ship branch for the second OLD-account batch: one CI run, one deploy.

- Merges #8418 (L7 admin), #8426 (Lights & Sounds + Find empty), #8436 (L4b: "Free to start" and "e.g." hints out) and #8421 (L8 layout polish) with merge commits.
- Conflicts resolved by keeping both sides: `rotating-hint.test.ts` (L4's Guests-search pin + L4b's add-sheet pin), `front-door-words-hold.test.ts` (L4b's newer note), `contracts/page.tsx` (L4's `routes` import + L8's `BackButton`).
- `no-eg-placeholder-in-a-box.test.ts`: dropped the allow line for the Guests search box, which Batch A already fixed.
- Regenerated `lib/ugat/screens.generated.json` once; its only change is the small builds' new door.

SPEC IMPACT: None beyond the lanes' own entries. The owner's 27 Nov rulings are already in DECISION_LOG.
