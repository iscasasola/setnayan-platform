## 2026-09-02 · feat(nav): the Event Hub wears one word in all three phases

**EH3.** The couple's one public address wore a different name in each lifecycle phase, and none
of the three was the phrase their own guests had taught them. Measured on `origin/main`
@ `1838a68c6`:

| phase | the slot that was really the Event Hub | where it pointed |
|---|---|---|
| plan | **"Launch"** (Studio sub-nav child · desktop GO LIVE row) | `/website/editor` |
| dayof | **"Services"** (bottom-nav position 4) | `/launch` |
| after | **"Editorial"** (bottom-nav position 3) | `/website/editorial` |

Three names, three destinations, one thing. The vocabulary is owner-locked (2026-08-16: *Event
Hub* = the one public address) and EH1 (PR #5102) already built the destination, so this is a
relabel and a repoint — **no new route was created**.

Now: **one slot, keyed `launch`, labelled "Event Hub", pointing at the controller
`/dashboard/[eventId]/launch`, in all three phases on both SSOTs.**

- `lib/customer-menu.ts` (phone) — day-of position 4 and after position 3 keep their positions and
  change their word; the plan phase gains the Hub as a **top-level menu at position 5** (design
  § 1.2 Placement), gated on `websiteEnabled` exactly like the rail. The Studio docked-sub-nav
  "Launch" child is **removed**, not relabelled — relabelling would have printed "Event Hub" twice
  on one screen.
- `_components/customer-nav-config.ts` (desktop rail) — the GO LIVE row is renamed and repointed.
  Its `matchPrefix` narrows from `${base}/website` to `${base}/launch`: left wide it would keep
  claiming a family its href had left, lighting "Event Hub" while you stand on the editor.

🔒 **THE KEY DID NOT CHANGE, AND THAT IS THE HALF THAT FAILS SILENTLY.** `key: 'launch'` is
load-bearing in four places and three of them throw nothing when it stops matching — the registry
slots, the localStorage section-open state, the badge map. The retired **`services`** and
**`editorial`** keys have their registry defaults retired in this same commit, or `/admin/menus`
keeps offering a rename, an icon and a hide for rows that render nowhere.

**Registry slots touched** (`lib/nav-registry-defaults.ts`):

| slot | now |
|---|---|
| `customer.bottom-nav.launch` | **added** · "Event Hub" · `/dashboard/[eventId]/launch` · Globe · sortOrder 13 |
| `customer.bottom-nav.services` | **retired** (was "Services" → `/launch`) |
| `customer.bottom-nav.editorial` | **retired** (was "Editorial" → `/website/editorial`) |
| `customer.sidebar.launch` | "Launch" → **"Event Hub"**; route `/website/editor` → **`/launch`**; Rocket → Globe |
| `customer.studio-subnav.launch` | **retired** (its child was removed) |

🚪 **NOTHING WAS ORPHANED, AND THAT IS ASSERTED, NOT PROMISED.** The editorial maker "appeared in
no menu at all" once already. Its doors: the controller's S5 **"The story"** row
(`/website/editorial`) and the **desktop after-phase rail row**, which
`a-finished-event-shows-its-summary.test.ts` still holds open, unchanged. The editor's doors: the
controller's S5 **"The page itself"** row and `HubStage`'s `editHref`.

**New guard** — `lib/one-menu-word-in-all-three-phases.test.ts`: one key, one label, one href
across all three phases on both rosters; the retired words absent; the registry following the code;
the two absorbed destinations still reachable. Five sabotages applied, occurrence counts printed
before → after, each observed RED, then restored.

⚠ **OPEN — OWNER'S CALL, NOT RESOLVED HERE: two rows on one desktop rail now read "Event Hub".**
Measured with `railToolsSignedIn({ eventId, count: 1 })`: the Studio group that renders below the
event menu (`front-door-shell.tsx` § 4, "IT DOES NOT COLLAPSE") carries `pawebsite` — the App Store
product card keyed `landing-page` in `lib/add-ons-catalog.ts` — **already labelled "Event Hub"**,
pointing at the website hub `/dashboard/[eventId]/website`. This row is the controller; that row is
the product card for the same thing. Renaming or repointing `landing-page` changes a **product's**
name and destination across the Studio hub, the App Store and the `/pawebsite` marketing page — a
product decision, and `EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` § 7 does not list it among its
eight owner decisions. Both rows open real pages, so nothing dead-ends; what a person meets is one
word offered twice. Flagged in `customer-nav-config.ts` beside the row rather than guessed at.

SPEC IMPACT: `EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` — EH3 row moves ⬜ not started → ✅ shipped;
§ 7 decision 2 ("does Launch retire as a menu word entirely?") is answered YES for menu labels
(`lib/launch-save-the-date.ts` — "launch" meaning go-public — is a different word in a different
layer and is untouched). A ninth § 7 decision is added: the `landing-page` product card's name
collision with the controller row.
