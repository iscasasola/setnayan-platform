## 2026-09-21 · fix(guests): one Wedding March door · the + offers the guest's side · the last row clears the update bar

Three things the owner pointed at on the live guest list:

- *"wedding march is repeated?"* — it was both a tab (Roster · Wedding March · Share the link) and a
  button in the List · Mind map switcher. The switcher's copy is gone: it was also UNGATED (the page
  never passed `showWalk`, so a birthday saw it), while the tab is gated on the event having a
  processional. The switcher is only ways of looking at the roster now. `a-pair-walks-as-one-line`'s
  three switcher assertions now execute `rosterDoors` and forbid a second door (sabotaged: caught).
- *"clicking here should popup options of what group the side has. example. bride side, then groups
  from the bride should show."* — a guest's dashed **+** now lists the groups of that guest's side plus
  the shared ones (`lib/groups-for-side.ts`); a guest on both sides sees all. A group made from that +
  is created on the guest's side (`quickCreateGroup` takes an optional side, allowlisted; every other
  caller still gets 'both').
- *"i cannot see the bottom of the guest list."* — the "Setnayan was updated… Reload" bar is `fixed` over
  the screen's bottom and reserved no room, so the last row sat under it. While it shows, the body's
  bottom padding grows by the bar's measured height and is restored when it goes. Verified in a browser:
  scrolled to the end, the last row's bottom = the bar's top; after "Not now", padding back to 0.
- *"make the last guest row scroll up to the middle of the screen for safety."* — the roster ends with
  half a screen (`50dvh`) of room, so the last guest can always be brought up to the middle, clear of
  anything pinned to the bottom. Only when there are guests to show.
- Guards: `lib/groups-for-side.test.ts` (6), sabotaged 2 ways, each caught.

SPEC IMPACT: None

### …and every popup in the guest table was invisible

Owner: *"tapping the side will pop up so they can choose which side as well."* It already did — where
nobody could see it. Measured on the live page: tapping a Side cell rendered the Bride's / Groom's /
Both menu at (-9999, -9999) with `visibility: hidden`. The shared `Popover` (overlay-primitives.tsx)
measured its position on the first render, when its portal was still null, bailed, and — with deps of
only `[anchorRef, width]` — never measured again. Side · RSVP · Role · the + group menu all shared it.
`portal` is now a dependency. Verified in a browser with the real editors: the Side menu opens 6px
under its cell, the + menu 6px under its button, both visible. Guard
`_components/a-popover-is-seen.test.ts` (sabotaged: caught).
