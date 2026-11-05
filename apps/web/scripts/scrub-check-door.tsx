/**
 * 🚪 scrub-check-door.tsx — the stranger's FIRST-SCREEN FIT (`first-screen-door.tsx`, main's: the cover makes room
 * for "Get inside" on a short screen), mounted on the check's static pages as the real page runs it — inside the
 * door's own `<details>`, where `GetInside` renders it — for `scripts/scrub-browser-check.mjs` (16) to see the fit and
 * a wrapped cover TOGETHER. The fixture's static render already carries the component's inert `<span hidden>`; this
 * mounts a live one beside it (the fit reads only `closest('details')` from its own mark).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';

import { FirstScreenDoor } from '../app/[slug]/_components/first-screen-door';

for (const door of document.querySelectorAll('details.sn-door-dock[data-get-inside]')) {
  const host = door.appendChild(document.createElement('span'));
  host.setAttribute('data-check-only', ''); /* the check's own mount: not a box of the page (`BOXES` skips it) */
  createRoot(host).render(<FirstScreenDoor />);
}
