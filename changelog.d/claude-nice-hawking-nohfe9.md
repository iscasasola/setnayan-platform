## 2026-11-13 · feat(nav): every bottom menu remembers where you left it (owner, universal rule)

Owner, 2026-11-13: *"tapping a menu when you are at a different menu will jump to your page's last state while pressing
it when you are at that menu will jump to the top"*, and *"this should apply as a universal rule across the whole app"*.

- **One rule, `lib/tab-memory.ts`.**
  - **Another tab** takes you to its LAST state: the sub-page you were on under it, scrolled to where you were.
  - **The tab you are on** takes you to its FIRST state: its own page, or a scroll to the top if you are already there.
  - It generalises the account bar's "T5" Home memory (`useHomeDoor` / `HomeSegMemory`, kept as they are) to every tab.
  - Memory is per tab (keyed by the tab's own page, so two events' Guests tabs are two tabs) and per session
    (sessionStorage).
  - Every read and write is guarded: blocked storage means a tab simply opens on its own page, as before, and a stored
    path that isn't a same-site path is ignored.
- **The shared app bar** (`BottomNav` → `BottomNavTab`) is used by the couple, supplier, admin and account bars:
  - `useTabMemory` records the current tab's page and scroll as you move.
  - Every other tab's `<Link>` carries its remembered page.
  - When a remembered page arrives, its scroll is restored once (`requestRestore` / `takeRestore` / `restoreScroll`,
    which gives way the moment the person scrolls).
  - A page's own re-tap handler still goes first (Clients' month, Home's section, `RiseScreen`), via
    `dispatchTabReselect`, unchanged.
  - The first paint draws the tabs' own hrefs, so server and client agree.
- **The event site's bars** (`HubShell` page frame and stage frame) switch panes instead of pages, so a pane's last
  state is its scroll (`createPaneMemory`).
  - Before, the page frame jumped to the top on every tap, and the stage frame did nothing on a re-tap.
  - Now another pane comes back where you left it, and the pane you are on goes to its top.
- **Not changed:** the one-page invitation's jump marks (Home · Details · Story on one scrolling page). They are places
  on a single page rather than separate menus, so a tap there still scrolls to its section.
- **Guard:** `lib/every-bottom-menu-remembers.test.ts` covers the rule's behaviour and checks that both kinds of bar go
  through it.

SPEC IMPACT: New owner rule, a universal bottom-menu behaviour. To be recorded as a DECISION_LOG row when the corpus is
available; it is not in this session.
