# CTRL · Event menu by moment — owner-approved, ready to schedule (2026-09-24)

Owner, 2026-09-24: *"schedule it with the other builds."* **Nothing is built:** no branch, no PR.

**Prototype (binding, zero JS):** `build-sessions/prototypes/event_menu_by_moment_2026-09-24.html`
- Every row has a Why panel: where it was, why it's here, why this name.
- The foot has the per-row ledger for all 18 rows.

## The structure — one structure for every event type

Owner: *"the other event will change accordingly. since wedding has all features."* The existing
event-type gating drops the rows a type doesn't have, and an empty section hides its heading.

- **Event's name row** → **Details** (renamed from Personalization)
- **Overview · Papic · Galleries** (no heading). Editorial joins them after the event.
- **BOOK:** Your Team · Budget
- **LOOK:** Mood Board ✦ · Logo Maker ✦ · Pakanta ✦
- **INVITE:** Guests · Hosts · Event Hub Controller
- **THE DAY:** Schedule · Check-in (day-of only) · Seat plan · 3D Plan ✦ · Live Studio ✦ · Patiktok ✦
- **End of list:** Setnayan AI ✦ · Suite · Refer a couple

Logo Maker goes from row 26 of 27 (+11 hidden) to row 9 of 21, directly under Mood Board.

**Phone bottom bar (5 tabs):**

| Phase | Tabs |
|---|---|
| Planning | Overview · Papic · Your Team · Guests · Event Hub Controller |
| The day | Overview · Papic · Check-in · Event Hub Controller · Schedule |
| After | Overview · Papic · Galleries · Your Team · Event Hub Controller |

The moment strip docks above the bar on the **phone only**. Owner: *"why is this side repeating?"*
when it was drawn beside the rail on wide screens.

## Owner rulings, 2026-09-24 — not in DECISION_LOG yet; the build adds them

1. **"Browse by category" is REMOVED inside an event, not renamed.** *"we already have your team as
   where they search, negotiate and build their suppliers."* It opened `/explore`, the public
   directory that doesn't know the event.
2. *"papic is the life source of setnayan. it is where we collect photos and make memories."*
   Papic sits under Overview in every phase and is a phone tab in every phase.
3. **The Studio heading is dissolved.** Products sit at their moment, marked ✦. This changes the
   form of the 2026-08-21 ruling.
4. Papic replaces **Suite** on the planning bar. Suite stays in ☰.
5. Papic replaces **Seat plan** on the day-of bar. Seat plan stays in ☰ and in the strip.
6. **Personalization → Details.**

Other renames, one word per page: Now→Overview · Seats→Seat plan · All services→Suite ·
Review→Your Team. Studio's "Event Hub" row and Event Hub Controller become one row.

## Measured facts for the builder (origin/main 3d9f2c740)

- **Two trees today.** `lib/customer-menu.ts` feeds the phone bar and dock.
  `customer-nav-config.ts` feeds the desktop rail **and** the ☰ drawer, via
  `event-rail-context.tsx`. The shell draws Browse by category and the Studio group itself
  (`front-door-shell.tsx`; `lib/studio-rail.ts` via `app-rail-shell.tsx`). Merge them into one
  sectioned tree; don't add a third.
- 🐞 **`CustomerBottomNav` never passes `websiteEnabled`**, so the planning Hub tab never renders
  on phones. `one-menu-word-in-all-three-phases.test.ts` passes `websiteEnabled: true` itself, so it
  can't see this.
- Prod `nav_slot_override` has **0 rows** (read 2026-09-24), so code labels are what shows.
- **Keep every key** (`launch`, `explore`, `studio`, `home`, `guests`, `budget`, `refer`…). They
  drive registry slots, localStorage section state, badges and hideKeys, and fail silently if
  changed. A new `papic` bar key needs a `customer.bottom-nav.papic` registry default. Retire the
  day-of `seats` slot default.
- Studio product rows can reach the rail as **plain data**:
  `railToolsSignedIn({eventId, count: 1, profile})` in `layout.tsx`. Place them by key:
  - `papic` → the spine under Overview
  - `mood-board` · `palogo` · `pakanta` → Look
  - `pa3d` · `panood` · `patiktok` → The day
  - `setnayan-ai` → the end of the list
  - drop `pawebsite` (merged into the Hub) and `__all__` (the `studio` item becomes the Suite row)
  - any unknown future key → the end, so nothing is silently lost
- **Icons cross the server→client boundary as NAMES only** (the RailFocusIcon pattern).
- Gate the rail's Seat plan row on `seatingEnabled` too; today only the day-of tab is gated.
- **Guards that go red on purpose** (update them to the new rulings, never weaken them):
  - `customer-menu.test.ts`
  - `studio-follows-you-in.test.ts`
  - `front-door-invariants.test.ts`
  - `studio-menu-adapts-to-event.test.ts`
  - `studio-rows-are-lit.test.ts`
  - `one-event-hub-door.test.ts`
  - `the-rail-moves.test.ts`
  - `one-shell-event-rail.test.ts` (PR #5933 touches this one too)

  About 19 tests read these builders:
  `git grep -l "buildCustomerNavGroups\|buildCustomerMenuTree\|EventRailContext"`.

Memory: `your-team-is-where-couples-find-suppliers.md` · `papic-is-the-life-source.md`.
