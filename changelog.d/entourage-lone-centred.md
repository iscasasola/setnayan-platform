## 2026-10-17 · fix(entourage): a lone person is centred in every style

Owner, verbatim (DECISION_LOG 2026-10-17, "A LONE PERSON IN THE ENTOURAGE / WEDDING MARCH / STANDING WITH US IS
CENTRED"): *"on the entourage/wedding march/standing with us, if they are just 1 and no partner, center it instead of
just 1 side."*

- `app/[slug]/_components/entourage-section.tsx` — `PairRow`: On the axis (`roll-call`, the default) no longer keeps a
  lone person in one column with a blank partner cell; like Lines, he is centred across both columns. Only the place
  moves — his words are the axis's own as before (`roleBesideName`; no "Ninong" under a sponsor, owner 2026-09-30). The column words ("Ninong | Ninang") head a group only where
  a pair stands in it, in both looks. Pairs are unchanged. Lines and The march render byte-identical before and after
  (Lines already centred; the march is one numbered column).
- `lib/scene-styles-stages.ts` — the Maker's On the axis card line: "anyone alone is centred".
- Guard: `lib/a-lone-person-is-centred.test.ts` — every entourage style, two casts, a lone person in every kind of
  group: a one-person row is no column grid, has no empty partner cell, sets nothing to one side, and is centred.
  Red on the shipped code. `lib/the-entourage-second-column-is-the-partner.test.ts` updated to the new rule.
- Lab: `/dev/maker-lab/guest?entourage=<default|lines|march>[&art=candlelight]` draws the real section on a lone-person
  stand-in cast (`labEntourage('lone')`).

SPEC IMPACT: None — implements the existing 2026-10-17 DECISION_LOG row (corpus c0523c25).
