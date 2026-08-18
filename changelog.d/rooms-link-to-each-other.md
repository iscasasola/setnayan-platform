## 2026-08-18 · feat(event-hub): the rooms finally link to each other (S14, first slice)

**What a person gets.** A guest standing at their table can reach the directions,
the gift page and the album without going back to the start and finding their
way again.

**The defect, measured — and the owner asked for it to be VERIFIED, not
assumed.** He said he had not checked it and to drop that half of the brief if it
turned out to be false. It was true, and worse than he put it:

- the bottom bar exists on the EVENT PAGE ONLY — `SiteMenuBar` had exactly **one
  importer**, and none of the eleven sub-rooms mounted it
- seat · find-seat · find-my-table · venue · gifts · recap — their **only**
  outbound link was back to the event page
- welcome · invite · live-wall · print — **no outbound links at all**
- **no room linked to any other room.** A hub and spoke with no rim.

🚨 **AND IT IS NOT "MOUNT THE BAR IN EVERY ROOM".** The bar's middle slots are
IN-PAGE ANCHORS (`#site-details`, `#site-story`) that scroll the event page.
Mounted on `/seat` they would be five taps that do nothing — precisely the
dead-anchor failure `site-nav.ts` exists to prevent. A room needs links that
LEAVE, so it gets its own resolver rather than a borrowed one, and a shape that
deliberately does not look like the bar.

**New:** `_lib/room-links.ts` (pure, tested) · `_lib/room-links.server.ts` (one
cached loader, so six rooms cannot drift into asking slightly different
questions — which is exactly how the money-gift DOOR and the money-gift PAGE
ended up applying two different visibility rules) · `_components/room-footer.tsx`.

🔒 **Both rules are INHERITED, not invented.** *Announce features, hide content* —
a room is listed only when it would actually let this visitor in, and nothing is
ever drawn greyed, because a greyed "Album" would announce that photographs exist
and are being withheld. *A doorway is gated on what the DESTINATION demands* —
every condition restates the target route's own gate.

🔑 **`pabuyaViewerAllowed: true` is EARNED at each call site, not assumed**, and
says so in a comment: those rooms already ran `canViewSlugEvent` against the SAME
raw visibility column the gift page applies, and redirected away if it failed.

⛔ **`/welcome` and `/invite` are deliberately EXCLUDED.** They wear the
owner-locked door register — one paper card, ONE terracotta action, the wordmark
as the way out. A list of other rooms would break a design settled across
thirteen pages, and both are mid-task screens where a side exit is a distraction.

🛡 `room-links.test.ts` — 12 assertions: a room is never offered to itself; the
event page is ALWAYS offered so no room is a dead end; no slug returns nothing
rather than links to nowhere; each destination's own gate is restated; the
personal token reaches the 3D room so it shows THEIR seat; the slug is encoded;
the order is fixed; and nothing is ever returned in a locked shape.
**Mutation-proved, occurrence counts printed:** the viewer check dropped from the
gift page — the doorway-card trap (1→0) **1 fail** · a room offered to itself
(landed) **1 fail** · the album listed before publication (landed) **3 fail** ·
the personal token dropped (1→0) **1 fail** · restored **12 pass**.

⏭ **A FIRST SLICE, and the rest is named:** mounted in `find-seat`,
`find-my-table` and `pabuya`. **Still to mount: `seat`, `venue`, `recap`** — each
has a different page shape and mounting them blind is how a layout breaks. The
resolver and the loader are done, so each is a two-line change.

⚠ **NOT OBSERVED** — no local build, and the only non-wedding events are two
hand-made test rows. Test-proved, not looked at.

SPEC IMPACT: None.
