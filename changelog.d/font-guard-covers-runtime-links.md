## 2026-08-13 · fix(build): the font guard now watches the runtime door too

Follow-up to `3b1fade66`, which stopped the build phoning Google for type. That
change is complete and verified — I checked it rather than rebuilding it:

- all **13** families are `next/font/local`; **zero** `next/font/google` imports
- **37** declared faces, **37** files present, **38** tracked in git
- no CSS `@import` and no `<link>` to Google anywhere
- the guard is wired into `ci.yml` with all **three** edits — step `id`, env
  binding, and the `check '...' "$VAR"` line — so it can actually fail the job,
  and breaking it on purpose turns it red

### The door it did not watch

`lint-fonts-are-local.mjs` caught `next/font/google` — the BUILD-time fetch. A
`<link rel="stylesheet" href="https://fonts.googleapis.com/…">` or a CSS
`@import` compiles perfectly and ships perfectly, and then **every visitor's**
page depends on Google being reachable. Same disease, one layer out, and it
would have sailed past the guard forever.

Added as check 1b, and the file walk now includes `.css` (a stylesheet was
outside the scan entirely). Scoped to `app/`, `components/` and `lib/` on
purpose: `next.config.ts` names both hosts in the Content-Security-Policy, which
is a policy statement, not a font load.

### Mutation-tested four ways

| mutation | result |
|---|---|
| a `<link>` to Google as real code | 🔴 red |
| a CSS `@import` from Google | 🔴 red — proves the `.css` widening is load-bearing |
| a comment *naming* `fonts.gstatic.com` | ✅ correctly ignored |
| the original `next/font/google` check | 🔴 still red |

🪤 **My first attempt at the `<link>` mutation reported a MISS, and the guard was
right.** The first literal `<head>` in `layout.tsx` sits inside a comment
explaining what the file stopped doing, so my sabotage injected the link into a
comment — which the guard is supposed to ignore. Two minutes were spent
suspecting a real blindness that did not exist. **A sabotage has to land in code,
and "it applied" is not the same as "it applied where I meant".**

SPEC IMPACT: None.
