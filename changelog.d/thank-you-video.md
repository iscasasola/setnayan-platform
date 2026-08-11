## 2026-08-11 · feat(papic): the Thank-You Video is real — a film a couple can actually make

**`PAPIC_ADDON_THANK_YOU` has been on sale at ₱2,499 since 2026-07-10 with no screen, no
maker and no render step anywhere.** A couple could pay and receive nothing at all. Owner
ruled "BUILD IT" 2026-08-10. This is the last thing on sale that nothing delivered.

### 🔑 The rails are the BROWSER — the server queue is the phantom

Established before a line was written, because getting it backwards would have shipped a
film that queues forever:

- ✅ **Real:** `lib/reel-render.ts` — 1,214 lines, client-side WebCodecs with a
  MediaRecorder fallback, **already shipping on three surfaces** (Patiktok booth, Guest
  Stories, the creator teaser). Owner-locked 2026-06-18: *"CLIENT-SIDE, ₱0 server compute…
  there is NO server ffmpeg/Remotion."*
- ❌ **Phantom:** the server queue. `render_jobs`, `patiktok_render_jobs` and
  `led_background_renders` are **all empty in prod**; **no worker exists anywhere in this
  repo**; `lib/render/recap-ffmpeg.ts` is a pure argv builder naming an "Oracle Always-Free"
  box that is not in this codebase; and the one file that looked like a worker was
  **deleted 2026-08-09 for faking a finished render**.

So this is a deliberate sibling of `buildChapterTeaserPlan`: the server assembles a plan,
the couple's browser encodes it.

### 🔒 Privacy — why the PUBLIC read, not the couple's gallery

A thank-you film is sent to the people who came, so it is an **outbound share** and takes
`fetchTeaserFrames`, not `fetchPapicGallery`:

- **Seat captures** — moderation-withheld and couple-hidden frames excluded.
- **Guest captures** — the **double consent gate**: the guest opted in to public use **and**
  the couple approved it for showcase.
- Every url is a **geo-stripped** display derivative, never the geo-bearing original; a
  frame without one is skipped rather than falling back.

🔑 **Reaching for the couple's own gallery would have been the natural-looking choice and
would have put unconsented guests' faces into a film sent to a hundred people.** The couple
owning the SKU does not make a guest's photo shareable.

### Download-only, deliberately

The finished file never uploads, never lands in a DB row, never joins a hosted feed — the
Guest Stories posture, not Patiktok's. Guests consented to *share* photos, not to have
Setnayan host and redistribute a film of them; and hosting would need a delivery surface, a
retention answer and a takedown path for a guest who changes their mind. ⏭ **In-app
delivery to attendees is a named follow-up, not an oversight.**

### Shape

- `lib/thank-you-video-shared.ts` — client-safe constants + **`planFromFrames`, the whole
  rule, pure**. 🔑 Its sibling `lib/creator-teaser.ts` keeps the identical min/cap/reason
  logic behind `import 'server-only'` and therefore **has no test at all** — a rule that
  cannot be imported does not get asserted.
- `lib/thank-you-video.ts` — thin server reader (consent-filtered frames + owned music).
- The page gates on `eventSkuActive`; **unowned renders a locked panel, not a 404**, and
  reads no gallery at all. A 404 on a card everyone can see reads as a broken app.
- A Studio catalogue entry, because **a maker with no doorway is the "mechanism never proven
  reachable" defect, not a feature**.

### Guards — 8 tests

The floor is inclusive (an off-by-one refuses the smallest wedding that qualifies) · the cap
holds but `availableCount` stays the **pre-cap** total, so *"you have 20"* can't be confused
with *"you have 500 and we used 20"* · a refused plan returns **zero** photos · the refusal
sentence names **consent**, not "no photos yet", because those send a couple to two
completely different actions · 20s ÷ 20 frames ≥ 0.8s each, or it is a strobe · the film
sits inside the 30-second ceiling every Setnayan reel shares · and the client-safe module
imports nothing server-only — **which `tsc` cannot catch**, since only `next build` models
the RSC boundary.

⚠ **Two of my own guards cried wolf and both receipts are in the code.** The boundary test
first scanned raw source and failed on the shared module's **own docblock**, which explains
the split and so says "server-only" in prose — now stripped through `lib/strip-comments.ts`.
And the contrast lint caught `bg-terracotta` (the light gold `#A9834B`, 3.37:1); the CTA
token is `bg-mulberry` (`#C24E25`, 4.61:1 AA). **The fix is the fill, not the label.**

Verified: `tsc` exit 0 · 13 tests · all 20 `lint-*.mjs` · `next lint` exit 0.

SPEC IMPACT: `DECISION_LOG.md` — the Thank-You Video ships, its consent posture, and that it
is download-only pending a delivery surface.
