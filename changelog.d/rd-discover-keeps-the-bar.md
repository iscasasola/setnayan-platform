## 2026-10-22 · fix(nav): Discover keeps the account bar, and the bar slides when it changes set (account ↔ shop ↔ event)

Owner, 22 Oct 2026, over the signed-in Events board: *"Discover needs to show the bottom nav still."* Then: *"bottom nav
should not disappear when going to a different menu. and make its build in and build out (for example, pressing shop)
everything moves to the left and the shop icons enter from the right. when we press an event, the account menus move to
the right and the event icons enter from the left. we already did this kind of effect before."*

- **Discover (`/`) draws the account bar for a signed-in viewer** — the same `<AccountBarSlot>` and the same
  `accountBarTabs()` rule as the two `/dashboard` layouts (Shop for an owner; Discover lit), mounted by
  `front-door-account-bar.tsx` outside the shell's `<main>`, with the feed reserving the dock's measured height below
  1024. Signed out, the public front door is unchanged. In the app shell `/` stays bounced (nothing changes there).
  Cause: #6753 mounted the bar in the `(launcher)` and `(account)` layouts only, and Discover's address `/` is outside
  both — the one tab that took the bar away. Every other tab (Events · Memories · People · Shop) already landed on a
  bar; now guarded.
- **The set change slides** (extends the shipped `NavSlideController` slide and the 2026-09-22 "the bar outlives the
  slide" rules — that WIP had already landed on main): `BarSetSlide` (fetched by `<BottomDock>` after mount, plain
  `import()`, in no first load) runs a View Transition on any press that changes the bar's set. Sets read left → right
  event · account · shop (`lib/bar-set.ts`): account → Shop slides out left / in from the right; account → an event
  out right / in from the left; the reverses mirror. The dock's old and new snapshots slide through its own box (the
  frosted surface stays), the page slides with it (the account trees' content takes `sn-acct-page` for the slide only),
  the top bar holds still. 280 ms, eased. Within one bar, nothing changes. Reduced motion, no View Transitions, no
  dock on screen, or a route that has not arrived in 1.2 s → no slide, a plain swap (a slow route is never faked with
  a slide of the old page).
- Lab: `/dev/bar-lab` draws all three sets on fixtures (the real shell, tab lists and dock) for walks.
- Guards: `every-tab-keeps-the-bar.test.ts` (each account-bar tab's landing, resolved through `app/` like the router,
  draws exactly one bar; Discover's only when signed in) and `lib/bar-set.test.ts` (account spokes = the folders on
  disk; the owner's direction map followed into the keyframes; reduced motion by behaviour and stylesheet; the slide
  in no first load). Sabotaged: 6 breaks → red, restored → green.

SPEC IMPACT: DECISION_LOG row 2026-10-22 "THE BAR STAYS AND SLIDES BETWEEN SETS" (owner verbatim).
