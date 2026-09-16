## 2026-09-16 · fix(qr): the monogram reaches the SERVED pixels, and says so on the wire

#5542 merged, deployed, and produced **the bare code in production on every
request** — 200, no error, no log line. The only way to find out was to decode
the served PNG and diff it against a control; the guards were green because the
composite works locally.

Two things were wrong, and the second is the one that matters:

1. **`(await import('sharp')).default`** inside a module that is ITSELF reached
   by a dynamic import — one interop hop nobody had verified on a lambda, copied
   from `lib/qr-decode.ts` whose own failure mode is silent. `sharp` is now
   imported statically, the form `lib/watermark-server.ts` and
   `lib/social/card.tsx` have rendered with in production for months. The module
   is still only loaded behind `lib/qr.ts`'s dynamic import, so no other route
   pays for it.
2. **The fallback was invisible.** Returning the plain QR when the badge cannot
   be drawn is correct — a guest's scannable code must never fail for a font —
   but `/api/website/qr/[slug]` passed no error handler at all, and the
   compositor had a second, quiet `return qrPng` for a non-square input that
   reported an anomaly as success.

Now: all three routes log the failure AND set `X-Setnayan-Monogram:
composited | fallback`, so the next person can measure it from outside with a
`curl -I` and no log access. `lib/glyph-path.ts` names the absolute path and the
runtime's `cwd` when a font is missing, instead of a bare ENOENT.

Three new guards hold all of it: every route carries a handler and the header,
the compositor has exactly one bare-code return and it is the reported catch,
and `sharp` stays a static import here.

SPEC IMPACT: None — the DECISION_LOG row for #19 already records the build.
