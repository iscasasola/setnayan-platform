## 2026-11-27 · feat(gown-maker): the bride's body rules without 3D (step A2)

- New `apps/web/lib/gown/body-rules.ts` and `lib/gown/ease.ts`, ported from prototype v186 and pure (no three.js):
  - the ideal figure for her height (height first);
  - the limits that follow her height;
  - the weight estimate and fat share;
  - her bra size and its sentence;
  - the 28 cm cup limit (the ribs never grow for the bust);
  - the heel and bust-position snaps;
  - the shoulder estimate and shapewear;
  - one number moving while the others stay believable;
  - the soft "double-check" note;
  - the gown's own sizes (body + ease).
- Tests pin the prototype's golden numbers: ideal at 140/155/170/185 cm, the v170 bra pairs, the v169 limits, the v185
  cup limit, the v171 snaps.
- Nothing a person sees changes yet.

SPEC IMPACT: None (implements WHATS_NEXT_Gown_Maker_Port_2026-11-27.md §4 step A2 as written).
