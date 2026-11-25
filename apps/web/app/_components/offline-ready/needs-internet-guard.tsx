'use client';

import './needs-internet.css';

import { useEffect } from 'react';

import { useToast } from '@/app/_components/toast/toast-provider';
import { startNeedsInternetGuard } from '@/lib/needs-internet';

/**
 * 📶 R15 — NEEDS INTERNET, ON THIS PAGE. Mounted once on the guest Event Hub (`app/[slug]/layout.tsx`) and on the
 * couple's pages that open with no signal (Home, Schedule, the Check-in desk — the saved copy's shapes), so the Maker's
 * doors grey there too. Draws nothing: it runs the one mechanism (`startNeedsInternetGuard`, `lib/needs-internet.ts`)
 * after the page has hydrated, and its quiet line is the house toast. Not in the dashboard's layout on purpose — the
 * Maker's own first load stays exactly as it is (`scripts/check-maker-js-budget.mjs`).
 */
export function NeedsInternetGuard() {
  const toast = useToast();
  useEffect(() => startNeedsInternetGuard(document, window, (words) => toast.info(words)), [toast]);
  return null;
}
