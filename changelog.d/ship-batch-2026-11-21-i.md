## 2026-11-21 · chore(batch): ship batch I — the 20 Nov booking-fee rulings and Pro tools

Merges:
- **#8061:** the 20 Nov booking-fee rulings. Rounding matches the DB, the cap comes from the live schedule, and the free-first-booking promise is retired.
- **#8077:** the photo challenge and the 3D booth move to Pro and up; the AI chatbot is Verified and up.

Two migrations ride on owner-controller GOs, each byte-identical to the file it was approved at:
- `20271356196197` (blob af65f1ba88)
- `20271356215288` (blob 29436d1289)

Batch conflict resolutions:
- `claim-door.tsx`: kept main's plan screen, which now lives in plan-sheet, and dropped the import that became unused.
- `supplier-front-data.ts`: the union of the imports.

Generated files, including the exposure baseline for #8061's new columns, are regenerated once. Server actions stay at 1251 of 1251.

SPEC IMPACT: None
