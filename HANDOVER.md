# HANDOVER — rd/entourage-lone-centred (PR #6593, DRAFT, label do-not-auto-merge)

Worktree: `~/Documents/Claude/Projects/wt-lone-centred` · branch `rd/entourage-lone-centred` · PR https://github.com/iscasasola/setnayan-platform/pull/6593
Head sha: see `git log origin/rd/entourage-lone-centred -1` (this file's commit is the head; the code head before it was `9976f676f6`).
⚠ DELETE THIS FILE before the PR leaves draft — it is a handover note, not repo content.

## The task
Owner ruling (corpus DECISION_LOG 2026-10-17, "A LONE PERSON IN THE ENTOURAGE / WEDDING MARCH / STANDING WITH US IS CENTRED",
corpus commit c0523c25): a pair row / role group holding ONE person with no partner draws that person CENTRED, not in one column.
Only the layout of the lone case changes; pairs stay as shipped.

## Done
- `apps/web/app/[slug]/_components/entourage-section.tsx` `PairRow`: On the axis (`roll-call`, default; heading "Standing with us")
  lone row → centred `<li class="text-center" data-solo-row="centre">`, no grid, no blank cell. Its words are the axis's own as
  shipped (`roleBesideName` + sr-only `said`) — a first cut gave it Lines' carried word and broke the owner's 2026-09-30
  "no Ninong under a sponsor" rule (CI red in the-heading-says-the-role.test.ts); fixed in 9976f676f6.
  Column words ("Ninong | Ninang") now show only when the group has at least one pair (both looks).
- Lines already centred (unchanged). The march (`entourage-styles.tsx`) is one numbered column — no change; md5 of before/after
  Lines + March screenshots identical. Post Event `EntourageScene` draws no pair columns — untouched. "Wedding March" =
  Maker part `march` → canvas `f:entourage` = the same EntourageSection.
- `apps/web/lib/scene-styles-stages.ts`: Maker card line "Each pair meets at the centre; anyone alone is centred."
- Guard `apps/web/lib/a-lone-person-is-centred.test.ts` (property: one-person row is not a grid, no empty cell, no text-left/right,
  is text-center; every registry style + null + two-sides; 2 casts). Proven RED on the old file (6 fails, all On the axis).
- `apps/web/lib/the-entourage-second-column-is-the-partner.test.ts` updated to the new rule.
- Lab: `/dev/maker-lab/guest?entourage=<default|lines|march>[&art=candlelight]` on `labEntourage('lone')` (lab-sample.ts).
- Changelog fragment `changelog.d/entourage-lone-centred.md`.
- Local: 92 targeted unit tests pass (run [slug] files with `app/[[]slug]/...` — a plain `[slug]` glob matches NOTHING);
  30/30 CI guards pass locally (runner: scratchpad guards.py reads ci.yml guards job).

## Left, in order
1. Wait for CI on 9976f676f6 (previous head failed only unit 2/3 = the-heading-says-the-role, now fixed). `gh pr checks 6593`
2. Re-take the On the axis AFTER screenshots (the current after-on-the-axis-*.png show the FIRST cut with "NINANG"/"BRIDESMAID"
   under the lone names — stale). Lines/March after shots are valid.
3. Copy fresh shots into `~/Documents/Claude/Projects/lone-centred-shots/`, delete this HANDOVER.md, push, report.

## Exact next command (takes the WALK lane, starts dev on 3471, shoots, releases)
```
D=/private/tmp/claude-501/-Users-icecasasola-Documents-Claude-Projects-setnayan-platform/91c3089a-02b5-458f-bcf5-1c6db3bf4032/scratchpad/lone-centred; $D/walk.sh $D
```
If that scratchpad is gone: `heavy-lock.sh acquire "walk:lone-centred"`, `pnpm exec next dev --port 3471` in apps/web, then a
playwright script at 375x812 dpr2 isMobile over `?entourage=default|lines|march` × (none | `&art=candlelight`), full-page,
hiding `nextjs-portal`; release the lane.

## Open questions (for the owner, flagged not decided)
- Column words hidden when a group has NO pair (all solos) — a layout consequence, but flag it.
- The host-side Wedding March DRAG editor (dashboard launch details-march) still shows an empty partner cell as a drop target —
  intentionally not changed (editor, not the guest Hub).

## Screenshots
`~/Documents/Claude/Projects/lone-centred-shots/{before,after}-{on-the-axis,lines,march}-{light,dark}-375.png`
(dark = the Candlelight dark Look; guest pages are light-locked otherwise).
