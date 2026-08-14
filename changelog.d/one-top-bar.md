## 2026-08-14 · feat(shell): one top bar — the shared one — on every signed-in surface

**SPEC IMPACT:** `DECISION_LOG.md` row 2026-08-14 (the top bar joins the shared shell; the search question settled in favour of the command palette).

Owner, over three screenshots: *"the issue is the top nav is not there?"*

| surface | what its bar showed BEFORE |
|---|---|
| the events board | wordmark + a search box, **no "+ Create"** |
| Alaala | wordmark, **no search**, no "+ Create" |
| inside an event | **no wordmark, no search** — chat, a bell, an avatar |

Three screens, three bars. One shell has to mean one top bar, or the furniture still jumps as you move — the exact thing the conversion exists to remove.

### The doors were MOVED, not replaced — and that is the whole design

This file previously argued, correctly, that the app variant must render **no** top bar: each signed-in surface's own bar was a **reachability contract** (the launcher's holds the ⌘K palette, the bell and the account switcher; **sign-out exists nowhere else on it**), so swapping in the front door's bar would have traded a palette over your own events for a search box aimed at the supplier marketplace and dropped two doors on the way.

Every word of that still holds. What changed is the direction: each tree now **hands its own cluster** to the shared bar through a new `topBarSlot`, rendered verbatim. The shell rebuilds nothing, so nothing can be lost in translation.

**Inventory — every door on every old bar, and where it is now.** All five clusters are passed through as the same elements; the shared bar adds the wordmark, the search and "+ Create".

| tree | its old bar carried | now |
|---|---|---|
| launcher `/dashboard` | wordmark · ⌘K palette · bell · AccountSwitcher | wordmark + search now the shared bar's; bell + switcher passed |
| account spokes | wordmark · bell · AccountSwitcher | same; **gained a search** |
| inside an event | day-of "Planning" escape · unread chat · bell · AccountSwitcher | all four passed; **gained wordmark + search + "+ Create"** |
| the shop | bell · display name · AccountSwitcher | all three passed; same gains |
| Setnayan HQ | **SLA escalation pill (3 states)** · bell · **environment badge** · display name · AccountSwitcher | all five passed; same gains |

The rows in bold exist on **exactly one surface**. Those are the ones a rebuilt "standard cluster" drops without a diff line to show for it, which is why the bar takes a slot instead.

### Two searches, one question — the judgement call

The front door's box is a GET form to `/explore` (the supplier marketplace). The launcher's ⌘K is a palette over the person's **own** events. Different questions, and the shared bar can only ask one.

**The palette wins.** Every surface this bar mounts on is a room in the person's own house; a box that answers "photographer" but not "Ana's wedding" answers the wrong question on all five. And the choice is **lossless in one direction only** — the palette carries the marketplace as an escape row (`command-escape.ts`: type anything, the last row hands it to `/explore`), whereas a GET form can never reach your own wedding. Picking the form would have *deleted* an existing door to make the bar consistent.

- **ONE index, not two.** The launcher built its list inline; it now lives in `_components/frontdoor/command-data.ts` and feeds all five trees. Two builders would list different things on `/dashboard` than inside a wedding, with nothing to notice. **Costs no extra round trips on the launcher** — every read is React `cache()`d at source and that page already calls all three.
- 🚨 **A true sentence became false on ~300 screens.** The palette's docblock read *"only ever mounts on the launcher route, so the two listeners never coexist."* Correct when written; false the moment it became the shared search. **Three other components bind ⌘K** — the admin palette (108 pages), the Ugat console, the guests Living Roster — and two listeners on one keystroke stack two dialogs with **nothing thrown**. `lib/command-key-claim.ts` lets the surface-specific owner claim the key; the shared one defers. Its own box still opens it, so no control is ever dead. *A sentence is not a mechanism.*

### What it does NOT paint on a phone, and the one thing it does

Below 1024: **no rail, no "+ Create"** (a 360px row already carries identity, search and the account cluster; creation is reached from the board's create grid and the bottom bar).

⚠ **It DOES add an identity link and a search to the four trees that had neither** — a deliberate departure from "below 1024 the app variant paints no chrome", and the smaller of two costs. Rendering the bar only at ≥1024 leaves each host a second bar for phones, so the **live bell and the account switcher would mount twice on every signed-in page** — and `unread-bell-badge.tsx` carries a dated comment about the crash that double-mount already caused. Hiding identity and search instead deletes the launcher's only one-press home on mobile (its docblock calls that load-bearing) and its phone search.

### Session 9 is unblocked

`SidebarShell` had two jobs: the sticky hide-on-scroll top bar **and** the `<main>` carrying `.sn-vt-page`, the only element with that view-transition name, which the phone's nav slide freezes the document around. **The shared bar has taken the first** (same hide-on-scroll rule, owner 2026-06-15). The second is untouched. `AdminStickyTopBar` and `HomeRail` are retired — a bar component nobody renders is the next session's reasonable-looking mistake.

- 🔑 **`shell-topbar` is a contract, not a class name.** Two shipped event pages inject `.shell-topbar{display:none}` — Guests (which draws its own bar) and the Vendors takeover. The shared bar inherits it **on a wrapper**, never on `.fd-topbar`: a wrapper sets no `display`, so `display:none` cannot lose a specificity tie to `display:grid` depending on where a page's injected `<style>` happens to land. The wrapper is also the sticky box — sticky is constrained by its parent, so a header sticking inside a wrapper its own height stops being sticky at all.

### Traps this landed on

- 🪤 **A new `@media (max-width: 1023.98px)` block broke a shipped guard without breaking the code.** `rail-active.test.ts` finds the *first* narrow block naming the app variant and asserts the rail is hidden inside it. The rule was still there — in the *other* block. Correct code, red guard, and the obvious next step is to "fix" the guard. All app-variant sub-1024 rules are now in one block, with a comment saying why.
- 🪤 **The OAuth brand guard went red on a correct front door.** `home-brand-name.test.ts` reads the text inside `className="fd-wordmark"`; with two elements carrying the bare class it took the first — the app branch — and read the empty string before `<LogoMark`. Reordering the branches would have fixed it *by accident*. The app branch now carries a distinct class list, so the front door's match is unique by construction. **The front door's markup is unchanged**: Google refused brand verification on 2026-07-25 partly because the homepage showed the glyph alone.
- 🪤 **A guard matched a string, not the act.** `<AppRailShell>` with a literal closing bracket passed only while the mount took no props — so the day the launcher passed `topBarSlot` it reported a correctly-mounted rail as "imported but never rendered". Anchored on a boundary now.
- 🪤 **The ⌘K dead-jump guard was reading a file that could no longer contain the defect.** Its index moved; the guard followed it. Left pointed at the old file it would have gone green over a file with no index in it. **It protects a live rule**: the couple dashboard admits organisers only, so an index deriving `/dashboard/${event_id}` puts a 404 behind a result offered to the person just told they belong.

### Guarded so it cannot fail silently

`one-top-bar.test.ts` (18 assertions) — exactly one bar and it is the shared one · every door still **inside its surface's cluster** · below 1024 no rail and no "+ Create" · exactly one `<main>` per page · the search decision and the ⌘K claim.

**40 sabotages, every one measured by occurrence count before and after, all 40 fire.** Three of the measurements were wrong on the first run and are worth recording:

- 🚨 **One guard was genuinely decorative and was fixed:** a file-level `<AccountSwitcher\b` stayed green when the vendor bar's switcher was deleted, because that layout mentions one elsewhere. **A file-level count cannot say which element still renders.** The doors are now checked inside the cluster, sliced by balancing delimiters.
- 🪤 **Three sabotages read as "guard passed" while changing nothing** — the prefix trap, again: `<UnreadBellBadgeGONE` still *contains* `<UnreadBellBadge`, so counting the original after replacing it measured nothing.
- 🪤 **And one sabotage landed in a comment.** Replacing the first textual occurrence of `<AccountSwitcher` in the vendor layout hit a mention inside a docblock; the render stood and the guard was right. **An unverified mutation proves nothing in either direction** — not just when it fails to apply.

### Verified

Front door fetched from the running server: exactly one `fd-topbar`, one `<main>`, one `<h1>`, the OAuth-pinned title-case wordmark, and **zero** occurrences of the app-only markup (`fd-topwrap`, `shell-topbar`, `fd-wordmark-app`). Unchanged at 1280 and 375. All five signed-in trees compile and gate to `/login`. 8182 unit tests green, typecheck clean, every CI lint script passes.

⚠ **The signed-in bar itself is NOT session-verified.** Seeing it requires authenticating as a test account, which this session does not do. It is covered by the tests and by the front-door measurement above — **not** by a live observation. Do not upgrade that to "verified on the live site".

`port-control-baseline.json` regenerated in this commit so every removal reads as one line in the diff: `AdminStickyTopBar`, `HomeRail`, `HomeCommandBar`, `LogoMark`, `Wordmark` and `/dashboard/profile` on the launcher route. **The profile door was checked before the baseline was touched, not after** — it is reachable three ways (the AccountSwitcher footer, the palette's own row, the shell's account menu). A baseline line is a decision, not paperwork.
