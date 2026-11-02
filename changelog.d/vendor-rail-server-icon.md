## 2026-08-15 · fix(vendor): the whole shop was the error page — the menu's icons were being built on the wrong side of the wall

**Every supplier, every one of their 63 screens, since 2026-08-14 17:38Z.** Opening My Shop — or anything else under `/vendor-dashboard` — returned the full-page *"Something on our end didn't work"* card. Not a broken widget: the entire shop area, for everybody who has one.

### What actually happened

`app/vendor-dashboard/layout.tsx` is a **server** component. One Shell slice 2 (2026-08-14) had it build the rail's finished row list and hand it down as `destinations`. `NavItem.icon` is a React **component**, so building that list means calling `navIconComponent` — which lives in a `'use client'` module. Calling a client module's function from the server throws:

```
Error: Attempted to call navIconComponent() from the server but navIconComponent is on the client.
  digest: '1191729668'
```

That digest is the number printed on the owner's error screen, so this is the reported fault by the object, not a lookalike.

**It could never have been intermittent.** `getNavSlotMap()` serves a resolved slot for *every* default, and `vendor.sidebar.overview` is a default — so `navSlots['vendor.sidebar.overview']` always exists, the icon branch always ran, and the layout always threw. It is only three log entries because prod has two vendor accounts and both are the owner's.

### The fix

The rail is a client component; it now resolves its own rows. `layout.tsx` passes the **same four serializable values the phone's bottom bar already receives** — `role · navSlots · bookingsBadge · threadsBadge` — and `resolveVendorDestinations` is called inside `vendor-rail-context.tsx`. Nothing about the menu changed: same five owner-locked destinations, same `__overview-exact__` sentinel, same staff scoping, same badge rule, same one resolver. Only which side of the boundary it runs on.

`vendor-nav-destinations.ts` now declares `'use client'`, which is what it has always been — it returns components.

🔑 **THE SOLE INSTANCE OF A PATTERN WAS THE TELL.** `admin-rail-context.tsx` and `event-rail-context.tsx` are both handed the serializable `navSlots` map and resolve their own icons. Only the vendor rail resolved upstream. Its two siblings were already right.

### Why 21 green tests said nothing

`vendor-rail-context.test.ts` has 21 assertions over exactly this code and **all 21 passed while the page was down** — verified by running them against the broken tree. Node's test runner has no server/client graph, so `'use client'` is an inert string literal there and the call that throws in production returns an icon in a test. CI cannot see this class at all.

🔑 **A mechanism that works in every test and dies in production is usually one whose ENVIRONMENT the tests do not model. Guard the boundary, not the behaviour.**

### New guard — `app/vendor-dashboard/_components/vendor-nav-boundary.test.ts`

Six structural assertions, all **mutation-proved with the occurrence count printed before → after**:

| sabotage | landed | caught |
|---|---|---|
| drop `'use client'` from the destinations module | 1 → 0 | ✅ 2 tests |
| **the regression itself** — layout calls `resolveVendorDestinations` again | 0 → 1 | ✅ |
| layout hands over a built `destinations` list | 0 → 1 | ✅ |
| rail stops resolving its own rows | 1 → 0 | ✅ |
| bottom bar stops reading the registry | 5 → 0 | ✅ |

The general one — *every module that resolves a nav icon declares `'use client'`* — is the one that would have caught this at the file that caused it.

🪤 **AND ITS FIRST CUT CRIED WOLF TWICE.** It flagged `app/download/page.tsx`, whose comment explains why it deliberately does *not* resolve icons, and the vendor layout's own new warning comment. A guard that flags a file for *talking about* the defect teaches you to skim past the one time it is right. It strips comments before matching now.

🪤 **AND THE FIRST MUTATION MEASUREMENT WAS WRONG** in the way this repo has already paid for: renaming `navSlots` → `navSlotsX` and counting `grep -c navSlots` reports "sabotage did not land", because the sabotaged name still contains the original as a substring — the same prefix trap as `f.event_dateX`. Re-counted word-anchored: 5 → 0.

### One existing guard was respelled, not relaxed

`lib/nav-badges.test.ts` — *"the desktop sidebars still get their counts"* — asserted the counts as object properties (`bookingsBadge: bookingsPending`), because slice 2 passed them into a resolver call. They travel as JSX props again, so it asserts `bookingsBadge={bookingsPending}`. Same one-directional rule, same two values, same element; only the punctuation between them changed. It failed on this change before being updated, which is the guard doing its job.

### Verification

- Full unit suite: **8208 pass / 4 fail**, and those 4 (`papic-*-metering`, `vendor-deep-search*`) fail identically on the untouched `origin/main` tree — missing `@electric-sql/pglite` / `@anthropic-ai/sdk` in the local module tree, not this change.
- `tsc --noEmit` output is **byte-identical** to the untouched baseline (262 `Cannot find module` errors from that same local module tree, **zero** touching any changed file).
- `lint:navicon · lint:server-only · lint:botnav · lint:vendor-layout · lint:port-controls · lint:masthead · lint:changelog-dir` all pass.

SPEC IMPACT: None — no SKU, price, schema or product change. The vendor menu is the same five destinations it was before; this only moves where their icons are resolved.
