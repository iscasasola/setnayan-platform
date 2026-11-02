## 2026-10-23 · fix(team): the Helpers seat line says "more than your plan holds"; an error with a "%" no longer takes the page down

From the coordinator walk (owner, 23 Oct: "Keep what we have first and make them run smoothly"):

- A shop whose plan went down kept its people and read "3 of 1 seats used" — arithmetic that looks broken. `seatLine`
  (`lib/vendor-free-helper.ts`) now says "3 with you · your plan holds 1 seat".
- `helpers-view.tsx` decoded `?error=` a second time (Next already decodes `searchParams`), so a sentence with a "%"
  threw URIError and the Helpers page fell over instead of showing the line.

Guards: `lib/vendor-free-helper.test.ts` (over-the-plan property), `app/vendor-dashboard/team/the-error-line-shows-as-sent.test.ts`.

SPEC IMPACT: None.
