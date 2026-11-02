## 2026-07-30 · fix(security): `events.our_photos` is now NSFW-screened before it can publish — the oldest open item on the register

`events.our_photos` is host-writable and renders on the **public guest page**, and nothing screened it. A named-deliberate exception in `lib/security/events-column-privileges.ts:185`, rendered by `[slug]/_components/our-photos-widget.tsx`: **arbitrary unscreened images, one host upload away from the public internet.** Longest-standing item on the security register.

### Why the existing screen wasn't already doing this

The screen itself was never the blocker — `lib/nsfw-screen.ts` ships and is proven, wired into `papic/guest-capture`, `vendor/papic-capture` and `pabati/clip`. The blocker was that **`our_photos` has nowhere to record a verdict.** `screenCapture` writes `moderation_state` on a *row* in `papic_guest_captures` / `papic_photos`; `our_photos` is a JSONB array of `r2://` refs on `events`. No row, no state column. That's the real reason this got deferred rather than done, and it dictates both decisions below.

### Two deliberate inversions of the house pattern

**1 · It screens synchronously, before the write.** Papic captures screen in the background via `after()` — correct there, because those rows start `'unscreened'` and every guest-facing surface excludes that state structurally, so a deferred verdict is safe. Here the moment a ref enters the array the widget renders it, so a deferred screen would have **nothing to hold back**. The verdict therefore precedes the `UPDATE`, and nothing unscreened is ever persisted — the public page *cannot* show an unscreened image. A structural guarantee, not a filter someone has to remember to apply.

**2 · It fails closed.** `classifyImageBytes` documents *"caller fail-opens"*, which is right for captures (a failure leaves the row hidden). Here fail-open would mean **publishing an unclassified image**, so an undecodable file, unreachable object or model-load failure **rejects** the photo. The trade is deliberate: *"that photo didn't save, try again"* is a far cheaper failure than an unscreened image live on a wedding's public page.

### The rest

- **Only NEW refs are screened** — re-ordering or removing within an existing gallery re-screens nothing, so the cost tracks what the host actually just uploaded. Sequential, because nsfwjs/tfjs decode is memory-hungry and a host submits a handful, not a batch.
- **Rejections are reported**, not silent: the action redirects with a message, and the editor page already renders `?error=` (page.tsx:126). A photo that vanishes unexplained reads as a bug, and the host is the only one who can choose a different image.
- **One query saved**: the PRO-grandfather check re-read `our_photos`; it now reuses the row the screen already needed.
- **Thresholds are the shared ones** — `decideNsfw` (Porn ≥ 0.7 · Hentai ≥ 0.75 · combined ≥ 0.8; "Sexy" alone never blocks, a deliberate false-positive guard at weddings). No second policy invented here.

**No backfill needed.** Verified against prod: all three events have `our_photos` length **0**, so screening at write time closes this permanently rather than leaving a legacy tail.

### Guards, mutation-tested

`lib/our-photos-nsfw-guard.test.ts` — 5 source-scan cases pinning the order of operations (a unit test would need to mock four dynamic imports and Next's `redirect`, and the property worth protecting *is* the ordering):

| mutation | result |
|---|---|
| make the `catch` fail **open** | *"the screen fails CLOSED"* fails |
| persist `deduped` instead of `cleared` | *"the write persists the CLEARED set"* fails |
| restore | 5 / 5 |

**Verification:** `tsc --noEmit` clean · `next lint` clean · `lint:retired` OK · **`test:unit` 5,454/5,454 pass**. No local `npm run build` (7 GB heap → SIGTERM 143).

**Still exceptional, deliberately:** `our_photos` keeps its entry in `events-column-privileges.ts` — the column is still host-writable by design. What changed is that the write path now screens; the privilege model is untouched.

SPEC IMPACT: None (no price, SKU, schema, flag or RLS change). The security register's oldest open item is closed — `SECURITY_HANDOFF_2026-07-26.md` and the security memory updated.
