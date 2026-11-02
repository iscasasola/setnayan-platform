## 2026-08-26 · feat(papic): a couple can drop a file into their own library

Owner 2026-08-26: *"papic is the source where they collect media files for that event"*, *"they can upload their work via papic credits as well per event"*, and an uploaded photo takes *"the same spot as 1 papic photo"*.

**Add to your library** now sits in the library itself — not behind a settings tab, because the person who has just been shown what is in their gallery is the person about to add to it. Photos and clips, from a phone or a laptop, older memories included.

## 🔑 It wrote no new machinery, and that IS the feature

It presigns through the shipped `/api/upload` seat route and records through the shipped `recordSeatCapture` — so it inherits, untouched: the credit metering, the per-camera burst limiter, the server-side clip cap, the always-on safety screen, the derivative pipeline and the Drive copy. **The server derives the storage location and the claimer check from the seat token; the client never chooses where anything lands.**

**A second capture path is the failure this codebase pays for most**, and it is exactly what a future *"just POST the file to a new route"* edit would create. The guard exists to make that edit fail.

## Two rules that are money and safety, not style

**⚠ A clip's length is MEASURED and REFUSED, never passed through.** `papicClipCost` bills an absent or nonsense duration at the **top band** — the only direction a tampered client cannot profit from — so an unmeasured clip would **silently overcharge a couple for their own upload**. Over-length files are refused in the picker, by name (*"this clip is 18 seconds — Papic clips are 10 seconds or less"*), before anything is presigned and before a credit is reserved.

**⚠ A clip always carries a poster, uploaded FIRST.** The safety screen reads a clip **through** its poster frame; a posterless clip stays `unscreened` **forever** and is excluded from every guest surface silently. A clip whose poster cannot be produced is refused rather than stored in permanent limbo — and the poster goes up before the clip, so a failed poster never leaves a stored clip that can never be screened.

## ⛔ The claim does not reuse `claimPapicSeat`, and that is not an oversight

That action **redirects to `/papic/seat/${token}` on success** — the camera screen. Posting the studio's button at it, as the build plan proposed, would carry the couple **out of their own studio onto a viewfinder they did not ask for**. `claimUploadsCamera` is the same RPC under the same session with a different destination.

🔑 **The claim runs under the couple's OWN session, never the admin client**, so the `SECURITY DEFINER` RPC re-checks `auth.uid()` and refuses `'taken'` rather than overwriting a claimer. The couple check decides who may *ask*; the RPC decides.

⚠ The token is read on the admin client because **a couple cannot see their own UNCLAIMED camera under RLS** — `paparazzi_seats_claimer_read` only returns a seat once you are its claimer. The read is pinned to this event and the reserved index, so it can only ever return the one seat.

**Uploads are serial, deliberately** — the per-camera burst limiter exists to stop a stuck loop emptying the pot, and twenty simultaneous presigns are indistinguishable from one. Serial also means a refusal is visible before the next file spends anything. **Rows are keyed on an id, never the filename**: a folder of `IMG_0001.jpg` from two cameras would otherwise have one row's outcome overwrite the other's.

**Every refusal names something a person can do.** *"out_of_points"* sends somebody to support; *"You're out of credits — add more below and this will go straight in"* sends them to the ladder two cards down.

## 🪤 My own guards caught the defect they were written for

The first full run failed **three** rules — the new `uploads_ready` / `uploads_error` outcomes were emitted by the claim action and **read by nothing**: not in the page's searchParams type, not passed to the banners, not mapped to a room. That is precisely the *"nine outcomes save in silence"* defect those guards were built after. Wired end to end and mapped to the library, where the picker lives.

**🛡 Guard `_lib/an-upload-is-a-capture.test.ts`** — 7 rules: an anti-vacuum floor · the shared presign route · **the shared record path, and no direct `papic_photos` insert** · clips measured and refused · **clips always postered, poster first** · refusals in readable words · and the picker renders only for a camera **this** person holds.

**Mutations**, counts printed before → after: an over-length clip passed through (1→0) 🔴 · a clip uploaded with no poster (1→0) 🔴 · a direct insert instead of the shared path (2→1) 🔴 · a raw error code shown to a person (0→1) 🔴.

**Verified locally:** `tsc --noEmit` exit **0** and the full unit suite **10,156 tests, 0 failures**.

**SPEC IMPACT:** None — under the purpose lock in `DECISION_LOG.md` 2026-08-26.
