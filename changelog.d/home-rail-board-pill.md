## 2026-07-31 · feat(home): one chrome row instead of two, a board instead of a sentence, and a thumb nav

The launcher spent its two most valuable rows on chrome. A full-width header strip (wordmark | bell + avatar) from `(launcher)/layout.tsx`, then a full-width search block from `page.tsx`, and only then the user's own content. The owner said it twice: *"on the upper part, that is the header part. we do not want this. it looks generic."* and, after the first pass left the search where it was, *"the search bar is still on top."*

### The header was not deleted — it was folded

`_components/home-rail.tsx` carries **identity · search · bell · account** on one sticky row, rendered by the page so it sits above the page's own content.

Deleting the header outright was the obvious move and the wrong one: the bell is the only door to `/dashboard/notifications`, and the AccountSwitcher is the only door to profile, Shop/HQ, Setnayan AI and **sign-out** — which exists nowhere else on this surface. That is precisely the orphaned-doorway bug class `Route_Wayfinding_Audit_2026-07-15` exists to stop (rule 3: never delete the only door). Every control the header held still renders; it just no longer costs a row of its own. The 2026-07-16 "Wordmark = home · plaque = account menu" grammar is preserved, including the mobile case where no other surface renders a wordmark.

`HomeCommandBar` gained a `variant` prop. `'bar'` is the untouched default; `'rail'` is the compact trigger. No other consumer changes.

**Scope note:** the `(launcher)` group contains ONLY `/dashboard`. The other account spokes (people · library · profile · setnayan-ai · notifications · year) render their own copy of the slim bar from `(account)/layout.tsx` and are untouched. Do not "tidy" them to match without giving each its own rail first, or they lose their account menu.

### The hero sentence became a board

`"2 events in motion · 68 things need you"` stated two numbers and offered nowhere to go with them. `_components/home-board.tsx` turns each into a tile with a count, a unit and one line of context — answering the owner's ask for *"a place for their shop with a bit of information and a place for the admin with a bit of information that can help us navigate faster and know if we need to visit our shop/admin."*

**Every value is an aggregate the page already computed** for the Watch tile — `needsTotal`, `active.length`, `adminOpenTotal`, the per-shop `shopNeedCount`, `finished.length`. The component derives nothing and invents nothing.

Two rules it enforces:

- **A tile with no true number does not render.** "Needs you" appears only when something does; zero is the absence of the tile, not a tile showing zero.
- **Capability-gated like Spaces.** Shop and HQ render only for `roles.hasVendorAccess` / `roles.hasAdminAccess`. A plain couple sees two tiles, not five with three dead ones.

Caught in self-review before commit: the Alaala tile was first written as `value: activeCount` labelled `"kept"` — the exact fabrication the file's own header forbids. It now shows `finished.length` ("celebrated"), and when nothing has finished it renders its sub-line with **no number at all** rather than a hollow `0`.

On phones the row is a snap scroller ordered **waiting-first**, so a tile that needs the user can never be the one off-screen.

### A thumb nav on phones

`_components/home-pill-nav.tsx` — a floating glass pill, `sm:hidden`. Owner: *"let the thumb space have it's space… follow the best rules for a mobile view app. and of course, follow the pill like bottom nav if needed."*

All five targets are links **this same page already renders** — `/dashboard`, `/dashboard/library`, `/dashboard/create-event`, `/dashboard/people`, `/dashboard/samahan`. Nothing invents a route. The fifth slot is capability-gated, so a plain couple gets four honest targets rather than five with a dead one. Create is the raised centre knob: the one thing this page exists to start, in the one position either thumb reaches. The page carries `pb-28 sm:pb-10` so the pill never covers the last card.

### Verified

`tsc --noEmit` clean · `next lint` clean (the two warnings are pre-existing, in unrelated files) · `check-migration-timestamps`, `lint-dup-rule-baseline`, `lint-exposure-baseline`, `migration-doctor`, `lint-page-masthead` and `lint-nav-icon-source` all exit 0. No SQL, no RLS, no policy touched — the exposure baseline is unchanged by construction.

SPEC IMPACT: None. No data model, pricing, or entitlement changes — presentation and navigation only. The prototype this implements is `06_Prototypes/User_Home_REDESIGN_2026-07-30.html` in the spec corpus.
