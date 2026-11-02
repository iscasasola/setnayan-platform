## 2026-09-24 · fix(build): twelve dead server actions come out — the route budget fits

Production could not deploy. Four builds died at `process-and-upload-routes` with
`Max is 2048, received 2053`, one of them carrying the fix for a live outage.

🔑 **EVERY `"use server"` EXPORT IS A ROUTE.** Measured from the real
`.vercel/output/config.json`, which is the only file that counts what Vercel counts:

```
TOTAL                 2050
  next-action          1248   ← 61% of the budget. One per server action.
  .rsc                  258
  pages / other         ~520
  segment-prefetch        1   ← a flag was shipped to "free ~1000" of these. There is ONE.
```

1,247 exported actions in 336 `"use server"` files, against 1,248 `next-action` routes. The
ceiling was never a feature, a cache or a config flag — **it is every save button ever added,
each silently taking a slot from a budget that is only ever reported when a deploy FAILS.**

**Removed:** 12 exported actions with no reference anywhere in the tree — not imported, not used
inside their own file. Ten are unwired wizard steps (`completePrenupTask`,
`completeMonogramTask`, `lockBoothToEvent`, `addPrincipalSponsorPair`, …), two are orphaned
life-story helpers.

**Measured before and after, locally, with a real `vercel build`:**

```
2050 → 2038 routes      (limit 2048)
1248 → 1236 next-action
```

⚠ **Two traps paid for on the way:**

**A local `vercel build` cannot work without overriding `NEXT_PUBLIC_APP_URL`.** `vercel pull`
writes the literal string `[SENSITIVE]` for masked values — **not** an empty string, as an earlier
note claimed. `metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? '…')` therefore does not
fall back (the value is non-empty) and `new URL('[SENSITIVE]')` throws, killing the build at
`/_not-found`.

**Do not delete a function by counting braces.** A first attempt at this change ate 62 KB of a
live 2,368-line file — a `{` inside a regex or template literal breaks the count. Use the
TypeScript parser: `ts.createSourceFile` + `getFullStart()`/`getEnd()`.

SPEC IMPACT: None.
