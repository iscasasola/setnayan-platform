## 2026-06-28 · feat(weddings): Chinese wedding core — overlay spine + auspicious-date advisory + seating no-table-4

The code-only foundation for a fully-functional Chinese (Tsinoy) wedding, built on the
overlay model locked 2026-06-28 (`Chinese_Wedding_Traditions_Reference_2026-06-28.md`):
Chinese is a tradition layer on a primary rite — expressed as `ceremony_type='chinese'`
(primary) OR `secondary_ceremony_type='chinese'` (the common church-primary + tea-ceremony
overlay). No migration.

**PR-A — shared overlay spine.** New `lib/chinese-wedding.ts` exports `isChineseWedding(event)`
+ `isChineseOverlay(event)` — the single predicate every Chinese surface derives from, so we
never re-introduce the inline `ceremony_type === 'chinese'` drift that hid the traditions guide
pre-#2312. Mirrors `buildCoupleFaithSet` (which already unions primary+secondary on the vendor
side). Unit-tested (`lib/chinese-wedding.test.ts`, 6 cases incl. the secondary-overlay case).

**PR-B — Chinese auspicious-date advisory + "Consult a date specialist" CTA (advisory only).**
- `lib/auspicious-date.ts` — new `chineseAdvisoryReasons(date)` appends, into the existing
  positive-only "Ceremony notes" group, favourable framing for lucky 8/6/9 when the date carries
  them, a gentle avoid-4 note, an approximate Ghost-Month caution (copy tells the host to confirm
  exact lunar dates with a specialist), and a one-line BaZi / Four Pillars explainer. Threaded as
  an OPTIONAL `chineseTradition = false` final param on `computeAuspiciousReasons` /
  `computeAuspiciousReasonsDetailed` — non-Chinese output byte-identical. NEVER a verdict/score
  (locked §2.3); the app delegates BaZi to a specialist, never computes compatibility.
- `four-question-flow.tsx` — added the missing `chinese` option to the guided picker (a Chinese
  couple could not self-identify before).
- `auspicious-card.tsx` / `date-picker.tsx` / `date-selection/page.tsx` — derive `chineseTradition`
  via `isChineseWedding` (fires for primary AND secondary), pass it through, and render an advisory
  `ChineseSpecialistNudge` card. CTA is an advisory card today with a TODO to deep-link the
  `date_fengshui_consultant` vendor leaf once that leaf lands (no broken route shipped).

**PR-C — seating warn-on-table-4 + skip-4-in-auto-draft (advisory, never blocks).**
- `lib/seating.ts` — new pure `tableNumberEndsInFour(label)` (ones-digit-4 rule: 4/14/24/34/44,
  not 40/42) + optional `recommendTableSet(guests, {skipFour})` that advances past 4-ending numbers
  while still emitting the requested count. Default off → byte-identical.
- `seating/page.tsx` widened its events select to `ceremony_type, secondary_ceremony_type` (it read
  only `event_date` before — the root cause the seating editor never knew the ceremony) and passes
  `chineseTradition`; `seating/actions.ts` `buildSeatingDraft` passes `skipFour=isChineseWedding(event)`;
  `seating-editor.tsx` shows a calm advisory ("many Chinese families avoid table 4 — 四 sounds like 死;
  you can still use it") on manual create/rename of a 4-ending table, then lets the save proceed. No
  block, no throw, no CHECK constraint (locked advisory posture).

Verification: `tsc --noEmit` clean; 27 unit tests pass (chinese-wedding 6 + seating 21 incl. 4 new + auspicious-date).

SPEC IMPACT: None new — implements the already-recorded overlay model + the BaZi advisory posture
from `Chinese_Wedding_Traditions_Reference_2026-06-28.md` (corpus already updated; DECISION_LOG rows
2026-06-28). Follow-up PRs add the `date_fengshui_consultant` leaf the CTA targets, the temple venue
type, the tea-ceremony helper, and (dark) BaZi birth-data capture.
