## 2026-08-11 · fix(truth): four defects the truthfulness pass introduced or missed

Follow-up to PR #4354. An adversarial review of that PR's own twelve edits raised 17 findings;
12 were refuted on independent verification and **4 survived** — all 4 confirmed by reading the
code, and one confirmed by *executing* the affected renderer. Two of the four were defects the
previous pass **introduced**. This fixes all four.

**1 · `/llms.txt` was one rebuild away from going dark (high).**
Retiring `PAPIC_ADDON_STORIES` trips the `RetiredSkuError` guard in `lib/llms-txt.ts`: the code is
an entry in `REQUIRED_RETAIL` and is quoted in the prose, and the route selects retail rows
*without* an `is_active` filter, so the row arrives present-but-inactive and the render throws. The
route's bare `catch` then serves its short fallback stub — the whole AI/GEO surface silently
replaced by a pointer, with the nightly SEO check flipping to price-drift findings for every SKU.
**Verified by execution:** the module's own fixture renders 16,896 chars; flipping only that one
`is_active` throws `RetiredSkuError`. Fixed the way the file itself documents (and the way
`EVENT_SUBDOMAIN` was retired the same day): the `REQUIRED_RETAIL` entry is removed and the prose
line rewritten — to **free**, not deleted, because the feature still exists and only the sale is
gone. Every one of the 16 remaining advertised codes was then checked against the live catalog:
all active.
🪤 **CI could not see it.** `llms-txt.test.ts` hand-codes `is_active: true` for that exact code, so
the suite passed green while prod diverged. The fixture is now corrected and carries a note that it
is a second hand-typed copy of the catalog.

**2 · The "one livestream tile" fix was in dead code (high).**
PR #4354 filtered the retired Cast tile in the Studio hub's own `surfaceOk`. That never runs:
`studio/page.tsx` redirects to `/suite` on its 11th line, and its own comment says Suite being off
"never [happens] in prod". The couple still saw both tiles. Moved to `addOnOfferedForEvent` — the
shared gate the Suite actually calls, which already carries an identical per-key exclusion.
🔑 **A fix in a file nobody executes is not a fix.** The task brief had even stated this redirect,
under a different item, and the previous pass failed to carry it across.

**3 · "Your stream is still on air" was also false (high).**
The replacement wording asserted the opposite of the original and was wrong in the other direction.
Provisioning creates the broadcast *container* and its RTMP endpoint but puts no video into it —
this file's own header says a provisioned broadcast with nothing pushing to it "shows as `ready`,
never `live`", because browsers cannot push RTMP and the couple's own encoder must run. Telling a
host they are on air is how they never start it, and a wedding is not re-runnable. Both sentences
now claim only what the function knows — which cameras did not start and what that costs — matching
the sibling `youtube_error` case, the one wording that was never wrong.

**4 · "nothing is queued on our servers" was false (medium).**
Submitting *does* insert a `patiktok_render_jobs` row with `status:'queued'`; the button's own
pending label reads "Queuing…" and the next screen says "Render queued." A job is queued and tracked
server-side — only the *render* happens in the browser. The claim is dropped, and the copy now also
says a copy is saved to the event gallery, which the finished renderer states and the previous
wording understated.

Verified: typecheck clean · 7,620 unit tests pass · every `REQUIRED_RETAIL` code checked against
production.

SPEC IMPACT: None — PR #4354's corpus edits (Stories off sale, Live Wall live) stand unchanged.
