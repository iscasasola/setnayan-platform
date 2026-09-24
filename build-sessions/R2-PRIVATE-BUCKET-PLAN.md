# Closing the `setnayan-media` public bucket — canonical plan

> **PARKED 2026-09-17.** Designed today, then deprioritised the same hour: the owner needs the
> wedding / Event Hub / Papic / vendor-comms flows running by **Saturday 2026-09-19**. This is a
> multi-week pre-flip effort whose only hard calendar constraint is the flip landing by about
> **11 November** (31 days before the 12 December wedding, so the `/_next/image` cache ages out).
> Pick it back up after Saturday. Nothing in it is urgent this week.
>
> Evidence base: a 7-lane blast-radius map + 3 independent verdicts, `origin/main` @ 09741c4ac,
> measured 2026-09-17. Raw digest: `R2_BLAST_RADIUS_DIGEST.md` in the session scratchpad.
> Plan authored by Fable; measurements by Opus.
>
> ⚠ Re-measure before acting on any line. Several documents in this repo said `R2_PUBLIC_URL` was
> "unset in production" — it is SET, proven two ways. That false line is what made everyone size
> this wrong.

## The one-line problem

Every guest photograph, save-the-date film, prenup still, site music track and e-gift QR in
`setnayan-media` is fetchable by anyone holding its URL — no cookie, no signature, no expiry — at
`pub-37d64fe618584c2981a88610a55dd439.r2.dev/<key>`.

🔑 **The app's signing is decoration today.** A presigned URL and the public URL share the same
path: strip `?X-Amz-…` off any signed URL the app emits and you have the permanent public twin.
So the ~131 presigning call sites protect nothing while the bucket is public. Measured: a real
December couple's 142 MB save-the-date film, 4.4 MB prenup still, site music, e-gift QR, three real
guest captures, and a capture from an event set to *unlisted* — all HTTP 200, unauthenticated.

And every "take my photo down" control — moderator Hide, "Not me", guest un-post, couple hide,
consent withdrawal — writes a flag and leaves the file at its URL, while stamping the report
*"Content hidden by Setnayan moderator."*

## The approach

Make the bucket private, **flipped LAST**, after moving everything that reads from it onto the two
delivery paths that already run in production for the other four buckets:

- **Presigned GETs** for per-request, session-backed surfaces (already the path for the photo walls
  and wedding pages). Signs against `setnayan-media.<account>.r2.cloudflarestorage.com` — a
  different host, so it does not depend on the bucket being public.
- **The same-origin proxy** `/papic/media/{bucket}/{key}` for the short list that structurally needs
  a never-expiring URL: marketplace photos fed to `next/image`, the cached Booth Studio scene,
  social-card covers. It is live today — **and currently an open door on our own domain**, serving
  an unlisted event's capture to anonymous callers. It gets a gate before it gets more traffic.

The bucket toggle is the only step that reverts in seconds from a dashboard, with no deploy, no
migration, no data change. Everything irreversible happens first, while the public bucket still
works and nothing can break.

## Explicitly NOT doing

- **Custom domain + Cloudflare edge rules — DNS kills it.** `setnayan.com` is not a Cloudflare zone
  (GoDaddy `ns09/ns10.domaincontrol.com`; the Cloudflare Domains list is empty). Every edge feature
  needs the zone on Cloudflare = migrating DNS, which root `CLAUDE.md` rules out for one feature.
  `media.setnayan.com` was owner-ruled out 2026-09-05 and is NXDOMAIN.
- **Signing everything** — SigV4 caps at 7 days; `booth-studio.ts` refuses signed URLs by design
  (cached payload); `/_next/image` keys its cache on the full URL, so a rotating signature is a
  fresh billed transformation per render.
- **Proxying everything** — a 300-guest wall on venue wifi is exactly the burst the proxy must not
  carry. Walls stay presigned.
- **Deletion instead of a private bucket** — five of six removal controls are reversible by design,
  the owner's retention lock says keep-and-blur, and no deletion reaches an object whose row is
  already gone. Real deletion is worth having (step 18); it is not the fix.
- **A big-bang bucket split** — rewrites 130 refs across 12 tables with no DB backup, and a new
  bucket gets a different `pub-*` host that the compiled-in desktop guard refuses just as firmly.

## Sequence (19 steps)

**Step 0 · OWNER · ~1 hour, one sitting — settle the assumptions.**
(a) **The throwaway-bucket test** — on a SCRATCH bucket, never `setnayan-media`: enable the r2.dev
subdomain, mint a presigned GET, confirm 200, **disable public access**, re-run the same presigned
URL → must still be 200. If it dies, the whole plan is wrong and nothing of ours was touched.
Also copy the CORS policy over and confirm the header survives. (b) Screenshot `setnayan-media`'s
CORS policy + note any Object Lifecycle rule. (c) Confirm `R2_PUBLIC_URL` and `R2_ACCOUNT_ID` via
`/admin/integrations` — **not** `vercel env pull`, which returns `[encrypted]` and is probably how
"unset in production" got written into five documents. (d) Is `NEXT_PUBLIC_FACE_MODEL_URL` set in
Production? (e) Three questions only the owner can answer: how many desktop installs exist beyond
his own; has any `pub-…r2.dev` URL been pasted into a deck/email/post; does the Oracle auto-recap
worker hold R2 credentials or curl the public host.

| # | Who | Model · effort | What | When |
|---|---|---|---|---|
| 1 | ENG | `Sonnet 5 · low` | Correct the false "R2_PUBLIC_URL is unset" claims across `next.config.ts`, 5 build-session docs, and 3 other stale comments | parallel |
| 2 | ENG | `Sonnet 5 · medium` | Fix `sw.js` caching opaque cross-origin responses as success (would cache refusals for 30 days post-flip) | must-before |
| 3 | ENG | `Opus 5 · high` | **Gate `/papic/media`** — it serves an unlisted event's capture to anonymous callers today. Copy the shipped `/api/pabuya/qr/[publicId]` gate shape. Blocks 4, 5 | must-before |
| 4 | ENG | `Opus 5 · medium` | Repoint the 8 `publicUrlForStoredAsset` sites (explore, vendors tab, wizard, plan-groups) at `stableMediaPath()`; theft-watch to presign | must-before |
| 5 | ENG | `Sonnet 5 · medium` | Booth Studio posters + delete the 2 direct `process.env.R2_PUBLIC_URL` reads | must-before |
| 6 | ENG | `Opus 5 · medium` | Stop `r2Upload` minting absolute URLs into rows (6 writers, each with its own reader). Blocks 11 | must-before |
| 7 | ENG | `Sonnet 5 · medium` | Desktop web side: read the manifest with credentials; `/api/download/*` 302 to a presign | must-before |
| 8 | ENG | `Opus 5 · high` | **Desktop v0.0.2** — move the updater onto an origin we control. The chicken-and-egg: `EXPECTED_ENDPOINT_HOST` is compiled into every v0.0.1, so the replacement must publish to the OLD endpoint before the flip | must-before |
| 9 | OWNER | — | Decide the desktop window (from 0e). After the flip a v0.0.1 install can never update | must-before |
| 10 | ENG | `Sonnet 5 · medium` | Move face-api weights same-origin (`NEXT_PUBLIC_*` can never be signed) + one Vercel env edit | must-before |
| 11 | ENG | `Sonnet 5 · medium` | Retire the ~80 rows where the host IS the stored value. Branch on VALUE SHAPE, never column name | must-before |
| 12 | ENG | `Sonnet 5 · low` | Admin background-video previews: delete the public branch, its presign branch is already written and dead | must-before |
| 13 | ENG | `Sonnet 5 · medium` | Write `scripts/r2-flip-probe.sh` (bash, not zsh) and run it in BEFORE mode. **Verify the probe itself goes red first** | must-before |
| **14** | **OWNER** | — | **THE FLIP** — Cloudflare → R2 → `setnayan-media` → Settings → disable public access. Probe immediately; if the wedding-page probe fails, re-enable on the same page in seconds | **by ~11 Nov** |
| 15 | ENG | `Sonnet 5 · low` | Purge the `/_next/image` 31-day mirror (`vercel cache invalidate --srcimg` — documented, never run here) | after, same day |
| 16 | ENG | `Sonnet 5 · medium` | Remove the host literals from CSP, `remotePatterns`, preconnect; then owner deletes `R2_PUBLIC_URL` | after |
| 17 | ENG | `Opus 5 · high` | **Make the promise true end to end** — the presign TTL becomes the takedown latency. Gate at the MINT, not just the select. Owner picks the TTLs | after |
| 18 | ENG | `Opus 5 · medium` | Orphans, the raw PostgREST DELETE, and an audit row on cleanup | after |
| 19 | OWNER | — | Supabase Storage has TWO `public: true` buckets — `platform-assets` (fine) and `moodboard-library` (decide) | parallel |

## The blocker chain

`0(a) presign survives public-off` → everything · `3 gate` → 4, 5 · `6` → 11 · `7` → 8 → 9 → **14** ·
`1–13 merged AND SERVED, probe green` → **14** → 15–18.

**Where CI is structurally blind** (dummy env, no R2 vars): steps 4, 5, 7, 10, 12, 16 — production
probe or nothing. Step 8: CI never compiles the desktop crate. Steps 2, 3, 6, 11: CI sees them.

## Shape

16 engineering sessions — 3 `Opus·high`, 3 `Opus·medium`, 10 Sonnet. Owner-only: 0, 9, 14, 19 plus
four small dashboard edits. Pre-flip is a few working weeks, not days. Owner must be present for:
the step-0 hour (especially the scratch-bucket test — the only way to learn the plan is wrong
before paying for it), the step-9 decision, the flip + probe (~30 min, revert one click away), the
cache purge, and the TTL numbers.

🔑 **The bucket toggle is simultaneously the most consequential and the most reversible step. That
is why it is last, and why nothing before it may depend on it.**

## Open questions (15) — the ones that can change the plan

1. Does disabling r2.dev public access leave presigned GETs and CORS intact? → step 0(a).
2. Is `R2_ACCOUNT_ID` in the Vercel BUILD env? → `/admin/integrations`.
3. How many desktop installs beyond the owner's? → only the owner knows; decides step 9.
4. Does the Oracle auto-recap worker hold R2 credentials or curl the public host? → owner.
5. Has any `pub-…r2.dev` URL been pasted outside the app? → owner; every such link dies at the flip.
6. Does `vercel cache invalidate --srcimg` work on this plan and actually reset `age`? → run it.
7. Total size of `moodboard-library/figure_attire/` → decides step 11's route and tier.
8. What paints the homepage background? SSR HTML has no `<video>` and no r2.dev media URL — if a
   client-side loader pulls it, a `curl` probe cannot see it. Open the network tab once after.

Full list with the exact command or dashboard page for each is in the session digest.
