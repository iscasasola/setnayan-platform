## 2026-08-14 · fix(a11y): one `<main>` per page — the shared rail stops bringing a second landmark

Follow-up to One Shell slices 0 and 1. Found while re-reading `DECISION_LOG.md` after slice 1 merged: the slice-3 session had named this and said it "will bite every tree that copies that shape". **It did — slice 1 is the tree that copied it.**

**What was wrong:** `FrontDoorShell` renders the content column, and it was a `<main>` in *both* variants. On `/` that is right — the column IS the page's landmark. Inside the app it is wrong, because every surface the rail wraps already renders its own:

| surface | its own landmark |
|---|---|
| `dashboard/(launcher)/layout.tsx` | `<main>{children}</main>` |
| `dashboard/(account)/layout.tsx` | `<main>{children}</main>` |
| `dashboard/[eventId]/layout.tsx` | `SidebarShell`'s `.sn-vt-page` `<main>` |

So every converted page — ~15 account screens from slice 0 and ~110 event screens from slice 1 — shipped **two nested `<main>` landmarks**: invalid HTML, and a duplicated landmark for anyone navigating by landmark.

**The fix is the tag and nothing else.** The column is a `<main>` on the public front door and a `<div>` inside the app. `.fd-main` has exactly one consumer and every style keys off the **class**, so nothing moves visually. Verified by measurement, not assumed.

### 🔑 Why it survived: the same file already guarded the other half of this rule

`front-door-shell.tsx`'s sr-only `<h1>` is deliberately front-door-only, with a comment explaining that a shared shell must not bring the host page's headings with it — written for the 2026-08-13 *"exactly one `<h1>` each"* work. **The landmark needed the identical rule and simply did not get it.** Nothing threw, nothing rendered differently, and no screenshot could show it.

🔑 **A duplicate landmark is the same disease as the rejected query:** no error, no visible symptom, and the only way to know is to go and count. So the new guard counts.

### Both halves are pinned together

Making the shell yield its `<main>` is only correct while each host still has one — otherwise those pages end up with **none**, which is a different accessibility bug wearing the fix's clothes. `one-main-per-page.test.ts` asserts both directions, so neither can be "tidied" alone, and it separately pins `SidebarShell` to exactly one `<main>` because the event tree needs that element for its landmark **and** for the `.sn-vt-page` name the phone's page-slide animates.

🪤 **The new guard cried wolf on its own prose on its first run.** Both `<main>` counts went red against correct code, because these files *talk about* `<main>` at length in their docblocks. A guard that counts a string counts it in the comments too — and a guard that fires on correct code teaches you to skim past the one time it is right. Now counted against comment-stripped source.

🛡 **4 sabotages, each measured by occurrence count before → after: caught=4, decorative=0** — reverting the fix, declaring the tag variable but never using it (an inert fix), `SidebarShell` losing its landmark, and a host layout losing its own.

### Also: a slice-1 guard rewritten so it cannot cry wolf

`one-shell-event-rail.test.ts` hardcoded `/seating` → `seat`. The owner ruled on 2026-08-14 that **Seat plan is retired from "Also in this event"** (the guest-journey step wins), so that list would have gone red on the commit carrying out his own ruling. The route cases are now **derived from the SSOT** — every destination the rail offers must light its own row — which survives any row being added or retired, while the sub-route and no-match cases stay explicit.

✅ typecheck · ESLint · all 24 `lint-*.mjs` · **8077/8077** unit tests.

SPEC IMPACT: None — an accessibility correction to chrome. No route, price, SKU, schema or product rule changed.
