## 2026-10-18 · feat(features): the /features pages say what ships today

The 18 `/features/<slug>` pages (+ Tagalog twins, sitemap, llms.txt, JSON-LD) were written 2026-10-01 and
described early-October screens. Every page was re-checked against `origin/main` code and the live
catalogue (read-only), rewritten in EN + TL, and five pages were added for shipped tools that had none:
**Suppliers** (Find · Build · Booked), **Dress code** (styles + call times), **Wedding March**,
**E-Gifts** and **Prints**. Nine real 375 px lab captures (fixture data, never a real event) land in
`public/feature-shots/` and show on Budget, Guest list, Seat plan, Schedule, Event Hub, Suppliers ×3 and
Wedding March.

False or unprovable claims removed: Budget's suggested split / three spending levels / typical range /
overdue call-out (gone since the B2 redo) · "Maybe" replies (off since 2026-09-30) · the "Allow plus-one"
tick (now a +1/+2 pick; also fixed in the `plus-ones` help article) · Setnayan AI's weekly digest (no
caller) · Memories taking guest messages · "cleared for sharing" music · Logo Maker "describe the feel"
(it is a layered editor) · Mood Board "free" with no mention of paid renders · "invitation site" and
"celebration" wording (also in the hub's who's-who and FAQ sections).

Guard (`app/features/features-page-says-what-ships.test.ts`): six new banned phrases, each with the
shipped fact that makes it false; the house-words check now also refuses "site" and "celebration"; a new
check fails on any `public/feature-shots/` picture no page shows. Sabotage-checked (3 red, restored green).

SPEC IMPACT: None (copy refresh of an existing surface per DECISION_LOG 2026-10-08 "FEATURE / DOCUMENTATION
PAGES … MOVE INTO LEVEL 1"; no decision changed).
