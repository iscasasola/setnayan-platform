## 2026-07-24 · feat(open-browse): mount the menu shell on the GUEST tree (PR6b)

PR6 (#3619) landed the open-browse five-tab menu shell on the ANONYMOUS site
tree only. This slice extends it to the GUEST (cookie-holder) tree in
`app/[slug]/_components/site-body.tsx` so every identity tier gets the SAME
structure (council §1.1): Home · Details · Story · Gallery · Me.

- Stamps the five `SITE_MENU_ANCHORS` markers on the guest sections — Home (top
  of `<article>`), Details (the couple's hideable detail widgets), Story
  (`OurStory`), Gallery (the live photo wall), Me (foot-of-page account/sign-out).
- Mounts `SiteMenuBar` with present-flags computed from what actually rendered
  on THIS guest page (`plan.hideableInOrder.length > 0`, `event.love_story`,
  `isLive && liveWall`) so no tab ever anchors to a missing section.
- Reuses the existing model + component (`_lib/site-menu.ts`,
  `_components/site-menu-bar.tsx`) — no new model, no DB reads.

Refinement over the anon slice: the markers + bar are gated on `menuOn`, so a
flag-off REAL event keeps its DOM byte-identical (the PR7 flag-off goldens stay
stable). Flag stays `NEXT_PUBLIC_WEBSITE_MENU_ENABLED` (off in prod) + always-on
for the sample event. The guest personal-QR modal + camera actions stay on the
coexisting GuestHubBar (page.tsx) per the shipped site-menu-bar contract — both
bars coexist until PR11 retires the old ones.

SPEC IMPACT: None — flag-dark shell extension; the guest-website open-browse
program is tracked in Guest_Event_Website_Open_Browse_Council_Verdict_2026-07-22.md §3.
