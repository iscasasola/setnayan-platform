## 2026-10-15 · feat(hub): the Invitation and Save the Date are ONE page — the bar jumps to sections, Me stays its own page

Owner-approved 2026-10-15 on `Setnayan/prototypes/event_hub_one_page_and_desktop_2026-10-15_fable.html` §1 · §1b · §1c
(DECISION_LOG "THE INVITATION AND SAVE THE DATE BECOME ONE PAGE — THE BOTTOM BAR JUMPS TO SECTIONS · ME STAYS ITS OWN
PAGE · THE DAY KEEPS ITS TABS" and "ONE-PAGE INVITATION + SAVE THE DATE … — APPROVED", with its five answers). Phone
only; the desktop system sheet and desktop pages are a later build.

- **One page** (`app/[slug]/_lib/hub-tabs.ts`): `TABBED_STAGES` is The Day only; `ONE_PAGE_STAGES` = Invitation + Save
  the Date. Every group keeps the tab it is filed on (`data-hub-tab`, the Maker's filing — unchanged) and now names the
  PAGE it is on (`data-hub-page`): Home · Details · Story are one page, Me is its own (`hubPageOf`, `OWN_PAGE_TABS`).
  Home's scenes, Details' scenes (the event-details card first), the entourage and Story render in that order under one
  scroll (`site-body.tsx` `pageTabsFor`). The Day is byte-for-byte its own pages, as before.
- **The bar** (`site-nav.ts` `tabbed: 'one-page'`, `site-menu-bar.tsx`): Home · Details · Story are their anchors
  (`#site-home` · `#site-details` · `#site-story`), Me is `?tab=me`. One `IntersectionObserver` lights the last mark
  crossed into the top quarter of the screen (`_lib/jump-marks.ts` `litJumpMark`, `aria-current="true"`); at the page's foot
  (a second observer on the bar's own spacer) the lowest section on screen is lit, so a short last Story still lights;
  Me, opened, is lit as its page. Hidden over the
  cover and slid up on the first swipe by the Cover Scene's own rule (batch #6553), reduced motion = no slide.
- **The bars hide again whenever the cover is back on screen** (Q3, *"where the bar hides again"*): the Cover Scene's
  one `<style data-cover-menu>` in `<head>` (batch W1, hydration-safe — the root is never touched) goes back to `"wait"`
  when the page is scrolled back to the shown cover and to `"open"` on leaving it (`cover-scene-menu.tsx`); reduced
  motion = no slide. Held by the guard's claim (5), which runs the shipped script.
- **Home jumps to the first section after the cover** (Q3): on these stages its mark is drawn after the cover and its one
  action (zero height, out of the rhythm), never at the top.
- **Old links land** (`hub/hub-shell.tsx`): `?tab=details` / `?tab=story` open the one page scrolled to that section and
  the address becomes the mark; `?tab=me` is Me. The shell switches between the one page and Me only.
- **Save the Date's bar = Home · Story · Me** when the story is on the page (Q2): the body is drawn under the film for
  every event, so `menuSections.story` no longer waits on open browse there. Me opened there lifts the film
  (`std-film-handoff.tsx` `liftOnLanding`).
- **The Maker follows the split**: `makerStagesPages` keeps every tab on the one-page stages (Save the Date now Home ·
  Story · Me); a Home/Details/Story pick on the Stages canvas scrolls to its place on the one page (`hub-tab-dom.ts`
  `openHubTab` → `'mark'`, not held at the top); Me opens its page. The lab's stage canvas mirrors it.
- **Guards**: new `app/[slug]/_lib/the-invitation-is-one-page.test.ts` (6 claims on the real SiteBody: the three anchors
  in order with Home after the cover and Details opening on the event-details card · each slot's href · Me a page · an
  old `?tab=details` · Save the Date's bar · the bar held off the cover · the scroll-spy), each sabotaged red once;
  `each-tab-is-its-own-page.test.ts` re-aimed to The Day (not deleted); `the-first-screen-is-never-hidden.test.ts` gains
  "no bar over the cover". Re-anchored for the intended change: every-stages-tab, me-has-the-pages-gutter (STD's foot is
  Me's with the bar drawn), back-lands-on-the-invitation, the-lab-canvas, the-day-toolbar, the-event-bar,
  the-wedding-words; goldens regenerated (fixture invitation + stranger, every-stage-is-todays-page).

SPEC IMPACT: None — builds the approved prototype and the 2026-10-15 rulings already in the corpus; builder calls (Story
through decided in `menuSections`, Me on Save the Date lifts the film, Save the Date in the Maker gains Home · Story · Me
tabs) are listed in the PR body for the owner.
