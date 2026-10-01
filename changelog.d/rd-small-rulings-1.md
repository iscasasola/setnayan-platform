## 2026-10-02 · fix(rulings): small owner rulings 1 — no guest email for the save-the-date and face-unblur · More = five · day-of specialisations follow the free date · no tag limit · copy

Five owner-ruled fixes, no schema, no new server action.

- **No email to guests (DECISION_LOG 2026-10-02 "FIVE AUDIT QUESTIONS ANSWERED" #1).** The save-the-date fan-out is gone: `lib/save-the-date-emails.ts` (and the never-called invitation fan-out beside it) is deleted, `launchSaveTheDate` and the scheduled-launch read in `app/[slug]/page.tsx` still publish and revalidate but mail nobody, and the Save-the-Date + Invitation email builders are removed from `lib/save-the-date-emails-core.ts` (the helpers the reminder sender shares stay). The face-unblur notice in `guests/[guestId]/actions.ts` is deleted with its email columns. Couple/supplier emails unchanged.
- **More menu = five (same row #4).** `buildOurServices` no longer stands a Gallery card in Papic's place, so the More sheet and rail children are always the five services; Gallery lives in the Event Hub and Memories.
- **Day-of specialisations follow `NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL`** (owner 2026-09-14, prod 2026-12-31): `resolveVendorSpecializationAccess` unlocks song desk / script & cues / run the floor for every vendor with a set until that date, via `lib/vendor-dayof-free-until.ts` (no second date). Unset date = no window (the Solo paywall stays).
- **No per-photo tag limit (2026-08-06):** the 20-tag slice in `planAutoTags` and the `MAX_TAGS_PER_PHOTO`/`liveTagCount` plumbing are removed.
- **Copy:** "Live Studio" → "Live Watch" on the More Services card; "Journal" → "Articles" (public site nav, social post title); "parish" dropped from the Groups empty state. NOT DONE: Patiktok off /features (see PR body).

SPEC IMPACT: None
