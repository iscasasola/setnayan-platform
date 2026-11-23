'use client';

/**
 * part-edit-bar-lazy.tsx — the STAND-INS for what the one-editor-per-part gate draws (`part-edit-gate.tsx`): the
 * "<Name> is editing" bar and the kept / waiting-change cards, each a `next/dynamic` piece, so their code is its own
 * chunk. They draw only after the lock is read (someone else holds the part, or a change was kept or is waiting), so
 * they never ride the first load of a page that embeds the gate — the Maker embeds Schedule
 * (`scripts/check-maker-js-budget.mjs`). The Maker warms them while the phone is idle (`maker-tools.tsx`,
 * `warmDynamicExports`), so the bar never waits for a download there.
 */
import dynamic from 'next/dynamic';

export const loadPartEditBar = () => import('./part-edit-bar');
export const PartEditBar = dynamic(() => loadPartEditBar().then((m) => m.PartEditBar), { ssr: false });
export const KeptChange = dynamic(() => loadPartEditBar().then((m) => m.KeptChange), { ssr: false });
export const DraftOnLatestCard = dynamic(() => loadPartEditBar().then((m) => m.DraftOnLatestCard), { ssr: false });
