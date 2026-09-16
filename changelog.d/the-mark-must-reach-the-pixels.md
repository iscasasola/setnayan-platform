## 2026-09-16 · fix(qr): the monogram reaches the SERVED pixels

#5542 merged, deployed green, and produced **the bare code in production on every
request** — 200, no error, no log line. Found by decoding the served PNG and
diffing it per-region against a control.

**Root cause: `types/opentype.js.d.ts` declared a default export that does not
exist.** opentype.js@2 ships `dist/opentype.mjs` with NAMED exports only, and
that is the build webpack picks for the server bundle via the package's `module`
field. `import opentype from 'opentype.js'` therefore evaluated to `undefined` in
every lambda — production said it verbatim:

```
EventLandingQrPng.monogram — "Cannot read properties of undefined (reading 'parse')"
```

`tsx` hid it completely: it resolves the CJS `main` and synthesises a default, so
every local test passed. The hand-written ambient type made it typecheck.

🔑 **A hand-written ambient type is a claim about somebody else's runtime, and
nothing checks it.** The new guard imports `opentype.js/dist/opentype.mjs` — the
exact file the bundler resolves — and asserts `parse` is a function and `default`
is undefined, then forbids a default import anywhere in `lib/` or `app/`.

⚠ **`lib/lockup-pdf.ts` carried the same import since 2026-06-14**, so the
monogram lockup badge on the seating-plan and concept-book PDFs could not have
drawn in production either. Reasoned from the code, NOT measured — those routes
are auth-gated and have no traffic in the 7-day error window. This PR's
extraction means one fix covers both.

Also in this PR, and the reason the cause was findable at all:

- **The fallback is no longer invisible.** Returning the plain QR when the badge
  cannot be drawn is correct — a guest's scannable code must never fail for a
  font — but `/api/website/qr/[slug]` passed no error handler, and the compositor
  had a second quiet `return qrPng` for a non-square input that reported an
  anomaly as success. All three routes now log AND set
  `X-Setnayan-Monogram: composited | fallback`, measurable with `curl -I`.
- `sharp` is imported statically here (the shape `lib/watermark-server.ts` proves
  in production) rather than through a second dynamic-import interop hop.
- `lib/glyph-path.ts` names the absolute path and the runtime's `cwd` on a
  missing font instead of a bare ENOENT.

SPEC IMPACT: None — the DECISION_LOG row for #19 already records the build.
