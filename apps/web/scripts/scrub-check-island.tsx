/**
 * 🎚 scrub-check-island.tsx — the guest page's Scrub ISLAND (`hub-scrub.tsx`), mounted as the page mounts it, for
 * `scripts/scrub-browser-check.mjs` to bundle into its "Maker's canvas" and "island" pages: there the island — not the
 * check — decides when the engine is armed. The lab's badge (`scrub-badge.tsx`) is mounted beside it, so the check
 * can read what the badge SAYS in each state against what the page is doing.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';

import { HubScrub } from '../app/[slug]/_components/hub-scrub';
import { LabScrubBadge } from '../app/dev/maker-lab/guest/scrub-badge';

createRoot(document.body.appendChild(document.createElement('div'))).render(
  <>
    <HubScrub />
    <LabScrubBadge />
  </>,
);
