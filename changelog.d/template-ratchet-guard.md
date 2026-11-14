## 2026-11-14 · test(design): the design-template ratchet — no page may break the template more than today, new pages start at 0

Step 1 + 3 of the owner-approved "how do we reach 0%" plan (14 Nov 2026).

- `lib/template-score.ts` scores every page against the approved design template sheet with the 14 Nov audit's own patterns (corpus `prototypes/design_template_audit_2026-11-14.md`): long paragraphs×2 + cards + hand-made buttons×2 + raw hex + mono captions + empty cards×2 + raw `<select>`×2, over the page, its folder and its `_components`. Comments are removed with `lib/strip-comments.ts`, the repo's one stripper.
- `lib/template-score.baseline.json` holds today's score for every page above 0, sorted by path.
- `lib/template-score-ratchet.test.ts` (unit suite, so CI) fails when a page's score rises or a page outside the baseline scores above 0, and prints a reminder when a score falls. `pnpm --filter @setnayan/web template-score --write` only ever lowers the baseline.
- Exempt, each with a reason in `TEMPLATE_EXEMPT`: the front door, the five legal pages, the Event Hub (`[slug]`), demo pages (`tour`, `sample`, `demo-capture`), lab pages (`dev/`, seating lab).
- Today: supplier 873 · couple 2,541 · admin 1,346 · public 878 (the audit read 871 · 2,542 · 1,346; public is lower because the front door, legal and demo pages are now exempt).

No visible change.

SPEC IMPACT: None — the exempt list follows the audit note's own reading (front door and legal "should not be forced into the dashboard template"; Event Hub exempt).
