'use client';

import dynamic from 'next/dynamic';

/**
 * 🗂 R4 · The Guests summary row (`guests/_components/view-summary-cards.tsx`), loaded only where it is drawn — Guests ›
 * March — never with the Maker's march (which draws its one plain line). It wears the Guest list's CSS module, so it
 * travels in its own chunk.
 */
export const ViewSummaryCards = dynamic(() => import('../../guests/_components/view-summary-cards').then((m) => m.ViewSummaryCards));
