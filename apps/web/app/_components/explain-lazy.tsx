'use client';

/**
 * explain-lazy.tsx — the STAND-INS for what an ⓘ opens (`explain-open.tsx`): the phone's popup and the computer's note,
 * each a `next/dynamic` piece, so their code is its own chunk loaded on the ⓘ's first press (`explain.tsx`). The Maker
 * warms them while the phone is idle (`maker-tools.tsx`, `warmDynamicExports`), so its first ⓘ tap never waits.
 * Never drawn by the server: they exist only after a press.
 */
import dynamic from 'next/dynamic';

export const loadExplainOpen = () => import('./explain-open');
export const ExplainPopup = dynamic(() => loadExplainOpen().then((m) => m.ExplainPopup), { ssr: false });
export const ExplainNote = dynamic(() => loadExplainOpen().then((m) => m.ExplainNote), { ssr: false });
