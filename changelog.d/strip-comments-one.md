## 2026-11-23 · fix(guards): one comment-stripper change — a JSX self-close after `}` is not a pattern, and `${ … }` is code

PRs #8147 and #8148 combined into one change. Both edited the same lexer in `apps/web/lib/strip-comments.ts` and its JS twin in `apps/web/scripts/port-controls.mjs`. Both fixes hold together: `}` is out of `REGEX_MAY_FOLLOW_CHAR`, and a template keeps a substitution stack. Both PRs' tests run together in `lib/strip-comments.test.ts`.

### #8147 · fix(guards): the comment stripper no longer reads a JSX self-close after `}` as a regex

`lib/strip-comments.ts` (the one comment stripper that source-scanning guards use) and its JS twin in `scripts/port-controls.mjs` treated a `/` after `}` as the start of a regex literal. In TSX that `/` is almost always the JSX self-close `x={1.9} />` or JSX text (`{a} / {b}`). In `icon={<S x={1.9} />} href={`/a`}` the fake regex ran to the `/` inside the template, the leftover backtick opened a template that never closed, and every comment after that point in the file survived stripping. Found while merging main into PR #8018: a "40%" inside a `{/* … */}` in `app/admin/gifts/page.tsx` turned `the-gift-limit-is-one-setting.test.ts` red.

Fix: `}` is removed from `REGEX_MAY_FOLLOW_CHAR` in both copies. Measured with TypeScript's parser over `app/` + `lib/` + `components/` + `tests/` + `scripts/`: 0 regex literals start after a `}` on the same line, and more than 12,000 JSX self-closes do. A regex that starts a new line after a block still lexes as a regex, because a newline resets the previous character.

Checked against every comment TypeScript's parser finds in 13,207 files: comments left standing fell from 217 in 28 files to 166 in 17, and no file gained one. The 166 that remain have other causes and are out of scope here.

Tests: `lib/strip-comments.test.ts` adds the repro, a JSX-text case, and a check that a regex on a new line after a block is still a regex. Each one is sabotage-checked: it fails when its own rule is broken (`}` put back in the set, or the newline reset removed). The twin-parity test also fails when only one copy is reverted.

### #8148 · fix(guards): the comment stripper reads `${ … }` as code — a template stack, not a flat string

`apps/web/lib/strip-comments.ts` (the one string-aware comment stripper behind the source-scanning guards) and its JS twin `stripComments` in `apps/web/scripts/port-controls.mjs` read a template literal from backtick to backtick. A `${ … }` substitution is code, so two shapes went wrong:

- **A comment inside a substitution was never stripped.** Example: `app/[slug]/_components/copy-my-link.tsx`, `className={\`… ${ // "Copied ✓" … }\`}`.
- **A template nested in a substitution closed the OUTER template** at the inner backtick, and the lexer then ran out of step for the rest of the file, in either direction. Example: `app/admin/settings/actions.ts`, where the inner template's `couldn't` opened a string that swallowed every comment below it. An inner `http://` instead blanks real code after it.

The lexer now keeps a stack. In template text, `${` pushes the current brace depth and lexes code. Only the `}` that returns to that depth resumes template text, so the `}` of an object or block inside a substitution does not end it. `}` is also taken out of `REGEX_MAY_FOLLOW_CHAR`. In TSX a `}` is followed by `/` most often in `<Peso id={id} />`, and that `/` opened a "pattern" running to the next slash on the line (`text-ink/60"`), whose `"` put the lexer out of step. The substitution's own `}` no longer reaches that test. Both copies were changed in the same way and differ only in type annotations (the existing parity test holds).

**Measured by TypeScript's own comment ranges** over app/ + lib/ + components/ + tests/:

| lexer | surviving comments |
|---|---|
| `main` before this change | 217 in 28 files |
| `}` removed only | 166 in 17 files |
| template stack + `}` removed | **32 in 1 file** |

The one remaining file is a different shape: JSX text, `</span> / <span className="… text-ink/80">` in `StdBuilderClient.tsx`. It is pinned, not fixed, here.

Tests in `apps/web/lib/strip-comments.test.ts`. Each was sabotage-checked: red on the old lexer and green on the new one.
- a comment in a substitution (`//` and `/* */`);
- a nested template, both directions (comments surviving; code eaten by an inner `http://`);
- a `}` of an object/block inside a substitution does not end it (also red under the sabotage "any `}` closes");
- `} />` is not a pattern (red with `}` put back);
- **new: the TypeScript comment oracle as a per-file ratchet** (`SURVIVORS_ALLOWED`). The parse oracle sees only eaten code, never a surviving comment. Red on the old lexer, with `}` put back, and with the allowance lowered by one.

The parse oracle ("never makes a file stop parsing") stays at 0 broken files.

SPEC IMPACT: None.
