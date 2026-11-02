## 2026-07-22 · fix(papic): sweep lagging "5-second" clip-cap copy to "10-second"

Copy catch-up to the shipped 10-second Papic candid-clip cap (owner override
§0, 2026-07-22 · metering + client caps already shipped in PR #3501: photo = 1
pt · 10-second clip = 7 pts). The currency PR fixed the Papic studio strings but
missed three other user-facing copy strings that still described the capture
clip as 5 seconds.

- **`lib/help.ts`** — two `/help` article bodies. "What is Papic?" (Papic Guest
  disposable mode) "10 5-second videos per guest" → "10 ten-second videos"; the
  "Crew: how does it work?" article "up-to-5-second clips" → "up-to-10-second
  clips". Duration copy only — SKU names and the free-clip count are untouched.
- **`lib/data-privacy-controls.ts`** — the `vendor_papic_capture` control
  description (admin data-privacy surface) "collect photos and 5s clips" → "10s
  clips". Matches the DB-enforced `vendor_papic_captures.clip_duration_ms <=
  10000` cap.

Deliberately NOT swept: the Personal-Reel / Stories render SLOT (`CLIP_MAX_SEC`
= 5, a distinct concept — reel slots legitimately stay 5s); Pabati / video-
guestbook guest greetings (a separate SKU with its own genuine 5s cap); the
robots-disallowed dated `/keynote` snapshot deck (retired Papic Guest / 5-Seats
/ SDE / token SKUs — a frozen artifact, not live capture-cap copy); code
comments; and unrelated 5-second timeouts/latency/auto-dismiss delays.

Copy-only — no schema, no constant, no metering change (all shipped in #3501).

SPEC IMPACT: None — copy catch-up to the already-shipped 10s clip cap.
