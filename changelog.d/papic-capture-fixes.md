## 2026-06-26 · fix(papic): instant shutter + recording countdown + capture roll + opt-in account sync

Four reported issues on the Papic **seat/paparazzo** capture surface
(`/papic/claim/[token]` → `/papic/seat/[token]`), the login-free QR-claim flow.
All fixes land in `papic-seat-capture.tsx` (+ one prop from the seat page):

- **Shutter no longer blocks ~10s on upload.** The shutter was `busy`-gated
  through the entire presign → R2 PUT → record round-trip, so the button was dead
  until the bytes landed. Rebuilt as an **optimistic shutter + serial background
  upload queue**: the frame freezes instantly, the count bumps, "Saved" flashes,
  and the shot drains to R2 in the background while the paparazzo keeps shooting.
  Sampler caps self-enforce on the optimistic count; a non-cap failure rolls the
  count back and offers a one-tap retry (venue Wi-Fi recovers — the in-memory
  blob is re-queued).
- **5-second recording now has a clear indicator.** Clip mode previously showed
  only a static "max 5s" pill, so a recording read as hung. Added a live
  countdown: a draining bottom progress bar, a draining ring around the record
  button, and a "Rec · Ns" readout (mirrors the already-shipped guest-camera
  pattern).
- **"Your shots" capture roll.** A horizontal thumbnail strip of this session's
  captures (newest first) with per-shot status — spinner while uploading, check
  when saved, retry on failure. Tapping a saved shot re-opens scan-to-tag for
  that specific photo; clips show a play badge over their poster frame.
- **Opt-in account sync (anonymous claimers).** One-tap login-free claim stays
  frictionless (locked 2026-06-21), but anonymous claimers now see a calm "Save
  these to your Setnayan account" affordance → `/signup?next=/papic/seat/[token]`,
  which attaches an email to the SAME anon uid (seat claim + captures carry over,
  no merge). Owner-directed 2026-06-26: keep one-tap, add opt-in sync.

Verified: web typecheck + lint clean, production `next build` green
(`/papic/seat/[token]` compiles as a dynamic route). Camera capture itself is
hardware-bound — needs an owner pass on a phone.

Guest-camera surface (`/papic/guest`) shares the blocking-shutter pattern but
already has the countdown; mirroring the optimistic-queue + roll there is a
follow-up, not in this PR.

SPEC IMPACT: Refines the 2026-06-21 login-free Papic decision (adds an opt-in
account-sync affordance; one-tap path unchanged). Logged at the bottom of the
corpus `DECISION_LOG.md`. No schema / SKU / pricing change.
