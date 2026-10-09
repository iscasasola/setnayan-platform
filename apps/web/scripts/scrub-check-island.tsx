/**
 * 🎚 scrub-check-island.tsx — the guest page's Scrub ISLAND (`hub-scrub.tsx`), mounted as the page mounts it, for
 * `scripts/scrub-browser-check.mjs` to bundle into its "Maker's canvas" page: there the island — not the check —
 * decides when the engine is armed.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';

import { HubScrub } from '../app/[slug]/_components/hub-scrub';

createRoot(document.createElement('div')).render(<HubScrub />);
