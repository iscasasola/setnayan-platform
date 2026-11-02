## 2026-09-23 · fix(rail): the way-back row's drawing crosses as a NAME — every page inside an event was 500ing

**Production outage, ~1 hour, 2026-09-23.** Every page inside an event — Overview, Guests, Seat plan, all of them — returned 500. Public pages were fine; `/api/health` was fine. Error digest `103649783`:

```
Error: Functions cannot be passed directly to Client Components unless you
explicitly expose it by marking it with "use server".
  {$$typeof: ..., render: function, displayName: ...}
                          ^^^^^^^^
```

That value shape is a **forwardRef** — a lucide icon. `RailFocus.icon` was typed `LucideIcon`, so `dashboard/[eventId]/layout.tsx` (a SERVER layout) passed `icon: LayoutGrid`, the component object, into `front-door-shell.tsx`, which is `'use client'`. React cannot serialise a function across that boundary, so the layout threw — and a throw in `[eventId]/layout.tsx` takes every page beneath it with it.

🔑 **A TYPE IS NOT A GUARD — THIS ONE WAS AN INVITATION.** `icon?: LucideIcon` asked callers for exactly the thing that cannot travel. The fix is not to correct the one call site; it is to make the mistake unreachable:

- `RailFocus.icon` is now `RailFocusIcon` — a **name** (`'events'`), which serialises trivially.
- `front-door-shell.tsx`, the client module, owns `FOCUS_ICONS` and resolves the name to a drawing. Both sides of that map live on the client side of the boundary, so nothing is serialised.
- `dashboard/[eventId]/layout.tsx` passes `icon: 'events'` and no longer imports `LayoutGrid`.

⚖ **The owner's ruling is untouched** (2026-09-23: *"it should only always say Events regardless where you are"* · *"icon does not need to show a back button, keep the events icons"*). The row still reads **Events** and still wears the events drawing; only how that drawing is *named* changed. The other three focus rows still default to `ArrowLeft`.

🪤 **Why the guard did not catch it, and what it does now.** `rail-focus.test.ts` already pinned this row — it asserted the literal `icon: LayoutGrid`, i.e. it pinned the defect in place and would have failed the fix. It now pins the SHAPE instead: the contract takes a name, the shell owns the map, and no focus call site passes a bare capitalised identifier. Sabotage-probed in both directions — restoring `icon?: LucideIcon` plus `icon: LayoutGrid` turns it red.

⚠ **Not caught by CI, and worth knowing why.** This is a render-time serialisation error, not a type error and not a build error: `next build` succeeds, typecheck succeeds, and the route is dynamic so nothing prerenders it. The first thing that touches it is a signed-in request in production. `deploy-prod` also goes green because it only FIRES the Vercel build — it never asks whether what is now serving actually works.

SPEC IMPACT: None — the row's words, destination and drawing are exactly what the owner asked for on 2026-09-23.
