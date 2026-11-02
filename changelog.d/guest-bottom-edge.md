## 2026-08-05 · fix(guest-site): one bar owns the bottom of a guest's phone, and it renders for real couples

**SPEC IMPACT:** None (behaviour + a flag default; the nav model itself is unchanged).

Three components pinned themselves to the bottom of the same page — `GuestHubBar`
and `PublicEventDayBar` at `bottom-0 z-40`, `SiteMenuBar` at `bottom-0 z-30` — and
two more floated into the same strip (the share/report pill at `bottom-4`, the
music toggle at `bottom-5 z-50`). The higher z-index won, so the five-tab menu
was rendered, hit-tested and **completely untappable**: Home, Camera and Me all
covered. The music toggle turned the Home tab into a mute button. Share opened
whatever tab was drawn over it.

**Why nobody saw it for a month, which is the more important half.** The menu was
`isSample || flag === 'true'` with the flag never set — and `is_sample` is TRUE on
exactly one row. So the menu rendered on the demo wedding and nowhere else, the
demo being the one event every verification pass was run against. A real couple's
guests got the legacy bar and no menu at all, so the two bars never met anywhere a
person was looking. **A flag that is off for every real event is not shipped, it
is staged.**

What changed:

- **The menu is now the default** — the flag became an opt-OUT
  (`NEXT_PUBLIC_WEBSITE_MENU_ENABLED='false'` switches it back off). The sample
  stays pinned on so a stray env value cannot switch the demo off.
- **Both legacy bars give up the bottom edge** where the menu renders. They keep
  what the menu has no slot for: the guest's personal QR and "Photos of you"
  (their own tagged roll — a different destination from the menu's Gallery
  anchor, which scrolls to the couple's public chapters) move into a real `Me`
  section, which is what the Me tab has been anchoring to an empty div for. The
  day-of "Live hub" chip stays too — the resolver has no hub slot, and retiring
  it would delete the only day-of doorway a visitor without an invitation has.
- **The bar reserves its own space.** Being `fixed`, it covered the last 3.5rem
  of the document, so whatever ended up at the foot of the page was unreachable —
  for a visitor with no invitation that is **"Open my invitation"**, the single
  control that gets them in.
- The share/report pill and the music toggle lift clear of the bar.

`app/[slug]/_lib/bottom-edge.test.ts` guards the composition — the defect is not
in any one component's logic (each is correct alone) but in what happens when
they are composed, which is exactly what a unit test of either one cannot see.
Mutation-verified: reverting the flag, the spacer or the lifted offset each turns
it red.
