## 2026-08-06 · fix(build): the Ugat table list crossed the client/server line, and nothing could see it

`ugat-console.tsx` is a `'use client'` component. It imported the VALUE
`UGAT_TABLE_KEYS` from `lib/ugat/data.ts`, whose first line is
`import 'server-only'`. That is a hard `next build` failure:

    Failed to compile.
    You're importing a component that needs "server-only".

PR #4201 could never merge — five red checks (production build, Vercel, bundle
size, Lighthouse, playwright), ~20 minutes of CI, for a one-line import.

**The fix.** `UGAT_TABLE_KEYS` and its derived `UgatTableKey` type move to
`lib/ugat/data-pure.ts`, which exists for exactly this reason (its docblock:
"split out of data.ts (which is server-only) so the ranking logic is
unit-testable"). `data.ts` re-exports both, so every server-side caller keeps
its `@/lib/ugat/data` import path unchanged. The single-source property the
original PR was built to establish is preserved — there is still exactly one
tuple, and the type still derives from it.

⚠ A re-export does not bind the name locally, and `data.ts` uses the type in six
of its own signatures, so it imports as well as re-exports. `tsc` caught that.

**Why nothing caught the original.** Nothing in the toolchain *can*:
`tsc` typechecks but is not a bundler and does not know what `'use client'`
means; the node test runner resolves `server-only` happily; `next build` is the
sole detector, costs minutes, and cannot run on the dev machine (7 GB heap →
SIGTERM). The feedback loop was "open a PR and wait."

`apps/web/scripts/lint-server-only-boundary.mjs` closes it to ~1 second. It
walks value edges from every `'use client'` file to any depth and reports the
full chain. Wired into `ci.yml` as a blocking guard and `pnpm lint:server-only`.
Current state: 623 client files, 164 server-only modules, zero crossings.

**Three things the guard learned by being wrong first** — each caught by
mutation-testing it rather than by reading it:

1. 🪤 **It first reported 157 violations, every one a false positive** — a
   client component importing a server action, which is the correct Next.js
   pattern (the action compiles to an RPC reference; its imports never ship).
   The walk now stops at `'use server'`. A guard that cries wolf 157 times
   teaches you to skim past the one time it is right.
2. 🪤 **It misread a correct `import type` as a value import.** A side-effect
   import (`import './ugat-console.css';` — no `from`) let the lazy clause match
   run through it and capture the *next* statement's `from`, losing that
   statement's `type` keyword. The clause may no longer contain a quote or a
   semicolon.
3. 🪤 **Re-exports are value edges too.** `export { x } from './y'` pulls y in
   exactly like an import — `data.ts` itself now does this. A transitive
   client → clean-module → server-only chain went UNDETECTED until a mutation
   test hid the middle link behind a re-export.

Mutation-verified in four directions, each sabotage confirmed applied before
its result was trusted: direct value import → red; transitive via re-export →
red with the full chain; `import type` → green; `export type … from` → green.

Also finds a **second** leak in the same file that the build never reported,
because `next build` stops at the first error.

SPEC IMPACT: None — build-correctness and a new CI guard. No product behaviour,
schema, pricing or copy changes.
