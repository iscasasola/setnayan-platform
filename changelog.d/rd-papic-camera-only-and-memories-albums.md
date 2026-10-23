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
- **Guests**: the third segment "Setup" → **"Settings"**.
- Server actions stay at 1,225: `dismissVendorRecommendation` (no caller) deleted for `setGuestFaceblock`.
- Guards: `studio/papic/papic-is-the-camera.test.ts`, `lib/event-memories.test.ts` (sabotaged red → green).

SPEC IMPACT: DECISION_LOG row 2026-10-23 "PAPIC IS THE CAMERA; MEMORIES HOLDS THE FILES — ALBUMS WITH CHALLENGES".
