## 2026-10-02 · fix(uploads): the couple's 100 MB per event is a cap, a removed picture frees its bytes, and the meter is in the Maker

DECISION_LOG 2026-09-25 ("COUPLE UPLOADS: 100 MB PER EVENT … with a visible meter"). The audit found the allowance was only counted: `/api/upload` added `events.couple_media_bytes` after the presign (`increment_couple_media_bytes`, in `after()`) and never refused; nothing ever lowered the counter; `readCoupleMediaBytes` had no caller; `MakerMediaMeter` rendered only on the legacy living-hero page.

- **Refuse before the PUT is signed.** For a couple-media upload (the existing allowlist of this event's own Event Hub folders, moved to `lib/couple-media-allowance.ts` — never `papic/…`, never `vendors/…`), the route reserves the compressed bytes with the new `reserve_couple_media_bytes(event, bytes, cap)` — one atomic `UPDATE … WHERE total + bytes <= cap` — and returns 413 `event_media_full` with the plain reason ("This event has used its 100 MB of uploads. Remove a photo or video to add more." / "This file is X MB, and this event has Y MB … left …"). Fails closed (503, "Try again") when it cannot read itself.
- **A removed picture frees its bytes.** Removing media is a row/draft edit (no surface deletes a couple's object), so there was no decrement to call. The counter is now SETTLED (`set_couple_media_bytes`): the event's R2 folder is listed once (R2's own sizes) and only objects the event still references — the event row, every scene canvas, the Event Hub draft and its undo snapshot — or that landed in the last 15 minutes count. The route settles on a refusal and asks once more; the Maker settles inline when ≥ 90% full and after the response otherwise.
- **The meter is in the Maker**, under a scene's Upload media and the Main background's upload — both in the lazy `maker-details` chunk, so the Maker's first load is unchanged.
- `increment_couple_media_bytes` is dropped (replaced); the column comment no longer says "a meter, not a cap".

Tests: `lib/couple-media-cap-is-enforced.test.ts` (scope, settle frees bytes, route refuses before signing, meter renders) and `tests/db/a-couple-upload-over-the-cap-is-refused.db.test.ts` (reserve counts under / refuses over / couple cannot call / remove → settle → the refused upload fits). Each sabotaged once.

Known gaps, not fixed here: removed and abandoned objects stay in R2 (no orphan sweep), so the meter is "what you keep", not the bill; the living-hero studio uploads under `living-heroes/` (no event id) and is not counted at all.

SPEC IMPACT: None
