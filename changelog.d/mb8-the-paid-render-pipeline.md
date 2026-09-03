## 2026-09-03 · feat(mood-board): a credit becomes a photograph

MB8 — the paid render pipeline. MB2 built the money substrate and MB7 built the free
surface with a *simulated* "Generate"; this wires the two together so a real credit buys a
real image, and so a failure to produce one is impossible to mistake for anything else.

**The provider.** `apps/web/lib/gemini-image.ts` — Gemini img2img, conditioned on the
stylized scene SVG (structure, via the shipped `renderVenueSvg`), the couple's inspiration
uploads (aesthetic, fetched through the existing `safeFetchImageBytes`), the `buildPrompt()`
stylist brief, and the per-box note.

⚠ **The endpoint is not the one the design rows imply.** The 2026-06-09 / 2026-09-03 rows
were written against `generateContent`; the live Gemini image API is the **Interactions
API** (`POST /v1beta/interactions`, `x-goog-api-key` header, `Api-Revision` pinned to a
date). Verified against `ai.google.dev/gemini-api/docs/interactions/image-generation` on
2026-09-03 and asserted in `lib/gemini-image.test.ts`, because getting any one of those
three wrong fails every call in production while every mocked test still passes.

🛑 **The model defaults to `gemini-2.5-flash-image` — the one the pack was PRICED against**
(~₱2.2/render, ~89% margin). `gemini-3.1-flash-image` is now Google's recommendation and is
probably better, but nobody has measured its cost against this SKU's margin, and a number
that governs money is not a guess to annotate and ship. Switching is an owner call and is
one env var (`MOODBOARD_RENDER_MODEL`) when they make it. **Surfaced for owner sign-off.**

**The weld — migration `20271201395665_moodboard_paid_render_pipeline.sql`.** MB2 shipped
`reserve` and `release` as separate functions, which leaves a seam a server action can fall
through in both directions: a reserve whose process dies before the INSERT (a credit gone
with no row anywhere recording an attempt — invisible and unrefundable), or a row written
with `credits_debited = 1` that never reserved (a free render every audit reports as paid).
`moodboard_begin_render` does the debit and the in-flight row in ONE transaction, so
neither is *representable*. `moodboard_fail_render` marks the failure AND refunds in one
transaction and is the only way to do either — it refuses on a delivered render (else
"fail" is a free-render button) and is idempotent on an already-failed one (else a retry
mints credits). `moodboard_finish_render` will not revive a refunded row or overwrite a
delivered image.

**The failure reaches the RENDER.** `lib/moodboard-render-failure.ts` maps every provider
failure code to couple-facing words via a `Record` over the union — a new code cannot
compile without someone writing the sentence, and there is deliberately no fallback string.
`buildTileViewModel` surfaces `failure` / `pending` / `insufficient` as FIELDS, so the
outcome of a real render is as unit-testable as the free preview always was. A log line
never changed a pixel.

The one failure the action cannot report itself — a killed process — is caught on the read
path: an in-flight row past `RENDER_STALL_AFTER_MS` renders as a failure with the credit
named and a button to reclaim it, rather than a tile that spins for the rest of the
engagement.

**Also:** the couple-private gallery (renders live in the PRIVATE R2 bucket, read via
short-lived presigned GETs; `bucket-routing.ts` gained a `renders/` rule so a prefix-routing
writer cannot land one in the public bucket by omission); the admin all-creations gallery at
`/admin/moodboard-renders` with a featured toggle; and the +1 consent bonus render, granted
inside `moodboard_set_share_consent` so consent and the render it buys cannot come apart,
once-per-event by a partial UNIQUE index rather than a racy check-then-insert.

🔒 **The admin gallery deliberately shows non-consented renders — locked owner decision**
(2026-06-09, re-affirmed 2026-09-03): that feed is how Setnayan compiles its own content
database. Consent gates PUBLICATION only, enforced at the write in
`moodboard_set_render_featured`, so the featured set is consent-clean by construction and no
read path has to remember to filter. A `WHERE consented` clause added later would be undoing
a decision, not closing a leak — said out loud in the page, the function comment, Ugat J44
and a db test.

**Sabotage-proved, four ways** — each mutation confirmed red, then restored and confirmed
green: the provider returning an empty success (4 red, incl. "a successful extract can never
carry zero bytes"); the tile's failure overlay deleted 3→2 (both the count guard and the
interpolation guard red — a file-level grep would have missed it); `fail_render` recording
the failure but keeping the money (2 red); and the weld itself broken with an `EXCEPTION
WHEN others` around the INSERT (red on the money, `1 !== 0`).

Two guards were wrong on their first run and were fixed rather than loosened: one aimed at a
docblock instead of the code (source guards here now strip comments before asserting code
shape), and the weld test reported "missing rejection" instead of the credit leak, so its
money assertion is now un-short-circuitable.

Ugat: J42/J43 `writtenBy` updated from "UNBUILT" to the real writers; new joint **J44** for
share consent. `tests/db/a-render-and-its-debit-are-one-transaction.db.test.ts` is the
wiring pin.

⚠ **`GEMINI_API_KEY` is set in Vercel PRODUCTION ONLY** (measured 2026-09-03 via
`vercel env ls`). Preview deploys therefore have no key and will show the
`not_configured` failure on the box — correct behaviour, and why that message says renders
are switched off rather than blaming the couple's board. The key's VALUE is unreadable from
a session (`vercel env pull` writes `GEMINI_API_KEY=""`), so **no session has exercised a
real provider call**; the first live render is the manual prod E2E.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — a new row recording
that the Gemini image endpoint is the Interactions API rather than `generateContent`, that
the model default is pinned to the priced 2.5 model with the 3.1 upgrade left as an owner
call, and that the +1 consent bonus is denominated in `credits_per_part` rather than the
retired pack's "6 total" arithmetic.
