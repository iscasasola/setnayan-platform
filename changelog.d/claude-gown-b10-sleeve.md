## 2026-11-27 · feat(gown-maker): the sleeve block, from memory and marked to check (port step B10)

Gown maker port, step B10 (corpus `WHATS_NEXT_Gown_Maker_Port_2026-11-27.md` § 5, decision D27). The prototype never drafted a sleeve ("The sleeve block comes next"). This is Aldrich's close-fitting one-piece set-in sleeve **as remembered**. Every constant is printed in `GOWN_SLEEVE_DRAFT_TABLE`, to be checked against Metric Pattern Cutting before cutting (step B19).

- **Width and cap:** the underarm width is the upper arm plus the design's ease. The cap height is **solved** so the sleeve head equals the armhole plus 3 cm of cap ease (accepted 2–4.5). The cap is refused, in words, when that height falls outside armhole ÷ 4 … ÷ 2.5.
- **Long sleeve:** shaped at the elbow (+3 cm) and the wrist (the design's ease) down to the arm length (bent). Both underarm seams are drawn the same length.
- **Cap sleeve:** the cap and a short underarm seam.
- **No block for:** no sleeve, and a butterfly sleeve (a cape piece, said in words).
- **Measurements:** tape beats typed beats an estimate. An estimate marks the block "ESTIMATE: measure before cutting".
- **On the order:** the supplier's order view (B7) now draws the **Sleeve block** between the bodice and the skirt.
- **Guards:** `lib/gown-pattern/sleeve.test.ts` (4), on four arm sizes:
  - the sleeve head equals armhole + cap ease within 2.5 mm (sabotage-checked);
  - upper arm, elbow and wrist each equal tape + ease;
  - the underarm seams are equal;
  - the tape wins;
  - cap, none, butterfly and missing numbers each answer;
  - every constant is in the printed table;
  - the block never draws left of the sheet.

SPEC IMPACT: None. This builds step B10 as planned (D27: from memory, marked to check; B19 verifies against the book).
