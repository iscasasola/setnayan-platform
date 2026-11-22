## 2026-11-22 · fix(guards): the comment stripper reads `${ … }` as code — a template stack, not a flat string

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
