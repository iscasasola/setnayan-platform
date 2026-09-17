## 2026-09-17 · fix(dashboard): Event Hub footnote no longer links to a budget page that bounces back

On an event type whose profile does not enable the `budget` surface, the Event
Hub (`app/dashboard/[eventId]/launch/page.tsx`) footnote still linked to
`${base}/budget` — but that page immediately redirects to the Overview when
`surfaceEnabled(profile, 'budget')` is false, so the link was circular. The
footnote now gates the budget `<Link>` on the same `surfaceEnabled(profile,
'budget')` check the destination performs, so the link is simply absent
instead of bouncing.

Guard: `apps/web/app/dashboard/budget-footnote-does-not-bounce.test.ts` (moved
out of the `[eventId]` directory because the test runner's glob treats
brackets as a character class and silently matches zero files there).

SPEC IMPACT: None.
