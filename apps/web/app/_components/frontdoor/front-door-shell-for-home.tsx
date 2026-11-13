'use client';

/**
 * The front door's OWN reference to <FrontDoorShell> — the same component, re-exported so `/` stops paying for a
 * layout it does not use.
 *
 * ⚡ WHY (measured 2026-11-13, production build). `FrontDoorShell` is a client component that two root-group entries
 * render: `app/page.tsx` (through `front-door.tsx`) and `app/(shell)/layout.tsx` (through `AppRailShell`). Next 15.5
 * gives a client reference ONE chunk list per route, merged across the root group with `Object.assign`
 * (`flight-manifest-plugin.js` `mergeManifest`; route groups like `(shell)` collapse into the root group), so the
 * last recorder wins — and on `/` that was the `(shell)` layout. The front page therefore downloaded
 * `app/(shell)/layout-*.js` and `one-copy-_shell_layout-*.js` (~37KB gzipped, including a second copy of the `buffer`
 * polyfill) for a layout it never renders.
 *
 * This file is a module of its own, imported only by `front-door.tsx`, so its reference is recorded by the front
 * page's entry alone and carries the front page's own chunk list. 🛡 the-front-page-ships-only-what-it-draws.test.ts.
 */
export { FrontDoorShell } from './front-door-shell';
