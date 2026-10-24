## 2026-10-23 · feat(papic, memories): Papic is the camera; Memories holds the files — Albums ▾ (with Challenges), ⚙ Gallery settings, + Add photos, moderation on the photo

Owner, 23 Oct: *"Papic is the camera service. Gallery is the collection of the files for that event. Papic holds:
Filter, Credits per guest, face tagging, face blocking, challenge. Gallery holds: follow moments in order, photowall,
thank you, guest see photos, google drive, keep full res"* · *"the how guests get in will be on event settings"* ·
*"on the memories. a place for the papic challenges also"* (approved `prototypes/papic_controller_one_page_2026-10-23.html`,
the Home tabs superseded by `event_bar_memories_tab_2026-10-23.html`).

- **Papic page = the camera**: ← Home · Papic switch (the existing `papic_on` answer) + the dates · the credits band
  · Filter · When guests can shoot · Credits per guest · Face tagging · **Face blocking** (new list, `setGuestFaceblock`)
  · Challenges. The gallery, photo wall, shared gallery, Drive, Keep full-res, suppliers' switches, "ways in" rows and
  the moderation door left it.
- **Memories**: Albums ▾ — All · Papic · **Challenges** (grouped by challenge in the board's order; `papic_mission_
  completions.capture_id`) · Event Hub (read-only) · Suppliers · Your uploads; Needs a look N; ⚙ Gallery settings
  (the shipped controls, moved); + Add photos; a tap opens the photo's sheet (Approve · Hide · Report · Stop this
  guest shooting · Delete forever; a supplier file hides that supplier; a Hub file saves to phone).
- **Account Memories › Challenges** — the hosted events that had challenges, by challenge.
- **Event Details**: "How guests get in" carries the one code (QR · Copy link · Print poster) and "Each guest's invite
  QR is already their camera · N ready"; each supplier row in Event access carries "Their photos in your Memories".
- **Home › Papic opens under itself** (owner: *"does not open to a new page. just expands on home"*): the shipped row
  + the coverage line ("Fri, Dec 11 → Sun, Dec 13, 12 noon" · "Open now → …" · "Closed …") + the latest five with
  "N in your Memories · latest first · See all ›" (→ Memories) + Add more (after the day, Thank-You Video). A tap on
  the head grows the card's settings in UNDER it (420 ms, the house ease; reduced motion at once; inert while folded):
  Papic on/off + dates · Total · Used · Remaining · Filter · When guests can shoot · Face tagging · Challenges, and
  "Each guest's camera is on their guest card ›" (owner, guest-card ruling: per-guest Papic lives on each card). The
  same `PapicCameraSettings` draws `/studio/papic` for old links (with its per-guest rows). Nothing on Home opens the
  Papic page any more.
- **Add more › How many do I need?** (owner: *"make it easier to purchase more"*): the guest cards' set numbers +
  everyone else × "How many photos each?" − credits left → the stepper lands on the smallest pack that covers it
  (the biggest, and says so, above the top); the one Buy button names it ("Add 2,000 credits · ₱…"). A refused guest
  read is said; no number is invented.
- **Guests**: the third segment "Setup" → **"Settings"**.
- Server actions stay at 1,225: `dismissVendorRecommendation` (no caller) deleted for `setGuestFaceblock`.
- Guards: `studio/papic/papic-is-the-camera.test.ts`, `lib/event-memories.test.ts` (sabotaged red → green).
- **Home's three pills come off** (owner: *"remove Home's three pills (Guests · Suppliers · Event Hub)"*) — the bar
  carries all three. The Home tour's Event Hub step now lights the bar's Event Hub tab (`tab-launch`).
- **"Later" folds the Next card to "Back tomorrow · Undo"** (owner) — one line in the card's place for today; Undo
  brings it back. The buy door is never taken away with it.
- **The app's Add credits sheet asks "How many do I need?"** too (`iap-papic-sheet.tsx`, the same `CreditNeed` and
  Apple's own price on the one Buy button).
- Saves made inside Home's Papic card (dates, filter, face tagging) land back on Home (`return_to=home`).
- The Papic first-visit tour ends on the camera's own settings (the one code moved to Settings, the library to
  Memories). The Home Papic card is never drawn in the store shell (the app keeps its own Papic row).
- Guards pinned to the old Papic page were repointed to where each control now lives (none weakened); the
  Home-doors guards went with the doors.

### 2026-10-24 · builder takeover (local) — the contract, closed
- **The Papic page draws exactly what Home's card opens** (contract: *"Papic page = camera only (same expanded
  settings)"*): event-wide only — no Credits per guest, no per-guest face list on either seat; one quiet line "Each
  guest's camera is on their guest card ›". `FaceBlockingList`, its switches and `setGuestFaceblock` (new on this
  branch) are gone again; `recommend-actions.ts` / the guest actions are main's (server actions: no new one).
- **Filter = the approved controller's strip A** — `StylePicker variant="strip"`: five looks across one row, one tap
  saves (the 2×3 cards made Home's card a screen and a half long). The current look is said in words beside it.
- **The quick view draws no second photos door** (the strip's "See all ›" opens Memories); the page's band says
  **Add more** (web and app). The face row says **"Face tagging"** (it clipped to "Finding pe…" at 375); the dates row
  says the first day only (it ran past 375 px).
- **Home draws no shortcut the event bar already has** — a rendered property guard replaces the pills' marker check
  (sabotage: a Suppliers pill → red).
- Memories carries the **withheld, not absent** line for a viewer the couple's sources do not reach (moved from the page).
- Guards that were pinned to the old Papic page followed their controls (none weakened): a-row-is-a-door,
  an-upload-is-a-capture, no-camera-holds-its-own-credits, two-questions-stay-deleted, the-papic-page-opens-fast,
  papic-gallery-scope, gallery-chapters-wiring, the-host-page-tours-land.
- #6855 (the cloud session's duplicate) closed: everything it had is here (the app sheet's helper, return-to-Home).

SPEC IMPACT: DECISION_LOG row 2026-10-23 "PAPIC IS THE CAMERA; MEMORIES HOLDS THE FILES — ALBUMS WITH CHALLENGES".

- **Face blocking is a count, never a switch** (owner ruling 2026-10-24). The open Papic card shows one read-only row beside Face tagging — "Face blocking · N guests blurred", N = active guests (`deleted_at is null`) with `faceblock_enabled` — with an ⓘ saying each guest chooses on their guest card and is always honoured. A failed read says so; it never shows 0. Guard: `lib/face-blocking-is-read-only.test.ts`. No migration.
- **The closed card with no photos** shows five empty dashed frames and "Frames fill as your guests shoot" instead of "· No photos yet".
