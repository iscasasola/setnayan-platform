'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Lock,
  PanelsTopLeft,
  Smartphone,
} from 'lucide-react';

/**
 * EditorShell — the unified website editor's two-pane client shell
 * (Unified Website Editor · design 2026-07-25 · PR-1).
 *
 * LEFT: the controls rail, grouped the way a couple thinks about their site
 * (① Site · ② Sections · ③ Chapters). In PR-1 every row is a header + status
 * chip + deep-link to its existing editor; PR-3/PR-4 convert them to inline
 * panels calling the same server actions.
 * RIGHT: the couple's REAL public page in a same-origin iframe, with the four
 * lifecycle phase tabs (host-only `?phase=` override) — so they always see what
 * they are editing.
 *
 * Two-way sync with the site's EditorBridge (app/[slug]/_components/
 * editor-bridge.tsx), both directions origin-checked:
 *   rail row selected  → postMessage {t:'scrollTo'} → preview scrolls+highlights
 *   section tapped in preview → {t:'edit'} → the matching rail row activates
 */

export type RailRow = {
  key: string;
  label: string;
  blurb?: string;
  href: string;
  status?: string;
  /** Which preview section this row points at (EditorBridge SECTION_IDS key). */
  anchor?: string;
  /** Website Pro item — gold tag; `locked` adds the lock affordance. */
  pro?: boolean;
  locked?: boolean;
  /** Inline edit panel (PR-3) — rendered by the SERVER component with the
   *  feature's own bound server action, so this client shell only toggles its
   *  visibility and never owns a write path. When absent the row stays a
   *  deep-link to the editor that owns the setting. */
  panel?: React.ReactNode;
};

export type RailGroup = {
  key: string;
  title: string;
  hint?: string;
  rows: RailRow[];
};

type PhaseKey = 'save_the_date' | 'rsvp' | 'event' | 'editorial';
const PHASES: Array<{ key: PhaseKey; label: string }> = [
  { key: 'save_the_date', label: 'Save-the-Date' },
  { key: 'rsvp', label: 'Invitation' },
  { key: 'event', label: 'Wedding day' },
  { key: 'editorial', label: 'After' },
];

export function EditorShell({
  groups,
  publicLandingUrl,
  initialPhase,
  initialOpenRow = null,
  proUnlockHref,
  showProCta = true,
  liveHref,
  goLiveSlot,
}: {
  groups: RailGroup[];
  /** `/[slug]` — null when the couple has no URL yet. */
  publicLandingUrl: string | null;
  initialPhase: PhaseKey;
  /** `?open=<rowKey>` — the row a save redirected back to (PR-3). */
  initialOpenRow?: string | null;
  proUnlockHref: string;
  /** Hide the umbrella CTA once the couple owns Website Pro (PR-4). */
  showProCta?: boolean;
  liveHref: string | null;
  /** The go-live / schedule control (server component passed as a child). */
  goLiveSlot?: React.ReactNode;
}) {
  const [phase, setPhase] = useState<PhaseKey>(initialPhase);
  const [activeRow, setActiveRow] = useState<string | null>(initialOpenRow);
  const [openPanel, setOpenPanel] = useState<string | null>(initialOpenRow);
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const previewSrc = publicLandingUrl
    ? `${publicLandingUrl}?phase=${phase}&editor=1`
    : null;

  /** Rail → preview. */
  const scrollPreviewTo = useCallback((anchor?: string) => {
    if (!anchor) return;
    frameRef.current?.contentWindow?.postMessage(
      { source: 'setnayan-editor', t: 'scrollTo', key: anchor },
      window.location.origin,
    );
  }, []);

  /** Preview → rail. */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; t?: string; key?: string } | null;
      if (!data || data.source !== 'setnayan-site') return;
      if (data.t !== 'edit' || typeof data.key !== 'string') return;
      const match = groups
        .flatMap((g) => g.rows)
        .find((r) => r.anchor === data.key);
      if (!match) return;
      setActiveRow(match.key);
      setMobilePane('edit');
      document
        .getElementById(`rail-row-${match.key}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [groups]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Topbar — identity, go-live, view-live (absorbs the old Launch hero) */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink/10 bg-white px-4 py-2.5">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-terracotta">
          Website editor
        </p>
        <p className="min-w-0 truncate text-sm font-semibold text-ink">
          {publicLandingUrl ? `setnayan.com${publicLandingUrl}` : 'Set your website address'}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobilePane((p) => (p === 'edit' ? 'preview' : 'edit'))}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 lg:hidden"
          >
            {mobilePane === 'edit' ? (
              <>
                <Smartphone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Preview
              </>
            ) : (
              <>
                <PanelsTopLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Edit
              </>
            )}
          </button>
          {liveHref ? (
            <Link
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5"
            >
              View live
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── LEFT RAIL ─────────────────────────────────────────────── */}
        <nav
          className={`w-full shrink-0 overflow-y-auto border-r border-ink/10 bg-cream px-3 py-4 lg:block lg:w-[390px] ${
            mobilePane === 'edit' ? 'block' : 'hidden'
          }`}
        >
          {goLiveSlot ? <div className="mb-5">{goLiveSlot}</div> : null}

          {groups.map((group) => (
            <section key={group.key} className="mb-6">
              <p className="flex items-baseline justify-between gap-2 px-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-terracotta">
                {group.title}
                {group.hint ? (
                  <span className="font-sans text-[0.7rem] normal-case tracking-normal text-ink/40">
                    {group.hint}
                  </span>
                ) : null}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {group.rows.map((row) => {
                  const isActive = activeRow === row.key;
                  const isOpen = openPanel === row.key;
                  const meta = (
                    <>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-[0.82rem] font-semibold text-ink">
                          {row.label}
                        </span>
                        {row.blurb ? (
                          <span className="block text-[0.7rem] text-ink/50">{row.blurb}</span>
                        ) : null}
                      </span>
                      {row.pro ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-amber-800">
                          {row.locked ? (
                            <Lock
                              aria-hidden
                              className="mr-0.5 inline h-2.5 w-2.5"
                              strokeWidth={2.5}
                            />
                          ) : null}
                          Pro
                        </span>
                      ) : row.status ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                            row.status === 'Not set' ||
                            row.status === 'Off' ||
                            row.status === 'Hidden'
                              ? 'bg-ink/5 text-ink/55'
                              : 'bg-success-100 text-success-800'
                          }`}
                        >
                          {row.status}
                        </span>
                      ) : null}
                    </>
                  );
                  const shellClass = `rounded-xl border bg-white transition-colors ${
                    isActive ? 'border-amber-400 ring-2 ring-amber-200' : 'border-ink/10'
                  }`;

                  // Rows WITH an inline panel expand in place (PR-3); rows
                  // without one still deep-link to the editor that owns them.
                  if (row.panel) {
                    return (
                      <div key={row.key} id={`rail-row-${row.key}`} className={shellClass}>
                        <button
                          type="button"
                          onMouseEnter={() => scrollPreviewTo(row.anchor)}
                          onClick={() => {
                            setActiveRow(row.key);
                            setOpenPanel(isOpen ? null : row.key);
                            scrollPreviewTo(row.anchor);
                          }}
                          aria-expanded={isOpen}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-cream/40"
                        >
                          {meta}
                          <ChevronRight
                            aria-hidden
                            className={`h-3.5 w-3.5 shrink-0 text-ink/30 transition-transform ${
                              isOpen ? 'rotate-90' : ''
                            }`}
                            strokeWidth={2}
                          />
                        </button>
                        {isOpen ? row.panel : null}
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={row.key}
                      id={`rail-row-${row.key}`}
                      href={row.href}
                      onMouseEnter={() => scrollPreviewTo(row.anchor)}
                      onFocus={() => scrollPreviewTo(row.anchor)}
                      onClick={() => {
                        setActiveRow(row.key);
                        scrollPreviewTo(row.anchor);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2.5 ${shellClass} hover:border-ink/25`}
                    >
                      {meta}
                      <ExternalLink
                        aria-hidden
                        className="h-3 w-3 shrink-0 text-ink/30"
                        strokeWidth={2}
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {/* The umbrella unlock (PR-4) — shown only while the couple does NOT
              own Pro, so an owner's rail isn't nagged. One CTA for all seven. */}
          {showProCta ? (
            <div className="mt-2 rounded-2xl bg-ink px-4 py-3.5 text-cream">
              <p className="text-xs font-semibold text-cream">Website Pro</p>
              <p className="mt-0.5 text-[0.7rem] leading-relaxed text-cream/70">
                Seven upgrades, one unlock — Cinematic Reveal · Save-the-Date video ·
                Photo gallery · Background music · Editorial editing · Background color ·
                Button color. Also removes the “Powered by Setnayan” mark.
              </p>
              <Link
                href={proUnlockHref}
                className="mt-2.5 inline-flex items-center rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-amber-300"
              >
                Unlock Website Pro · ₱3,500
              </Link>
            </div>
          ) : null}
        </nav>

        {/* ── RIGHT PREVIEW ─────────────────────────────────────────── */}
        <main
          className={`min-w-0 flex-1 flex-col bg-cream-200/60 lg:flex ${
            mobilePane === 'preview' ? 'flex' : 'hidden'
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
            {PHASES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPhase(p.key)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  phase === p.key
                    ? 'border-ink bg-ink text-cream'
                    : 'border-ink/15 bg-white text-ink/60 hover:border-ink/30'
                }`}
              >
                {p.label}
              </button>
            ))}
            <span className="ml-auto hidden font-mono text-[0.6rem] uppercase tracking-[0.16em] text-ink/35 sm:inline">
              Live preview · tap a section to edit
            </span>
          </div>
          <div className="flex min-h-0 flex-1 justify-center px-4 pb-4">
            {previewSrc ? (
              <iframe
                ref={frameRef}
                key={`${phase}`}
                src={previewSrc}
                title="Your website preview"
                className="h-full w-full max-w-[430px] rounded-t-2xl border border-ink/10 bg-white shadow-lg"
              />
            ) : (
              <div className="flex h-full w-full max-w-[430px] items-center justify-center rounded-t-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center">
                <p className="text-sm text-ink/55">
                  Set your website address to see a live preview here.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
