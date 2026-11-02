## 2026-08-14 · feat(dashboard): One Shell slice 1 — the event tree keeps the rail, and its own menu pushes in

Owner, 2026-08-13: *"the sidebar should stay. look at here as we navigate around. what you did was jumping back to the old dashboards. so what we want to see the dashboards converted for this desktop view."* `ONE_SHELL_PLAN_2026-08-13.md` § 2 slice 1 · `DECISION_LOG.md` 2026-08-13 · drawing `prototypes/one_shell_2026-08-13.html`.

**What a person gets:** opening a wedding no longer swaps the whole page furniture. Their own rows — their events, Alaala, their story, their shop, HQ — stay exactly where they were, and the event's own menu appears underneath them.

**Scope: desktop ≥1024 only, ~110 screens, chrome only.** Zero route moves, no page-body redesign (that is session 6). Below 1024 the DOM is untouched.

### ⚖ THE ONE THING THAT NEEDS THE OWNER'S EYE

**The rail PUSHES the event group with the account rows still visible, rather than swapping wholesale.** This is the single place the new ask diverges from the approved seam prototype, which draws a wholesale swap. It is `ONE_SHELL_PLAN` § 5 OWNER DECISION #4, and it is what this slice was ordered to carry. Reversing it is a one-line change in `front-door-shell.tsx`'s `railContext` branch.

### RULE 0: the menu already existed — nothing was redrawn

`customer-nav-config.ts` is the SSOT and already gave three named sections, and the rail reproduces them exactly rather than inventing an IA:

- **Plan** → Overview · Guests · Marketplace · Studio
- **Go live** → Launch (gated on the website surface)
- **Also in this event** → Schedule · Seat plan · Budget

🔒 Every row is a **plain leaf** — *"solid menu with no submenus"* (owner 2026-07-15). `NavItem.children` is deliberately never rendered, and a guard fails if it ever is. 🔒 **Budget stays out of Plan** (owner removed it 2026-07-10); it is a quiet link under "Also in this event", where it already lives. `template.tsx`, the mobile bottom nav and the docked sub-nav were all left alone.

### 🪤 The trap that decided the whole shape: `SidebarShell` STAYS MOUNTED

`SidebarShell` wraps content at **all** widths, not just desktop. Its `<main>` carries the app's **only** `.sn-vt-page` (`view-transition-name`) — the one element the phone's bottom-nav carousel slides — and `[data-shell-main]` inside it is what gives the docked sub-nav its extra bottom room. **A "desktop-only" conversion that dropped this component would have silently deleted the phone's page-slide and its sub-nav padding, at widths where the new rail does not even paint.**

So it is not removed. A new `desktopRailExternal` prop makes it render **no `<aside>`** and take **no desktop offset**, and change nothing else. Below 1024 the flag is inert by construction: the `<aside>` was already `hidden lg:flex` and the offset only ever applied at `lg`.

🔑 **The aside is UNMOUNTED, never hidden.** `display:none` on a dozen focusable links would leave them reachable by keyboard behind the rail — a real mount condition, not a style that looks like one.

### 🚨 Removing the plaque would have stranded sign-out on the couple's desktop

The desktop sidebar header carried `<SwitcherPlaqueTrigger>`, and the top bar's `<AccountSwitcher>` was `lg:hidden`. With the rail owning the left column that header stops rendering — so **sign-out, profile and Setnayan AI would have had no door at all on the couple's desktop.** The council's 2026-07-16 acceptance criterion was never about the plaque; it was that this surface always keeps that path. The switcher now renders at **every** width, exactly as the launcher and the account spokes keep their own slim bar beside the rail. The event's identity is not lost with the plaque: the rail's context group is headed by the event's name.

### Verified before changing anything

- **The seat plan's locked coordinate contract is container-relative.** Canvas width comes from a `ResizeObserver` on the canvas element and `SeatingFrame` re-measures its own top offset on resize, so a narrower content column re-derives metres-per-pixel rather than drifting. Checked before the container moved, not after.
- **Full-bleed working surfaces stay full-bleed** inside the content column — `[data-chrome='app']` makes `.fd-main`/`.fd-col` a pure passthrough (no padding, no max-width), and the layout's own container is unchanged. Live Studio control is a top-level `/panood` route and never saw this layout.
- **The `/[slug]` guest sites are NOT converted.** Guests are not "in the app"; they wear the couple's mood-board theme. No rail, ever.
- **Vendor and admin are untouched** — `desktopRailExternal` defaults to `false`, so their two `SidebarShell` mounts are byte-identical. They are slices 2 and 3.

### 🔑 Labels come from the nav registry, or an admin rename applies on the phone and not the desktop

The rail reuses `applyRegistry` — now exported rather than copied. Two overlays would be two answers to one question, and an admin's rename would reach the phone and the old sidebar and silently miss the desktop rail. Same reasoning for the active row: it uses the **shipped** `activeRailKey` → `matchesPath`, so there is one matcher, and the behaviour tests call the **real** builder rather than a copy of its rows.

### 🔑 The terracotta is derived, never re-typed

The context heading takes `var(--m-mulberry)`, the app's CTA token on `:root`. Typing `#C24E25` is precisely the defect design#6 shipped as a hand-typed `#9A8F86` that no token owned and no contrast guard could follow — and a guard now fails on a literal in that file. The arithmetic, stated because a colour pairing is a claim: terracotta on the rail's cream is **4.61:1**, AA for normal text, the same figure `globals.css` already records for that pair. It is deliberately **not** gold, which has 0.29 of headroom on cream and fails under anything.

### Decided, not discovered

Between 1024 and 1279 the rail is a 72px icon strip and the words go, including the event name and the **Guests head-count** — exactly as the events and Alaala counts on the account rows above already behave. Every destination is still one press away; only the prose goes. `ONE_SHELL_PLAN` § 3 lists this as a thing to decide rather than trip over.

### Guards — 15 sabotages, every one measured and every one caught

`one-shell-event-rail.test.ts` (14 tests). Baseline green first, then each sabotage applied with its **occurrence count printed before → after**, because an unmeasured mutation proves nothing: three sabotages in the first pass did not land at all (harness quoting) and were re-run until they did. **caught=15 · decorative=0.** They cover the rail being unmounted, the context group deleted, `SidebarShell` dropped, `data-shell-main` removed, the flag unset, the aside hidden-instead-of-unmounted, the offset left non-zero, `.sn-vt-page` deleted, the switcher re-hidden on desktop, a section renamed, the Budget row deleted, children rendered, the `__home__` sentinel tidied away, terracotta hand-typed, and the event name left visible on the 72px strip.

**Not verified by me:** nothing here has been seen rendered — `pnpm build` cannot run on this machine and the signed-in event tree needs an authenticated session. Typecheck, ESLint, all 24 `lint-*.mjs` scripts and the full 8038-test unit suite pass; CI is the only valid build claim.

SPEC IMPACT: None — chrome only. No route, price, SKU, schema or product rule changed. The two-level rail model (`ONE_SHELL_PLAN` § 5 decision #4) is surfaced for owner sign-off, not decided here.
