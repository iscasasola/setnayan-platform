## 2026-10-24 · fix(nav): the bar's page slide runs on the account and shop dashboards too — one slide, three dashboards

Owner, 24 Oct: *"The transition animation between menus found in event dashboard does not apply to the user and shop dashboard."*

There was always one slide (`NavSlideController` in the root layout, one set of keyframes in `globals.css`), and all three bars are the same `<BottomNav>`. Two things kept it off two of the dashboards, silently:

- **Account (Events · Discover · Memories · People):** the content carried no `view-transition-name`, so the controller started a transition that animated nothing. The `(launcher)` and `(account)` layouts' `<main>` and Discover's `[data-fd-page]` now carry `.sn-vt-page` like the event and shop trees, marked `data-sn-slide="while-sliding"`. That marker keeps the name off at rest, so the account pages get no new stacking context and no new containing block for their fixed sheets. The same elements still take `sn-acct-page` during a set change (account ↔ shop ↔ event). The selector is now keyed on the marker, not `.fd-col > main`.
- **Shop (Today · Customers · Shop · Hub):** the controller worked out the lit tab from addresses alone. The shop's tabs are lit by `activeMatch` lists (`/bookings`, `/messages`, `/verify`, `/team` …), so on every such page it found no lit tab, and that means no slide. The direction rule moved to `lib/nav-slide.ts` and reads the bar's own `aria-current="page"` first, falling back to the address rule.

Same 320 ms, same easing, same direction-by-tab-order and reduced-motion gate. The top and bottom bars hold still, and the desktop rail is untouched.

Guard: `app/_components/nav/one-tab-slide-everywhere.test.ts` checks:
- the direction rule's behaviour;
- the controller asks the one rule, and nothing else starts a view transition;
- every dashboard shell has exactly one `.sn-vt-page`, and each one's bar is the shared `<BottomNav>`;
- the account content is named only while sliding, and both listeners raise the flag before the transition;
- `sn-page` is declared once, with one timing.

Five sabotages were each caught.

Adjusted guards:
- `one-main-per-page` and `the-bottom-bar-stays` accept the class leading the account `<main>`.
- `the-bar-outlives-the-slide`'s duplicate-name check skips `none`, which is the absence of a name, and now fails if it finds no `sn-page` at all.

SPEC IMPACT: None
