## 2026-10-23 · feat(home): every service on Home is a widget that grows in place — Event Hub (Pro folded in) right after Papic

Owner, 23 Oct: *"on home, we can pick what part of event hub will be active. and if it is on or off? like papic?"* →
*"just like what we are doing with papic, we want to do the same for these"*; approved
`prototypes/home_service_widgets_2026-10-23.html` with his answers: Event Hub Pro folded into the Event Hub, no visits
line, order Papic → Event Hub → the rest.

- **One card shape** (`home-service-card.tsx`): mark · name · brand · the dot lines · the one number (a meter only
  over a true total) · one or two actions. A tap on the head grows the card IN PLACE (420 ms, the house ease; reduced
  motion at once; inert while folded) with the service's own controls and one quiet door to its page. A failed read
  says "Couldn't load" with ⟳ Reload and draws nothing else — no "Off", no 0, no switch. The couple's alone, on the
  web; the app and a coordinator keep the shipped rows. Each card streams in behind the row it replaces.
- **Event Hub** (second, after Papic): who can view + the link (the Maker's words, now one list in
  `lib/event-visibility.ts`) · the page guests see now (`resolveHubStage`) · the ◆ line (`hubProLine` — Pro on · payment
  sent · N parts on · Free; never a price) · Share link · QR. Open: the parts of each page, a switch each — "What
  guests see" built from the Maker's own inputs, a tap written into the Maker's DRAFT (`hubDraftAction`) — and the
  shipped Apply bar (`HubDraftDock`). No visits line. The "Event Hub Pro" row and its slim "Add" line are gone.
- **Live stream**: On air / Off air · "N of 12 channels · M cameras connected" · Go live / End (the setup page's own
  calls) · Copy watch link. Open: the channels (tap = Channel 1), Guests choose their view, Monogram, Lower third,
  Event QR — the controller's own actions, which now land back on Home with `return_to=home` — and the recordings.
- **Music**: Delivered / in production · plays on your Event Hub or not · the song with its player · "Use this song on
  my site". Open: "Play music on my Event Hub" (into the Hub's draft — one Apply) · the source (changed in the Maker's
  Music panel).
- **Video booth**: reels in the last 24 h against the soft cap + meter · Open booth. Open: your renders, TikTok, Save &
  share (not owned).
- **Planner**: Active · the briefing sentence + the booked meter · See decisions. Open: the four figures the Planner
  page draws (`AI_LIVE_FIGURES`, now one list).
- **Honest reads** (the prototype's two NEW guards): `loadAiActivity` now says whether it `measured`; the booth count,
  the overlays (`readOverlaySettingsMeasured`), the on-air trace and the channels are read so a refusal is
  "couldn't load". Guards: `lib/every-service-is-a-widget.test.ts`,
  `app/dashboard/[eventId]/_components/home-cards/home-cards-read-honestly.test.ts`.
- No new server action; no migration.

SPEC IMPACT: DECISION_LOG row 2026-10-23 "HOME SERVICES ARE WIDGETS — EVENT HUB PRO FOLDED INTO THE EVENT HUB" (not
written from this cloud session — the corpus is not mounted here).
