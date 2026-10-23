## 2026-10-23 · feat(papic, memories): Home's Papic widget opens in place · "How many do I need?" · the Papic page is the camera only · Memories gains Albums, ⚙ settings, + Add photos and moderation on the photo · How guests get in on Settings

PR-B of the event-bar work (stacked on `rd/event-bar-memories`, #6851). Owner-approved contract:
`prototypes/papic_controller_one_page_2026-10-23.html` (Setnayan-specs) with the owner's later rulings of 23 Oct.

- **1 · Home's Papic widget** (*"a smaller widget on home. Then we can expand it"* · *"does not open to a new page.
  just expands on home"*): the shipped `PapicServiceRow` gains one coverage line (`lib/papic-widget.ts`: before the
  day "Sat 12 Dec → Sun 13 Dec, 12 noon", on the day "Open now →", after "Closed") and the latest five photos with
  See all → Memories (`papic-latest-strip.tsx`; after the day, Thank-You Video). A tap on the row grows the card in
  place (`papic-home-widget.tsx`: height + fade, 420 ms on the house ease, reduced motion instant, URL unchanged) into
  the event-wide camera settings — streamed behind the first paint, the couple's only.
- **The camera settings, one component** (`studio/papic/_components/papic-camera-settings.tsx`), in the owner's order:
  Papic on/off (the Event Details answer, the shipped switch) + the dates on one line · Credits total/used/remaining
  + meter ("couldn't load" on a refused read) · Add more (Apple's sheet in the app) · Filter · Challenges · Face
  tagging · "Each guest's camera is on their guest card ›". No credits-per-guest, no per-guest face list. Saves from
  Home land back on Home (`return_to=home`, a fixed word → a fixed path: `setPapicWindow`, `setPapicStyle`,
  `setCoupleFaceTaggingDeclined`).
- **2 · "How many do I need?"** (`lib/papic-credits-need.ts`, `credit-need-helper.tsx`): guests coming
  (`papic_event_guest_headcount`) × the per-guest numbers that exist (named `papic_guest_spend_ceilings` + the
  couple's "everyone else") − credits left → "You need about N more", and the − / + stepper lands on the smallest rung
  that covers it (above the top: the top, said). No number set → it asks "How many photos each?" — no default. One
  Buy button naming credits + price (catalogue on the web, Apple's displayPrice in the app). Read on the tap with the
  ladder (`papicBuySizes`, no new action).
- **3 · The Papic page is the camera only**: the camera settings + banners + Setup & help; `?buy=1` still opens Add
  more, `?gallery=open` lands on Memories. The self-heals (free cameras, pool, uploads camera, Limited-snapshot sync)
  stay here. Removed from the page, deliberately: the crew/guest camera tiers and the unlock bundle (credits only),
  "When can they shoot" (the dates carry it), credits-per-guest (→ the guest card).
- **4 · Memories** (`event-memories-gallery.tsx`): Albums ▾ (`lib/memories-albums.ts`: All · Papic · Challenges ·
  Event Hub · Suppliers · Your uploads; Challenges grouped by challenge in board order; a challenge tag in All; Event
  Hub read-only, "Used on your Event Hub", `lib/event-hub-media*.ts`) · ⚙ Memories settings (Follow moments in order
  — the day's moments in schedule order, remembered on the device · Photo wall · Thank-you · Add photos by hand ·
  Guests see all · Google Drive · Keep full-res · what is made from the photos) · + Add photos in the ThumbRow (the
  uploads camera) · the photo sheet moderates guest and Papic files only (Hide · Report ▾ · Stop this guest shooting ·
  Delete forever, landing back on Memories via `return_to=memories`).
- **5 · Settings**: How guests get in carries the one code, its QR, Copy link and Print poster under the shipped row
  (`details/_components/guests-get-in-code.tsx`); a supplier's whole delivery is hidden on Event access
  (`VendorMediaControls` moved there). Guests' third segment "Setup" → "Settings".
- Guards repointed to where each control now lives (never weakened): nothing-was-lost (a bill over the split
  surfaces, removals itemised with reasons), the uploads switch, chapters → moments, the Apple gate, face tagging,
  the balance, the window in words, camera capacity, the supplier switch. New: `lib/papic-credits-need.test.ts`,
  `lib/papic-widget.test.ts`, `lib/memories-albums.test.ts`, `lib/event-hub-media.test.ts`.

SPEC IMPACT: DECISION_LOG row 2026-10-23 "PAPIC IS THE CAMERA, MEMORIES IS THE FILES — HOME'S PAPIC WIDGET OPENS IN
PLACE; HOW MANY DO I NEED; ALBUMS; HOW GUESTS GET IN ON SETTINGS" — owed to the corpus (Setnayan-specs); not written
from this cloud session.
