## 2026-08-24 · fix(guests): the gold slot stops painting words on the guests screens

W4-A screen 1 of 4. Sixteen kickers, text links and hover states across the
guests tree wore bare `text-terracotta` — the atelier gold #A9834B, which
measures 3.37:1 on the white page ground, below the 4.5:1 AA floor for text.
All sixteen move to the sanctioned text gold `terracotta-700` (#8C6932,
5.02:1 light / 5.17:1 dark), the same one-step-down fix W1-B applied to the
story page's eyebrows. Icons, checkbox accents and decorative arrows keep the
bare gold — 3:1 non-text bar, legal.

Also fixed on the way: `has-[:checked]:text-terracotta-700-700` in
invited-to-chips.tsx — a class Tailwind generates nothing for, so a checked
"invited to" chip silently kept ink text instead of its gold tint.

New guard `app/dashboard/[eventId]/gold-is-not-text.test.ts` pins the rule
over all four W4-A trees (guests · vendors · budget · alaala): comments
stripped before matching, `text-terracotta` matched with a not-followed-by-`-`
lookahead (the prefix trap), a per-file bill of the sanctioned icon uses
checked in BOTH directions, and a second rule refusing the malformed
`-N-N` shade shape. Vendors' and budget's remaining text sites are billed on
purpose — the W4-A follow-up PRs shrink the bill. Mutation-tested by
occurrence count: new-offender RED, bill-rot RED, comment-only GREEN,
typo-shape RED.

Measured before building (per the W4-A brief): the guests screen's STRUCTURE
already matches the Roster archetype after the 2026-08-22 rework — search,
filter chips, swipe rows, drawer, avatar selection all ship. The real delta
was colour register only, and this PR is exactly that delta.

SPEC IMPACT: None.
