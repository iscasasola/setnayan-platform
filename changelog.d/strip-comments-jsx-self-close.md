## 2026-11-22 · fix(guards): the comment stripper no longer reads a JSX self-close after `}` as a regex

`lib/strip-comments.ts` (the one comment stripper that source-scanning guards use) and its JS twin in `scripts/port-controls.mjs` treated a `/` after `}` as the start of a regex literal. In TSX that `/` is almost always the JSX self-close `x={1.9} />` or JSX text (`{a} / {b}`). In `icon={<S x={1.9} />} href={`/a`}` the fake regex ran to the `/` inside the template, the leftover backtick opened a template that never closed, and every comment after that point in the file survived stripping. Found while merging main into PR #8018: a "40%" inside a `{/* … */}` in `app/admin/gifts/page.tsx` turned `the-gift-limit-is-one-setting.test.ts` red.

Fix: `}` is removed from `REGEX_MAY_FOLLOW_CHAR` in both copies. Measured with TypeScript's parser over `app/` + `lib/` + `components/` + `tests/` + `scripts/`: 0 regex literals start after a `}` on the same line, and more than 12,000 JSX self-closes do. A regex that starts a new line after a block still lexes as a regex, because a newline resets the previous character.

Checked against every comment TypeScript's parser finds in 13,207 files: comments left standing fell from 217 in 28 files to 166 in 17, and no file gained one. The 166 that remain have other causes and are out of scope here.

Tests: `lib/strip-comments.test.ts` adds the repro, a JSX-text case, and a check that a regex on a new line after a block is still a regex. Each one is sabotage-checked: it fails when its own rule is broken (`}` put back in the set, or the newline reset removed). The twin-parity test also fails when only one copy is reverted.

SPEC IMPACT: None.
