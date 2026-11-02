## 2026-09-08 · docs(encoder): S15's gate is five values, not four

S14 (PR #5334) measured something the S15 prompt did not know: **`R2_PUBLIC_URL` is unset in
Vercel too**, not only in the GitHub Actions store.

The two stores do different jobs. The Actions secrets get a desktop build **uploaded**;
`lib/desktop-release-server.ts` reads `process.env.R2_PUBLIC_URL` **at runtime on Vercel** to
**serve** it, and returns `null` without it — which is exactly what `/api/download/mac` and
`/api/download/windows` turn into their 503.

So setting only the four Actions secrets would publish a real artefact that `/download` still
refuses to hand out, and S15 would have reported the publish as a success while nobody could
install anything. Its step 0 now checks both halves and stops if either is shut. X0-TRACKER
item 6 says five values.

SPEC IMPACT: None — a session prompt and an owner-action tracker, not a product decision.
