## 2026-08-26 · feat(papic): the couple is asked two fewer questions — photo quality and "where your photos go" are gone

The owner walked his own wedding's Papic page and made two rulings, one per card:

> *"the photo quality is already set for us by default. we do not need to ask them."*
> *"i was thinking of not asking for setnayan storage? what we want is to offer them to sync this to a google drive."*

Both are deleted. This is the first slice of the Papic control-centre rearrange (`prototypes/papic_control_center_2026-08-25.html`), which follows the owner's purpose lock: **Papic is the event's one media library**, so a screen about it should be about the collection, not about our storage bill.

**🚨 THE STORAGE QUESTION WAS NEVER REAL, AND THE OWNER'S OWN EVENT WAS SITTING IN IT.** Measured on `origin/main` before the change: `events.papic_storage_target` is read by exactly **three** files — the card that drew it, the actions that wrote it, and the Drive disconnect route — and by **no capture, upload or storage path anywhere**. The comment describing that branch is still a `TODO(0012)` at the foot of `page.tsx`. So *"Use my Google Drive only · CONNECTED"* never made anything Drive-only: every photo has always landed in Setnayan storage, on all four production events whose `papic_storage_target` says otherwise. The either/or also broke a promise we make out loud — we tell couples we keep their gallery **for life**, which is impossible for photos we never held.

🔑 **A search that cannot match is not a negative result.** The first sweep for a Drive copy path grepped `drive_transferred_at`, found zero writers, and nearly became a finding that *"nothing copies to Drive."* False — the real mechanism is the universal copy layer (`drive_copy_artifacts`, canonical column `drive_file_id`) behind the photo-delivery Release-to-Drive flow. The mechanism had a different name.

**What shipped**

- **`StorageChoiceCard` → `DriveCopyCard`.** No radiogroup, no "Setnayan storage" option, no "Use my Google Drive only". One card: *"Send a copy to your Google Drive — every photo lands in your own Drive too, as it arrives."* ⚠ **The Drive machinery SURVIVES intact** — connect CTA, connected panel, second-Drive overflow, disconnect, and the "coming soon" state while the verified-app review is pending. Deleting a question is not deleting its machinery, and a Drive copy is the only way a couple keeps **originals** once the full-res sweep runs.
- **The Photo quality card is gone**, with `quality-picker.tsx` and `setPapicQualityTier`. The column keeps its database default (`optimal`) and capture ingest still reads it — nobody is asked about megapixels.
- **A second dead round trip removed.** The page ran an extra `events` select purely to feed that picker.
- **Three server actions deleted** (`setPapicStorageR2` · `setPapicStorageDrive` · `setPapicQualityTier`) — each had exactly one caller, the UI now gone. 20 exported actions → 17.
- 🔒 **Both COLUMNS deliberately REMAIN.** `papic_quality_tier` is read by ingest; the disconnect route still resets legacy `google_drive_only` rows. Dropping a column to retire a question is risk with no payoff.

**🐛 A live copy bug fixed on the way.** `getCoupleEventId` — the shared couple-check used by **all** these actions — redirected refusals to `?storage_error=not_a_couple`, so anyone who wasn't a couple triggering *any* Papic action was told **"Could not update storage (not_a_couple)"**. Renamed `papic_access_error`, with words a person can read: *"Only the couple can change this celebration's Papic settings."* 🔑 When a value's NAME is what misleads, rename the value.

**⚠ A STALE COMMENT THAT COST A ROUND TRIP WITH THE OWNER, CORRECTED.** `_lib/rooms.ts` still asserted that nine outcomes *"save in silence… read by NOTHING."* That has not been true for some time — all nine are in the page's searchParams type and `StatusBanners` renders each. It was read as current on 2026-08-26 and repeated to the owner as fact. Corrected in `rooms.ts` and in `outcomes-are-shown.test.ts`, both of which now say plainly that the paragraph is history. 🔑 **A comment is not evidence — check the reader before repeating it.**

**🛡 Guard: `_lib/two-questions-stay-deleted.test.ts`** — 5 rules: the quality question stays gone · no megapixel or file-size jargon reaches a person · the storage question stays gone · Drive survives as an offer · **and a test that the comment stripper actually strips**. Every removal here left a note *naming* the string it removed, so a raw-source guard would report the defect it just fixed; the stripper is a real state machine, not a line-prefix filter. **All 4 behavioural rules mutation-tested with occurrence counts printed before → after** (`Photo quality` 1→2 red · `~12 MP` 0→1 red · `Where your photos go` 1→2 red · `DriveConnectCTA` 2→0 red), green on both sides.

🪤 `node --test 'app/dashboard/[eventId]/…'` prints **`# tests 0` and exits green** — the brackets are a glob character class. Escape as `[[]eventId[]]`. Documented before; it bit again.

**SPEC IMPACT:** `DECISION_LOG.md` 2026-08-26 (the Papic purpose lock and its three supporting rulings) — already applied.
