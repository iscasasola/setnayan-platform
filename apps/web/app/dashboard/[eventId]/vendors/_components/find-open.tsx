'use client';

/**
 * 🧭 THE COORDINATOR'S "FIND · OPEN" (bug, 27 Nov 2026, Apple build 10 walkthrough: tapping it did nothing).
 *
 * It used to be a `<Link href="/dashboard/<id>/vendors?tab=shortlist">` — the page it already stands on. A soft
 * navigation to the same page keeps the Suppliers shell mounted, and the shell reads `initialTab` ONCE, so nothing
 * moved (the same trap `go-to-find.tsx` names). The shell's own bus is the door: ask it for Find, then bring the
 * shell up to the top of the screen, under the app's bar, once the Find body is showing.
 */
import type { ReactNode } from 'react';
import { goToBuildTab } from '@/lib/budget-build';
import { shellBarShows } from '../../guests/_components/use-shell-bar-offset';

const TAKEOVER = '[data-budget-build-takeover]';
const FIND_BODY = '[data-suppliers-body="find"]';

/** Find is showing: its body is drawn and not hidden. */
export function findShows(root: ParentNode | null): boolean {
  const body = root?.querySelector<HTMLElement>(FIND_BODY);
  return !!body && !body.hidden;
}

/** Ask the shell for Find, then scroll the shell under the bar once Find shows. */
export function openFind(): void {
  goToBuildTab('shortlist');
  const root = document.querySelector<HTMLElement>(TAKEOVER);
  if (!root) return;
  const land = () => {
    const bar = document.querySelector<HTMLElement>('.shell-topbar');
    const barH = shellBarShows(bar) ? bar.getBoundingClientRect().height : 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, root.getBoundingClientRect().top + window.scrollY - barH), behavior: reduce ? 'auto' : 'smooth' });
  };
  if (findShows(root)) {
    land();
    return;
  }
  // Another body was showing: the shell swaps after its thumb row slides away. Land when Find is on screen.
  const mo = new MutationObserver(() => {
    if (!findShows(root)) return;
    mo.disconnect();
    land();
  });
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  window.setTimeout(() => mo.disconnect(), 2000);
}

export function FindOpen({ className, children }: { className: string; children: ReactNode }) {
  return (
    <button type="button" className={`${className} w-full text-left`} data-coordinator-supplier-verb="find" onClick={openFind}>
      {children}
    </button>
  );
}
