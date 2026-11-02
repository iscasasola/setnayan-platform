## 2026-10-04 · fix(mood-board): a save that lands on the Mood Board's own page says whether it worked

The Do's and Don'ts save (`updateDressCodeLists`) sends a coordinator, planner or a no-Event-Hub host back to `/dashboard/<id>/studio/mood-board` with `?saved=1` or `?error=…`, but the page read neither, so a refused save looked exactly like a quiet one. The old Dress code page showed both; the lists moved to the Mood Board without them. The page now reads `searchParams` and renders `MoodBoardSaveNotice` (`studio/mood-board/_components/save-notice.tsx`): the error as an alert, a save as a status line, nothing otherwise; an error always wins over a stale `saved=1`. Couples are unaffected: they edit through the Maker, whose draft bar already shows save errors.

Guard: `studio/mood-board/a-save-landing-here-is-shown-here.test.ts` renders the notice, pins the page's mount to its own `searchParams`, and scans `app/` for every action that lands on this page with `?error=`/`?saved=` (finds one today). Sabotaged: dropping the mount → red; dropping the error text → red; restored → green.

SPEC IMPACT: None.
