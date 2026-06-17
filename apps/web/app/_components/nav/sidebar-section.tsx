'use client';

/**
 * SidebarSection — v2.1 Navigation Refactor Phase 0.
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 template package adoption" +
 * 14th 2026-05-28 row System Wiring Map audit. The 3-doorway nav surfaces
 * (customer · vendor · admin) all need a section primitive that renders
 * an uppercase eyebrow heading (--m-slate-2 + .m-label-mono tracking) +
 * a collapsible item list with per-section persistence. This component
 * owns the section-level interaction; child <SidebarItem>s own the
 * link-level rendering.
 *
 * SCOPE: section heading + collapsible item list. Does NOT own the
 * sidebar shell (that's <SidebarShell>) or the per-item active state
 * (that's <SidebarItem>). Pure composition primitive.
 *
 * COLLAPSED STATE: persisted to localStorage under
 * `setnayan.nav.section.<group.key>.open` ('1' = open, '0' = closed).
 * Default = `group.defaultOpen ?? true`. Stable group.key required —
 * editing the label is safe but renaming the key resets the toggle.
 *
 * COLLAPSED SIDEBAR CONTEXT: when the parent <SidebarShell> sets
 * `[data-sidebar-collapsed="1"]` on the root, the section heading hides
 * and the collapsible-toggle no-ops (items render as stand-alone icons).
 * Selectors live in tailwind arbitrary-variant syntax to keep this
 * component server-friendly where possible — but we mark 'use client'
 * because the collapsible toggle requires useState.
 *
 * Heading style: `.m-label-mono` per v2.1 globals.css (font-mono 11px
 * tracking-[0.10em] uppercase var(--m-slate-2)). Chevron-up/down on
 * the right indicates open state. Whole-row click toggles.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { NavGroup } from './types';

type Props = {
  group: NavGroup;
  /** Current pathname — passed through to caller-rendered <SidebarItem>. */
  pathname: string;
  /** Caller renders <SidebarItem>s — keeps server/client split flexible. */
  children: ReactNode;
};

export function SidebarSection({ group, pathname: _pathname, children }: Props) {
  // Header-less group (label === '') — render just the items list with no
  // heading button. Used by the customer unified 5-tab layout which uses a
  // single root group. Skips the collapsible toggle; items always render.
  if (!group.label) {
    return (
      <section className="px-2 pb-2">
        <ul className="flex flex-col gap-0.5">{children}</ul>
      </section>
    );
  }

  // pathname is part of the public Props contract so callers can pass it
  // alongside the group without restructuring; the child <SidebarItem>s
  // are the only consumers today. Reserved for future per-section active
  // hinting (e.g., auto-open the section containing the active item).
  const storageKey = `setnayan.nav.section.${group.key}.open`;
  const initialOpen = group.defaultOpen ?? true;
  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(storageKey);
      if (v === '1') setOpen(true);
      else if (v === '0') setOpen(false);
    } catch {
      // localStorage blocked — silently default.
    }
  }, [storageKey]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        // No-op.
      }
      return next;
    });
  };

  const ChevronIcon = open ? ChevronUp : ChevronDown;

  return (
    <section className="px-2 pb-2" aria-labelledby={`nav-section-${group.key}`}>
      {/* Heading row — hidden when sidebar is collapsed via parent shell's
          [data-sidebar-collapsed="1"] attribute. The selector chains on the
          group ancestor so a future v2.1.x partially-collapsed sidebar
          (icon-only with hover tooltips) still renders this row at the
          full layout decision point. */}
      <button
        type="button"
        id={`nav-section-${group.key}`}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`nav-section-${group.key}-items`}
        className="m-label-mono flex w-full items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--m-paper)] [[data-sidebar-collapsed='1']_&]:hidden"
        style={{ color: 'var(--m-slate-2)' }}
      >
        <span>{group.label}</span>
        <ChevronIcon aria-hidden className="h-3 w-3" strokeWidth={2} />
      </button>

      {/* Items list — when sidebar is collapsed the items always render
          (icon-only stand-alone tiles). When sidebar is expanded the items
          honor the section's open/closed state. */}
      <ul
        id={`nav-section-${group.key}-items`}
        className={
          open
            ? 'mt-1 flex flex-col gap-0.5'
            : 'mt-1 hidden flex-col gap-0.5 [[data-sidebar-collapsed=\'1\']_&]:flex'
        }
      >
        {children}
      </ul>
    </section>
  );
}
