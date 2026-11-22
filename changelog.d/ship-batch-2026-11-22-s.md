## 2026-11-22 · chore(ship): batch S — #8004 event plans part 2 · #8150 copy sweep

Ship batch S folds two reviewed PRs into one CI run:

- **#8004** @ ddd9fe114d: event plans re-cut, part 2. Migration `20271356433378` (blob 20a650d2d0, controller GO).
- **#8150** @ ad7f2674c1: words that contradicted current rulings. Suno dropped from subprocessors and /privacy. The Patiktok chip becomes "Video booth". Migration `20271357924837` (blob b20119f02c, controller GO).

Conflict resolved in `lib/every-pro-gate-names-its-part.test.ts`: #8004's list, without the Editorial buy page that #8150 deletes. The generated files were regenerated once.

SPEC IMPACT: None beyond what each PR's own fragment records.
