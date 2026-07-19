'use client';

// ============================================================================
// RelationshipTabShell — the unified two-sided vendor↔couple workspace shell.
//
// Chat-first, tabbed (Chat · Quote · Payments · Files · Call · Details). Renders
// the SAME primitive for both sides — the couple's Vendor Workspace and the
// vendor's Customer Card — differing only in the slots they pass. See
// Relationship_Workspace_and_Appointments_2026-07-11.md.
//
// Layout:
//   • Mobile: a pinned context header, a horizontally-scrollable tab strip, and
//     one active panel below (only the active surface is mounted — the "tools as
//     full-screen sheets" feel, one thing at a time).
//   • Desktop (lg+): the tabbed main column on the left + a persistent context
//     rail on the right (next action / quick actions), so context is never lost.
//
// The tab CONTENT is passed in as already-rendered nodes (server components from
// the page), so the shell adds zero data-fetching — it only switches which
// surface is visible. The active tab is reflected in the `?tab=` query param
// (via replaceState, no navigation) so deep-links + back/forward work.
// ============================================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export type RelationshipTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  node: ReactNode;
  /** Optional count/dot rendered next to the label (e.g. unread, "needs you"). */
  badge?: ReactNode | null;
  /** Hide the tab entirely (e.g. Call unavailable for off-platform vendors). */
  hidden?: boolean;
};

function readTabFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get('tab');
  } catch {
    return null;
  }
}

export function RelationshipTabShell({
  tabs,
  header,
  contextRail,
  initialTabId,
}: {
  tabs: RelationshipTab[];
  header?: ReactNode;
  contextRail?: ReactNode;
  initialTabId?: string;
}) {
  const visible = useMemo(() => tabs.filter((t) => !t.hidden), [tabs]);
  const ids = useMemo(() => visible.map((t) => t.id), [visible]);
  const fallback = initialTabId && ids.includes(initialTabId) ? initialTabId : ids[0] ?? '';

  const [active, setActive] = useState<string>(fallback);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Hydrate the active tab from the URL (deep-link / back-forward) once mounted.
  useEffect(() => {
    const fromUrl = readTabFromUrl();
    if (fromUrl && ids.includes(fromUrl)) setActive(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the active tab disappears (a slot becomes hidden), fall back safely.
  useEffect(() => {
    const first = ids[0];
    if (first && !ids.includes(active)) setActive(first);
  }, [ids, active]);

  const select = useCallback((id: string) => {
    setActive(id);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', id);
        window.history.replaceState(null, '', url.toString());
      } catch {
        // replaceState is a nicety — never block tab switching on it.
      }
    }
  }, []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
        return;
      }
      e.preventDefault();
      let nextIdx = idx;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % ids.length;
      else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + ids.length) % ids.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = ids.length - 1;
      const nextId = ids[nextIdx];
      if (nextId) {
        select(nextId);
        tabRefs.current[nextId]?.focus();
      }
    },
    [ids, select],
  );

  const activeTab = visible.find((t) => t.id === active) ?? visible[0];
  if (!activeTab) return null;

  const tabStrip = (
    <div
      role="tablist"
      aria-label="Workspace sections"
      className="flex gap-1 overflow-x-auto rounded-xl border border-ink/10 bg-cream/70 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {visible.map((t, idx) => {
        const isActive = t.id === activeTab.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`rtab-${t.id}`}
            aria-selected={isActive}
            aria-controls={`rpanel-${t.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => select(t.id)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry ${
              isActive
                ? 'bg-mulberry text-cream shadow-sm'
                : 'text-ink/70 hover:bg-ink/5 hover:text-ink'
            }`}
          >
            {t.icon ? <span aria-hidden>{t.icon}</span> : null}
            <span>{t.label}</span>
            {t.badge ? <span className="ml-0.5">{t.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Main column — header + tab strip + active panel. */}
      <div className="min-w-0 flex-1 space-y-4">
        {header ? <div className="space-y-3">{header}</div> : null}
        <div className="sticky top-0 z-10 -mx-1 bg-gradient-to-b from-cream/95 to-cream/70 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-cream/60">
          {tabStrip}
        </div>
        <div
          role="tabpanel"
          id={`rpanel-${activeTab.id}`}
          aria-labelledby={`rtab-${activeTab.id}`}
          tabIndex={0}
          className="space-y-4 focus:outline-none"
        >
          {activeTab.node}
        </div>
      </div>

      {/* Desktop context rail — the persistent next-action / quick actions. */}
      {contextRail ? (
        <aside className="hidden w-full shrink-0 space-y-3 lg:sticky lg:top-4 lg:block lg:w-80">
          {contextRail}
        </aside>
      ) : null}
    </div>
  );
}
