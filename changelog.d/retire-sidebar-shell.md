## 2026-08-15 · refactor(nav): retire `SidebarShell` — the last two trees take over its three remaining jobs

**Nothing moves on screen. That is the whole acceptance criterion**, and it is what most of this entry is about: the component had three jobs left, all three fail SILENTLY, and one of them only fails on a phone.

**It was much smaller than the briefs said.** Measured at `origin/main` `484ec515b`: 281 lines and **exactly two real imports** — `app/dashboard/[eventId]/layout.tsx` and `app/vendor-dashboard/layout.tsx`. 29 files contained the string; the other 27 are comments, CSS prose and test messages. Earlier notes claimed "16 consumers" / "20 mounts", which were string hits. **Both real importers already passed `desktopRailExternal`**, so the entire `<aside>` branch inside the component had been unreachable since One Shell slice 1/2 — nobody had seen that sidebar at any width for two days.

### The three jobs, and where each went

Both layouts now wrap their content in the same two nested elements the shell used to render:

```jsx
<div className="sn-ambient min-h-screen">
  <main className="sn-vt-page">…</main>
</div>
```

1. **`.sn-ambient` — the warm Atelier ground.** The shell painted it on its own root, which sits **inside** the rail's content column, so it paints over the rail's cream. 🔑 **The admin tree's copy is NOT the same thing**: admin puts `sn-ambient` on its *outermost* div, where `.fd`'s own `background` covers it entirely. Copying admin's shape here would have recoloured every event screen (`--fd-cream #FDFBF7` instead of `#F7F5F0`) and — worse on the vendor side, whose outer `<div>` sets **no background at all** — put all 63 supplier screens on plain white. Nothing throws either way.
2. **`.sn-vt-page`** — the ONLY element in the app with `view-transition-name: sn-page`. `NavSlideController` freezes the document around exactly that element for the phone's bottom-nav carousel. It wraps content at **all** widths, not just desktop, which is why "the rail replaced the sidebar on desktop" was never the whole story: dropping it breaks the PHONE while every desktop test stays green.
3. **The `<main>` landmark.** `FrontDoorShell` renders a `<div>` in its app variant *precisely because* the host owns the landmark (`one-main-per-page.test.ts`). So this had to be a `<main>`, not admin's `<div>` — a `<div>` leaves the tree with no landmark at all, which is the state the admin console is in today (named in the guards, deliberately not "fixed" here).

⚠ **They stay TWO elements, not one tidy wrapper.** `view-transition-name` snapshots the element it names; folding the painted ground into it makes the background **slide with the page** instead of standing still behind it — a visible change to the one animation this work exists to protect. Both guards assert the un-merge, and both mutations were caught.

### What the deletion removed, proven unreachable first

- `data-sidebar-collapsed` on the content root. Every consumer of `[[data-sidebar-collapsed='1']_&]` lives in `sidebar-item` · `sidebar-section` · `doorway-sidebar-header` · `customer-sidebar` · `SwitcherPlaqueTrigger` — **all unmounted**, checked by hand.
- Two intermediate wrapper divs (`lg:transition-[padding]`, `lg:pl-0`) and `lg:pl-[var(--shell-main-offset)]`, whose offset was already pinned to `0px` by `desktopRailExternal`. All three computed to zero padding.
- `--sidebar-width` (`:root`) and the `.sn-sidebar` glass fork — **zero consumers** once the `<aside>` was gone. A scope class with no element is not dormant styling, it is a rule that can never match. The `--m-sidebar-*` tokens are KEPT: the unmounted sidebar components still read them.

### Two guards fired that the brief did not name — both were right to

- 🛡 **`lint-port-no-lost-controls.mjs`** went red on six removed controls (`SidebarShell` ×2, `CustomerSidebar`, `DoorwaySidebarHeader`, `SwitcherPlaqueTrigger`, `EventMonogram`). All six were already unreachable behind `desktopRailExternal`. Verified green at `484ec515b` before regenerating, so the baseline diff carries each removal as one readable line — which is the point of that file.
- 🪤 **`nav-badges.test.ts` CRIED WOLF ON MY OWN PROSE.** Its `jsxElement()` sliced from the first `<Tag` it found, and a new docblock sentence naming `<VendorBottomNav>` anchored it onto the comment — so it reported the phone had been starved of its badge counts, which was false in both layouts. **This is the second time in this repo a guard has been fooled by prose about the thing it counts**, so the comment-stripper from `one-main-per-page.test.ts` was copied in rather than re-invented. Its couple-side assertion was separately **retargeted, not relaxed**: `<CustomerSidebar>` is not the couple's desktop menu any more, `<EventRailContext>` is, and it already receives `guestCount`.

### The four named guards were rewritten, never deleted

`one-shell-event-rail.test.ts` · `one-main-per-page.test.ts` · `one-top-bar.test.ts` · `vendor-rail-context.test.ts` each asserted "`SidebarShell` is still mounted". The component is gone; **the rules it carried are not**, so every assertion was re-pointed at the element that owns the job now — exactly one `.sn-vt-page` per tree, unconditional, on the tree's single `<main>`, beside (never merged with) the ground. The `viaShell` escape hatch is removed from both landmark guards, because no tree can delegate to a component that does not exist.

🔬 **16 mutations, every one MEASURED before → after and every one caught; 0 decorative.** Deleting the named element · demoting the `<main>` to a `<div>` · gating the wrapper on a breakpoint · dropping `[data-shell-main]` · dropping `.sn-ambient` · dropping its `min-h-screen` · merging ground into name · re-adding an `<aside>` · starving the desktop menu of its count — each on both trees where applicable. Two cases first reported **NOT LANDED** because the harness measured the anchor it prepended to rather than the `<aside` it injected; re-measured on the right token, both were caught. An unmeasured mutation proves nothing in either direction.

**Verified:** typecheck 0 · `test:unit` **8237/8237** · all 21 `lint-*.mjs` + `lint-dup-rule-baseline` + `pnpm lint` (eslint) clean. Real imports of the component: **2 → 0**. `pnpm build` cannot run on this machine; CI is the only valid build claim.

⏭ **Named, not done:** `customer-sidebar.tsx`, `doorway-sidebar-header.tsx`, `sidebar-section.tsx`, `sidebar-item.tsx` and `SwitcherPlaqueTrigger` now have zero consumers, joining `admin-sidebar.tsx`, which has had none since slice 3. Deleting that cascade is a separate change with its own blast radius, deliberately not bundled into a zero-visible-change PR. The admin console's missing `<main>` landmark is likewise recorded in the guards rather than quietly normalised.

SPEC IMPACT: None — chrome only. No SKU, price, schema, route or copy change; no server-side semantics touched.
