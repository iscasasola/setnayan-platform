'use client';

/**
 * THE OPEN-UP LAYER — Post Event's new family of scenes (Event Hub Maker
 * Phase 8, `prototypes/post_event_auto_story_2026-09-25.html` "OPEN-UP SCENES").
 *
 * A preview sits in the flow of the story; a tap opens the scene FULL SCREEN
 * over the same scroll position, and closing returns to exactly that scene:
 *
 *   · focus is trapped inside the layer and returns to the preview on close
 *     (`useModalA11y` — the one shared focus hook, not a second one);
 *   · Esc or ✕ closes it;
 *   · it lives at a URL hash (`#open-gallery` …, `lib/post-event-scenes.ts`),
 *     so the phone's Back closes it instead of leaving the story, and a shared
 *     link with the hash opens straight into it;
 *   · the reader's scroll position is put back exactly where it was.
 *
 * The four bodies are the SHIPPED parts, server-rendered and handed in as
 * `children` — the gallery, the film, "Were you there?" and the wishes. This
 * layer draws only the frame around them.
 *
 * 🛍 NOTHING HERE SELLS. The layer has no price and no call to buy, so it
 * renders unchanged in the app-store shell (`lib/store-shell.ts`).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { openUpFromHash, openUpHash, type OpenUpKind } from '@/lib/post-event-scenes';

export function OpenUpScene({
  kind,
  title,
  eyebrow,
  openLabel,
  preview,
  children,
  id,
  className = '',
}: {
  kind: OpenUpKind;
  /** The layer's heading — the scene's name ("From the Day"). */
  title: string;
  eyebrow?: string;
  /** What the preview's button says ("Open the gallery"). */
  openLabel: string;
  /** The template preview, drawn in the flow. */
  preview: ReactNode;
  /** The shipped component, mounted in the layer. */
  children: ReactNode;
  /** An anchor id the page already aims at (the Gallery tab, the colophon's film link). */
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pushed = useRef(false);
  const scrollY = useRef(0);
  const layerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = `open-up-${kind}-title`;

  /* The hash is the truth: Back, a shared link and the ✕ all go through it. */
  useEffect(() => {
    const sync = () => {
      const want = openUpFromHash(window.location.hash) === kind;
      setOpen((was) => {
        if (want && !was) scrollY.current = window.scrollY;
        return want;
      });
      if (!want) pushed.current = false;
    };
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, [kind]);

  /* Closing puts the reader back on the same scene — the same pixel. */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    // A "jump to that minute" link inside the layer closed it by moving the
    // hash to another anchor: go THERE, not back to where the reader was.
    const jump = window.location.hash.slice(1);
    const target = jump && !openUpFromHash(window.location.hash) ? document.getElementById(jump) : null;
    const y = scrollY.current;
    window.requestAnimationFrame(() => {
      if (target) target.scrollIntoView({ block: 'start' });
      else window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    });
  }, [open]);

  const openLayer = () => {
    scrollY.current = window.scrollY;
    const url = `${window.location.pathname}${window.location.search}${openUpHash(kind)}`;
    window.history.pushState({ openUp: kind }, '', url);
    pushed.current = true;
    setOpen(true);
  };

  const close = useCallback(() => {
    if (pushed.current) {
      // We added the entry — stepping back removes it, so Back never lands here twice.
      window.history.back();
      return;
    }
    // Arrived with the hash (a shared link): drop it without leaving the story.
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    setOpen(false);
  }, []);

  useModalA11y({ open, onClose: close, containerRef: layerRef, initialFocusRef: closeRef });

  return (
    <div id={id} data-post-event-scene={kind} className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={openLayer}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={openLabel}
        className="group block w-full cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-terracotta"
      >
        {preview}
        <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-terracotta-700 group-hover:underline">
          {openLabel} <span aria-hidden>↗</span>
        </span>
      </button>

      {/* 🪤 PORTALLED TO <body>. On this page a `transform` on an ancestor (the
          chapter reveal) becomes the containing block of a `position: fixed`
          child, and the page's `view-transition-name` traps z-index — measured
          on /[slug] 2026-09-20 (the RSVP half sheet). A sibling of <body> can
          be neither. */}
      {open && typeof document !== 'undefined'
        ? createPortal(
        <div
          ref={layerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-open-up-layer={kind}
          className="fixed inset-0 z-[90] flex flex-col bg-cream text-ink"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-ink/10 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">{eyebrow}</p>
              ) : null}
              <h2 id={titleId} className="truncate font-serif text-2xl leading-tight text-ink">
                {title}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Back to the story"
              title="Back to the story (Esc)"
              className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X aria-hidden className="h-5 w-5" strokeWidth={2} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
            <p className="mx-auto mt-10 max-w-5xl text-center">
              <button
                type="button"
                onClick={close}
                className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink/60 underline-offset-4 hover:underline"
              >
                Back to the story
              </button>
            </p>
          </div>
        </div>,
          document.body,
        )
        : null}
    </div>
  );
}

/**
 * The gallery's reader tabs (owner 2026-09-25): a guest reads Yours /
 * Everyone's, a stranger reads what is shared with everyone, the couple reads
 * everything. The tab SET is decided on the server (`galleryTabsFor`); this
 * only switches between bodies that were already allowed to render.
 */
export function OpenUpTabs({
  tabs,
}: {
  tabs: ReadonlyArray<{ key: string; label: string; count: number | null; node: ReactNode }>;
}) {
  const [on, setOn] = useState(tabs[0]?.key ?? '');
  if (tabs.length === 0) return null;
  const current = tabs.find((t) => t.key === on) ?? tabs[0]!;
  return (
    <div>
      <div role="tablist" aria-label="Whose photos" className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`open-up-tab-${t.key}`}
            aria-selected={t.key === current.key}
            aria-controls={`open-up-panel-${t.key}`}
            onClick={() => setOn(t.key)}
            className={`sn-press inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
              t.key === current.key ? 'bg-ink text-cream' : 'bg-ink/5 text-ink/75 hover:bg-ink/10'
            }`}
          >
            {t.label}
            {t.count !== null ? <span className="font-mono text-xs opacity-70">{t.count.toLocaleString('en-PH')}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`open-up-panel-${current.key}`} aria-labelledby={`open-up-tab-${current.key}`}>
        {current.node}
      </div>
    </div>
  );
}
