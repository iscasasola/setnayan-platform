## 2026-11-23 · feat(home): Unihome v5 — one signed-in Home for the whole account

Builds the owner-approved drawing `prototypes/one_profile_page_2026-11-23/unihome-v5.html` (specs 7e314b06; DECISION_LOG "UNIHOME v5 APPROVED", e03ff8a7) on `/dashboard`.

- **One scroll:** your profile (⚙ beside your name), then six sticky jump icons (You · Events · Shop · People · Memories · Discover — a `nav` named "Jump to", `aria-current` on the lit one), then Events · Shop · People · Memories · Discover, each with "See all →" to its existing full page.
  - Number marks only from reads the app already does: Shop = new for your shop (the avatar sheet's unread split), People = asking you (`waitingRequestCount`). A failed read draws no mark, never 0.
- **Removed from Home:** the `Events ▾` pinned row, the bottom bar and the account switcher pill (both hidden only while Home is on screen — `html:has([data-unihome])`), and the one-section-at-a-time swap. `?seg=events|people|shop|memories` are the full section pages, unchanged; the full Events board now lives at `?seg=events`.
- **Event cards:** organiser = Dashboard · Event Hub · remove; helper = Dashboard · Event Hub; invited = Event Hub only. Event Hub only where guests can open the hub (Public/Unlisted with a slug — the shipped rule). Remove opens the SHIPPED two-screen remove sheet (`EventCardMenu trigger="remove"`), now with "Put this away" as its first choice. Add to calendar moved into the event's ⚙ sheet under the date.
- **Shop slot:** an owner gets a quick view (cover = the shop's own cover pick `shopCoverKey`, else the first Online card's photo; logo, name, Verified, View page, "N new for your shop", "X of Y service cards online" via `readHomeCardCounts`) and "Open shop dashboard"; a helper gets their shop's row; everyone else "Create your own shop" → `/open-shop` (gated by `canOpenShop`). Supplier navy only inside that block (new `--color-supplier` / `--color-supplier-tile` tokens, light and dark).
- **Create an event:** labelled terracotta, 56 px, floating bottom right below 1280 px, at the top of the left rail from 1280 px. Opens the shipped New event sheet.
- **⚙** opens the shipped account sheet without its place rows (`AccountSwitcher trigger="gear"`): Profile & settings, other accounts, Billing & receipts, Appearance, Help, Show me around, Sign out.
- **☰:** Home with its five places under it (`/dashboard#events` … `#discover`), then Features (and HQ for admins).
- **Reads:** one batched wait (`UnihomeHome` in `(hub)/dashboard/page.tsx`); new `lib/unihome.ts`, `lib/unihome.server.ts`, and `lib/worth-planning.server.ts` (the Worth planning reader, now shared with the board's shelf). The landing rules moved unchanged into `landHome`.
- Dev lab: `/dev/unihome-lab?who=couple|supplier|new[&fail=1]`.
- Server actions: no new export.

SPEC IMPACT: None. It builds the approved drawing; the ruling is already in DECISION_LOG ("UNIHOME v5 APPROVED").
