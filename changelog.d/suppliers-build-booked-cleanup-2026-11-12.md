## 2026-11-12 · feat(suppliers): Build and Booked cleanups — B1–B3, K1–K3 (owner "Yes, build it")

The couple's Suppliers page keeps its three pages (Find · Build · Booked); this takes the repeats out of
Build and Booked, drawn to the approved prototype `controller-2026-11-12/suppliers-one-prototype-2026-11-12.html`
(concept A; cleanup notes in `suppliers-find-build-booked-2026-11-12.html`). Find and the pinned row are the
sibling build's.

- **B1** · Build's money block is three lines: total + budget words · the meter with its legend at the two
  ends ("booked ₱X" … "if booked ₱Y") · the fit line, whose "Help me choose" is now the quiet button. The
  head row and "buffer not knowable" (T3) are unchanged.
- **B2** · Lines with a booked supplier, a pick or someone to pick come first; the categories with nobody
  fold under one "Nobody yet · N categories" line, each keeping its "Find in X" door. A build with nobody
  anywhere opens the fold, so every category still shows.
- **B3** · On a phone the Compare section is one line, "Compare N builds", opening the same Compare sheet
  (frame 13). The All builds pane from 1024 is unchanged.
- **K1** · Booked drops its "Booked" heading (the pinned row says it); the sub-line is the first line.
  "Waiting for their yes" keeps its heading and ⓘ.
- **K2** · The plain green "Booked" pill is gone (`pillSaysMore` in `lib/booked-rows.ts`); a pill shows only
  when it says more ("Payment not received"). The Next: line, one row open at a time and the equal tiles stay.
- **K3** · "Used across your event" chips become one line: "Used in: Event Hub · venue & city · Schedule".

Rulings this overturns, each by this approval: frame 12's stack (B1, B2), frame 13's section drawing on a
phone (B3), the PR4 drawing's heading and pill (K1, K2). Guards: `the-build-is-the-approved-frame.test.ts` §6
and `booked-is-the-team.test.ts` §7 (each sabotaged red once); `build-body.test.ts` words updated
("if booked", "Nobody yet · "; the phone's "Side by side…" sentence is gone).

SPEC IMPACT: DECISION_LOG.md — a line on the 2026-11-12 Suppliers concept-A approval naming B1–B3 · K1–K3 as built.
