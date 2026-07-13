'use client';

import { useId, useState, type ComponentType, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Expandable — the launcher's expand/collapse row (owner 2026-07-13:
 * "everything on the home page … must expand and collapse on the page" — i.e.
 * account-level features open INLINE instead of shuttling the user off to their
 * own page. Only the three role-routed dashboards — event, vendor, admin — still
 * navigate).
 *
 * A self-contained accordion: a full-width header button (icon · title ·
 * subtitle · chevron) over a collapsible panel. The panel body is server-
 * rendered and passed as `children`, so all data-fetching stays in Server
 * Components — this client wrapper owns only the open/closed toggle. Height
 * animates via the grid-rows 0fr→1fr trick; while collapsed the panel is
 * `inert` + `aria-hidden` so its links/controls stay out of the tab order.
 */
export function Expandable({
  icon: Icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  /** Open on first paint (rare — most rows start collapsed). */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-cream transition-colors ${
        open ? 'border-mulberry/30' : 'border-ink/10'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-mulberry/[0.03]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mulberry/10 text-mulberry">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block truncate text-xs text-ink/55">{subtitle}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={`h-5 w-5 shrink-0 text-ink/40 transition-transform duration-200 ${
            open ? 'rotate-180 text-mulberry' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div
            id={panelId}
            role="region"
            aria-label={title}
            aria-hidden={!open}
            inert={!open}
            className="border-t border-ink/10 p-4"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
