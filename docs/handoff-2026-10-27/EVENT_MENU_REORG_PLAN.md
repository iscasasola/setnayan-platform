# Event menu reorganisation — the plan as discussed, 2026-10-27

> Written at the end of a planning conversation with the owner so it survives an account switch.
> **NOTHING HERE IS BUILT.** No code, schema or corpus file was changed. Marks used below:
> **✅ OWNER DECIDED** · **💡 PROPOSED** (Claude's recommendation, owner has not said yes) · **❓ OPEN**.
>
> 🔑 Before building any row: re-measure it. Every anchor is a greppable string, never a line number
> (CLAUDE.md Rule 0 · rule 7). The DECISION_LOG rows this plan implies are listed at the end — they
> have NOT been written to the corpus yet.

## The goal (owner, verbatim)

*"I want to make the event hub maker have less things to do on its studio."*

The rule that came out of it: **Studio keeps what decides how the Event Hub LOOKS and what it SAYS.
Anything that is a record, a list of people or a plan goes to the tab where that record lives.**
Every feature below already exists as a mature page — this is mostly moving doors, not building.

## The finished map

| Tab | Holds |
|---|---|
| **Home** | Edits almost nothing. Status lines that open the EXACT item in its new home. Papic's card (already there). The Event Hub card with "What guests see" (already there) |
| **Guests** | **List · Map · Seats · March** ✅ — ⚙ Settings holds **RSVP** ✅ |
| **Suppliers** | **Find** (+ Inspiration box 💡) · **Build** · **Booked** — Booked's parts: Your team · Budget · **Schedule** ✅ (call times live in the Schedule) |
| **Memories** | The event's gallery + the **Thank-You Video** maker ✅ |
| **Event Hub Maker › Studio** | **Logo · Palette + Dress Code · Love Story · Prints** (+ E-Gifts form ❓) |
| **Event Hub Settings** | **Info · Look** ✅ + what is already there: who can view · version · address · QR |

Studio goes from 11 tiles to 4 (or 5).

## What moves where

| Feature | From | To | Status |
|---|---|---|---|
| RSVP (questions, reply-by) | Studio tile `rsvp` | Guests ⚙ settings sheet; replies are columns of the list | ✅ |
| Seat plan + 2D + 3D + wayfinding | Studio tile `seats`, `/seating`, `/plan3d`, `/studio/indoor-blueprint` | Guests › **Seats** (the existing maker rendered whole) | ✅ Seats · 💡 3D + wayfinding inside it |
| Wedding March | Studio tile `march` | Guests › **March** | ✅ |
| Schedule + Call Time | Studio tile `schedule`, `/schedule` | Suppliers › Booked › **Schedule** part | ✅ |
| Inspiration box | Studio › Mood Board | Suppliers (💡 in **Find**), separate from the palette | ✅ Suppliers · 💡 Find |
| Palette + Dress Code | Studio › Mood Board | stays in Studio | ✅ |
| Info, Look | Studio tiles `info`, `look` | **Event Hub Settings** | ✅ |
| Thank-You Video | `/studio/thank-you` + Papic card door | **Memories** | ✅ |
| E-Gifts on/off | — | Already on Home: the `gifts` row of "What guests see" (`events.gifts_on`) | found existing |
| E-Gifts details form | Studio tile `gifts` | ❓ stays a Studio tile, or Guests ⚙ | ❓ |

## The existing code each move reuses (Rule 0 — do not rebuild)

| Thing | Where it already is (grep these) |
|---|---|
| Studio's 11 tiles | `studio-home.tsx` `TILE_ICON` · `lib/studio-page-cards.ts` · `lib/studio-tiles.ts` |
| Maker top nav Stages \| Studio | `launch/_components/maker-bar.ts` `MAKER_SIDE_LABEL` |
| Event Hub Settings fold | `StudioHubSettings` in `launch/_components/studio-tools.tsx` |
| Event menu (Home · Guests · Suppliers · Hub · Memories) | `lib/customer-menu.ts` `buildEventMenuSections` |
| Guests List · Map + ⚙ | `guests/_components/guests-screen.tsx` `gview: 'list' \| 'map'` · `MenuSettingsButton`. ⚠ "Map" is the guest TREE (`GuestMapCanvas`), not seating |
| Seat plan maker (rules + automation) | `seating/actions.ts`: `addSeatingConstraint` · `autoSeatGuests` · `autoArrange` · `buildSeatingDraft` · `setSeatingAutoplace` · `setSeatingGroupAdjacency` · `publishSeating`; `seating/page.tsx` already supports `maker=1` |
| 2D chart · 3D lab · 3D control centre · wayfinding | `seating/chart` · `seating/lab` · `plan3d/page.tsx` (Draft ↔ Live = `publishSeating`) · `studio/indoor-blueprint` |
| March | `guests/march-actions.ts` · `guests/march-step.ts` |
| Schedule maker | `schedule/page.tsx` · `schedule/actions.ts` (`toggleBlockVisibility`, `setBlockResponsibleParty`) · Preparation ⇄ Event Day toggle · `vendor-meetings-section.tsx` |
| Who a moment is for (= call time) | `lib/schedule-audience.ts` — Everyone · Entourage · Sponsors · Family · Suppliers; "Entourage" moments ARE the entourage's *Arrive by* |
| Suppliers modes + parts | `lib/suppliers-shell.ts` `SUPPLIERS_MODES` (find · build · booked) · `lib/pillar-parts.ts` `yourTeamParts` (Budget rendered whole — copy this for Schedule) |
| Home's Papic pattern | `_components/papic-home-card.tsx` · tests `papic-lives-on-home` / `papic-opens-on-home` |
| Home "What guests see" | `_components/home-cards/home-hub-card.tsx` · `lib/home-hub-card.server.ts` · `lib/guests-see-build.ts` (`FIXED` rows: gifts · entourage · reply · seat · pass …) · columns = `PUBLIC_STAGE_LABELS` |
| Thank-You Video | `studio/thank-you/page.tsx` (SKU `PAPIC_ADDON_THANK_YOU`) |
| Memories | `memories/page.tsx` · `memories/_components/memories-settings.tsx` |
| Hub visibility | `lib/event-visibility.ts` (`EVENT_VISIBILITIES`, `openToStrangers`, `WHO_CAN_VIEW`) · `website/privacy/actions.ts` `updateLandingPageVisibility` |
| Post Event story audience | `lib/who-can-see-your-story.ts` (`STORY_AUDIENCES`: draft · event · published · taken_back) |
| "Your people" / follows | `lib/discover-events.ts` (`readEventShelves`: people first, then public) · `lib/follow-actions.ts` · `person_connections` |

## Viewing terms — ✅ agreed for the WHOLE Event Hub

| Term | Who can open it |
|---|---|
| **Exclusive** | Only me (the hosts) and the invited |
| **Private** | All the people around me |
| **Public** | Everyone (followers / connections see it on top in Discover) |

Rule 💡: **a stage may be narrower than the Hub, never wider.** One setting drives both the Hub and
the Post Event story (today they are two systems that can disagree).

🛑 **The stored word `private` today means hosts + guests = the new EXCLUSIVE.** The new Private tier
must get a NEW stored value (e.g. `people`) and stored `private` maps to Exclusive — otherwise every
existing private event silently widens to every host's connections. Unknown values fail to Exclusive.
A test must prove a stranger and an unconnected account are refused under Exclusive and Private.
Unlisted stops being a choice → 💡 Public with a "list me on Discover" switch off.

## Add

- Guests: **Seats** view and **March** view on the List · Map row; RSVP section in the ⚙ sheet.
- Suppliers: **Schedule** part in Booked; **Inspiration** box (💡 in Find).
- Memories: the Thank-You Video maker.
- Event Hub Settings: Info and Look sections.
- 💡 A **"The day's program"** row in Home's "What guests see" table — the schedule's guest view plugs
  into that ONE mechanism, not a second one.
- The **Private** (people) visibility tier + 💡 "list me on Discover" switch under Public.
- 💡 Home status lines: RSVP ("12 haven't replied"), Seats ("6 have no seat"), Schedule (next item),
  Inspiration ("3 to review") — each a door to the exact item.

## Remove

- Studio tiles: RSVP · Seat plan · Schedule · March · Info · Look; the inspiration part of Mood Board.
- Unlisted as a separate choice.
- The Thank-You Video payment gate ✅ (free to make AND save) and the Papic card's Thank-You door.
- 💡 Old standalone addresses (`/seating`, `/schedule`, `/plan3d`, `/studio/indoor-blueprint`,
  `/studio/thank-you`) FORWARD to the new homes once those work — one editor per fact
  (`details/every-fact-has-one-editor.test.ts`).

## Fix (found while planning)

- The word "Private" means two different things today (Hub `private` = hosts + guests; the story's
  "Only me" = hosts). Settled by the new terms above.
- Hub visibility and the story audience are two systems that can disagree → one setting.
- The Maker's picker offers 3 visibility choices, the privacy page offers 4 (`invited_accounts`) →
  one list everywhere, including Home's Event Hub card.
- Home's progress, the guided flow and Studio's "n of 11 ready" read the tiles that are leaving →
  repoint them IN THE SAME change, or Home says "Missing" about finished work.

## Improve

- Call time has ONE source: the schedule moment (audience Entourage / Suppliers). Dress Code and each
  booked supplier's card READ it; neither keeps a copy.
- Fail closed everywhere a visibility value is read.
- Keep Home light: a Home card only where Home has something LIVE to say (Papic passes; E-Gifts does not).

## ❓ Still open — owner to answer

1. "People around me" = people I follow · people I'm connected with · my followers · which mix?
2. Do the **shops you booked** belong in Exclusive? (The story rule includes them today.)
3. Who may show a schedule item to guests. 💡 A supplier controls their own; coordinator and co-hosts
   can change any; the couple has the last word; payment and meeting items can never be shown.
4. E-Gifts details form: Studio tile, or Guests ⚙?
5. Thank-You Video free: permanent or a promotion? (Decides retire-the-SKU vs ₱0 in
   `platform_retail_catalog_v2`. Check for already-paid orders first. Never hard-code a price.)
6. Inspiration box in **Find**: yes?
7. 3D plan + wayfinding as parts of Seats: yes?
8. Old addresses forward to the new homes: yes?

## 💡 Build order (smallest, safest first)

0. **Finish the Guests carousel first** (in flight on the Mac, worktree `wt-guests-carousel`, not yet
   pushed). Seats and March join the same List · Map row, so they build on top of it.
1. RSVP into the Guests ⚙ sheet.
2. Info + Look into Event Hub Settings.
3. Thank-You Video into Memories (+ the free decision, with owner sign-off on the catalogue).
4. Seats (existing maker, 2D/3D/wayfinding) + March into Guests.
5. Inspiration box into Suppliers.
6. Schedule into Suppliers › Booked — last: it adds the only new permission rule and decides what the
   public sees.
7. The Exclusive / Private / Public visibility tiers — a migration + allow-list; its own PR with the
   stranger-is-refused tests.

Each step removes its Studio tile and repoints Home's progress in the same PR.

## DECISION_LOG rows this implies (NOT yet written to the corpus)

- STUDIO IS LOOK AND WORDS ONLY — Studio keeps Logo · Palette + Dress Code · Love Story · Prints.
- INFO AND LOOK MOVE TO EVENT HUB SETTINGS.
- GUESTS = LIST · MAP · SEATS · MARCH; RSVP SETTINGS IN GUESTS ⚙.
- SUPPLIERS › BOOKED GAINS A SCHEDULE PART; CALL TIMES LIVE IN THE SCHEDULE; THE INSPIRATION BOX MOVES TO SUPPLIERS.
- THE THANK-YOU VIDEO MOVES TO MEMORIES AND IS FREE TO MAKE AND SAVE.
- THE EVENT HUB'S VIEWING TERMS ARE EXCLUSIVE · PRIVATE · PUBLIC (definitions above).

⚠ This partly supersedes the 2026-09-29 plan of record ("Details is the ONE place … RSVP, Seat plan,
Schedule … MOVE into Details") and the 2026-10-06 Studio-of-ten/eleven tiles rulings. Write the new
rows as superseding those, not alongside them.
