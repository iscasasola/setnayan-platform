## 2026-10-15 · feat(media): the couple media allowance follows the plan — Free 10 MB, Event Hub Pro 500 MB

Owner FINAL 2026-10-15: *"Free 10MB"* · *"Pro is 500MB"*. The single 100 MB cap is gone.

- **What each plan gets:** a Free couple may keep up to **10 MB** of their own Event Hub uploads per event; a couple with Event Hub Pro (`eventCoupleWebsiteProActive` — internal-hosted events are Pro by the existing rule) up to **500 MB**. Guest/Papic media still never counts.
- **One cap function:** `coupleMediaCapBytes(isPro)` in `lib/maker-media-limits.ts` replaces `MAKER_EVENT_MEDIA_BYTES_CAP`. `/api/upload` reserves against the plan's number (`reserveCoupleMediaBytes` reads the plan itself, with the real gate — the "view as a free couple" switch never reaches it); the meter and the "full" sentence show the same number.
- **A Free couple at the cap** reads one line: "◆ Event Hub Pro gives you 500 MB" with "Unlock Pro" on the existing `/studio/website-pro` path. No padlock.
- **Existing files are never deleted.** A couple already over their plan's number is simply full and cannot add.
- **No migration:** `reserve_couple_media_bytes(event, bytes, cap)` already takes the cap as a parameter.
- Guards re-aimed, not weakened: `couple-media-cap-is-enforced.test.ts` (plan sentences, Free/Pro meters, "no second constant set"), `maker-media-limits.test.ts`.

SPEC IMPACT: DECISION_LOG row 2026-10-15 (applied directly in the corpus) — supersedes the 2026-09-25 "100 MB per event" number.
