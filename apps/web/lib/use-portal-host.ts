'use client';

import { useSyncExternalStore } from 'react';

/**
 * `document.body` for a sheet that must be drawn into <body> (the dashboard's page wrapper traps `position: fixed`) —
 * null on the server and while hydrating server HTML, so a sheet rendered on the server (a dev lab that opens it at
 * once) still draws its first frame in place and the two agree.
 *
 * ⚡ ON A TAP IT IS <body> AT ONCE (owner 2026-11-17 *"since it shows, it feels like it is lagging"*). This used to be
 * `useState(null)` + `useEffect(() => setHost(document.body))`, so EVERY sheet opened by a tap rendered twice before it
 * could move: once in place, then again as a portal — and because a portal is a different element from the box it
 * replaces, React threw the whole first render away and mounted every child a second time. A heavy screen paid its
 * whole render twice before its first frame. `useSyncExternalStore` answers from the server snapshot (null) only while
 * hydrating; a client mount reads <body> in its first render.
 * 🔒 lib/a-sheet-mounts-once-on-a-tap.test.ts
 */
const never = () => () => {};
const body = () => document.body;
const none = () => null;

export function usePortalHost(): HTMLElement | null {
  return useSyncExternalStore(never, body, none);
}
