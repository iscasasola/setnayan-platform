/**
 * shell-bleed.ts — which shelled route runs its content edge-to-edge.
 *
 * ─── WHY A LIST AT ALL ───────────────────────────────────────────────────
 * The shell moved into `app/(shell)/layout.tsx` so it survives navigation
 * (owner: *"navigation should not reload. it should only load the screen that
 * changes."*). A layout renders ABOVE the page and cannot receive a page's
 * props, so `bleed` — which /explore alone needs — has to reach the shell some
 * other way.
 *
 * 🔑 THIS IS A SEGMENT NAME, NOT A PATHNAME. Every entry is a DIRECTORY under
 * `app/(shell)/`, so a guard can prove each one resolves to a real
 * `app/(shell)/<name>/page.tsx` — see `one-shell-mount.test.ts`. That is the
 * whole difference between a list that can silently stop matching anything and
 * one that cannot. This repo has paid for the other kind repeatedly: a route
 * list that resolved to nothing, a word list 15 entries stale, a lint whose
 * targets arrived as an empty array. A list is acceptable here only because it
 * is checkable.
 *
 * ⚠ AND IT IS READ DURING RENDER, NOT IN AN EFFECT. `FrontDoorShell` calls
 * `useSelectedLayoutSegment()`, whose value comes from the same router state
 * that produced the navigation — so the correct class is in the FIRST BYTE of
 * the server HTML. Measured in a scratch Next 15.5.21 build:
 * `class="fd-col fd-bleed"` on /explore, `class="fd-col"` on /papic and /help,
 * server-rendered, no hydration jump.
 *
 * 🪤 THE ALTERNATIVES ALL FLASH, WHICH IS WHY THIS ONE WAS CHOSEN:
 *   • A page-authored marker (a `:has()` target, an injected `<style>`) lives
 *     INSIDE the page's Suspense boundary, so it is ABSENT for every frame the
 *     loading fallback occupies. Invisible today only because all twenty
 *     fallbacks return null — and it opens the moment anyone adds a skeleton.
 *   • React context set from the page is worse: every shelled page is a server
 *     component, so the setter runs in an effect AFTER paint, and because the
 *     state would live in the persisting layout it mis-paints in BOTH
 *     directions — entering /explore paints capped then snaps wide; leaving it
 *     paints prose at zero gutter then snaps back.
 *
 * To make another route full-bleed: add its directory name here and the guard
 * will confirm the directory exists. To stop one, remove it. Nothing else.
 */
export const DOORWAY_BLEED_SEGMENTS = ['explore'] as const;
