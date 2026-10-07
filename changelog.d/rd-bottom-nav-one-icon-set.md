## 2026-10-07 · fix(nav): the five event destinations wear ONE line icon family — bar, rail and Home doorways

Owner, 2026-10-07: *"make the logo of guests, supplier and event hub consistent"* · *"fix the icons on the bottom nav as well"*; icon pick *"Smart Home · Address Book · Store · Page · Grid"* (Hub = browser window). Measured live before: the phone bar's Home drew the FILLED Setnayan mark among four line icons and Suppliers a compass — both from the nav registry's code defaults, which `getNavSlotMap()` serves for every slot.

- `EVENT_MENU_ICONS` / new `PILLAR_TAB_ICON` (`lib/customer-menu.ts`): Home → House · Guests → BookUser · Suppliers → Store · Hub → AppWindow · More → Grip; the registry defaults for `customer.bottom-nav.*` and `customer.sidebar.*` (the five) name the same; BookUser + AppWindow added to the `lib/nav-icons.ts` allowlist (House was already there). Home was first HouseWifi; owner the same day: *"that looks like a wifi home not a home"* → the plain House.
- New `lib/nav-line-icon.ts`: `navLineIcon` — an override may relabel a tab and pick another lucide icon; a mark, an image, an emoji or `none` falls back to the family. Used by the bottom bar and the rail's five rows. `homeDoorwayIcon` + `HOME_DOORWAY_ICONS` for Home's "Edit your Guest list · Suppliers · Event Hub" row (PR 4e).
- The Setnayan mark stays in the top bar only.
- Guards: `bottom-nav-is-one-icon-family.test.ts` (renders the bar fed the registry) · `home-doorways-wear-the-nav-icons.test.ts`.

SPEC IMPACT: None — DECISION_LOG row "THE BOTTOM NAV'S FIVE ICONS — THE OWNER'S PICK" (2026-10-07) already records it.
