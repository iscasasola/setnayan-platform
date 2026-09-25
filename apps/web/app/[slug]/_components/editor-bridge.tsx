'use client';

import { useEffect } from 'react';

/**
 * EditorBridge — the guest site's half of the unified-editor two-way sync
 * (Unified Website Editor · design 2026-07-25 · PR-1).
 *
 * Mounts ONLY in the Maker's canvas: `?editor=1` AND a server-verified host
 * membership (`isEditorCanvas && editorBridge`, app/[slug]/page.tsx). For guests
 * and anonymous visitors this component never renders, so their HTML is
 * unchanged byte-for-byte.
 *
 * Protocol (both directions verify `event.origin === window.location.origin`;
 * the editor iframe is same-origin by construction):
 *   parent → frame  { source:'setnayan-editor', t:'scrollTo', key }
 *   parent → frame  { source:'setnayan-editor', t:'play',     key }
 *   frame  → parent { source:'setnayan-site',   t:'edit',     key }
 *   frame  → parent { source:'setnayan-site',   t:'ready',    order }
 *
 * 🧭 KEYS. The navigator's keys (`lib/maker-scene-list.ts`): `f:hero`,
 * `f:film`, `f:editorial`, `f:entourage`, `f:story` and `w:<widget_type>`.
 * `site-body.tsx` stamps a hidden `[data-maker-section]` marker immediately
 * before each section in the canvas; the section is the marker's next element
 * sibling. The entourage and the story already carry their own ids. The
 * legacy row keys (`home`, `details`, `story`, …) still resolve through
 * `SECTION_IDS` for the rows that name them.
 */

/** Legacy row keys → the DOM ids the site already renders. */
const SECTION_IDS: Record<string, string> = {
  home: 'site-home',
  hero: 'site-home',
  details: 'site-details',
  story: 'site-story',
  gallery: 'site-gallery',
  me: 'site-me',
  'f:entourage': 'site-entourage',
  'f:story': 'site-story',
};

/** The section a marker stands in front of: its next element that is not a marker. */
function sectionAfter(marker: Element): HTMLElement | null {
  const next = marker.nextElementSibling;
  if (!next || next.hasAttribute('data-maker-section')) return null;
  return next as HTMLElement;
}

/** The element a navigator key points at, or null when this stage draws none. */
export function findMakerSection(doc: Document, key: string): HTMLElement | null {
  const marker = doc.querySelector(`[data-maker-section="${CSS.escape(key)}"]`);
  if (marker) return sectionAfter(marker);
  const id = SECTION_IDS[key];
  if (!id) return null;
  const anchor = doc.getElementById(id);
  if (!anchor) return null;
  // A zero-height anchor marks a region; the region is its nearest section-ish ancestor.
  if (anchor.offsetHeight > 0) return anchor;
  return (anchor.closest('section, article, div[id]') as HTMLElement | null) ?? anchor;
}

/** Every section the canvas actually DREW, in page order — the navigator must equal this. */
export function drawnMakerOrder(doc: Document): string[] {
  const keys: string[] = [];
  const nodes = doc.querySelectorAll('[data-maker-section], #site-entourage, #site-story');
  nodes.forEach((n) => {
    if (n.hasAttribute('data-maker-section')) {
      const el = sectionAfter(n);
      if (el && el.getBoundingClientRect().height > 0) keys.push(n.getAttribute('data-maker-section')!);
    } else if (n.id === 'site-entourage' && (n as HTMLElement).offsetHeight > 0) {
      keys.push('f:entourage');
    } else if (n.id === 'site-story' && (n as HTMLElement).offsetHeight > 0) {
      keys.push('f:story');
    }
  });
  return keys;
}

function flash(el: HTMLElement) {
  const prior = el.style.boxShadow;
  el.style.boxShadow = '0 0 0 3px rgba(168,128,47,.55)';
  window.setTimeout(() => {
    el.style.boxShadow = prior;
  }, 1400);
}

export function EditorBridge() {
  useEffect(() => {
    const origin = window.location.origin;
    const cleanups: Array<() => void> = [];

    // ── canvas → Maker: a tapped section selects its navigator tile ─────────
    const bind = (el: HTMLElement, key: string) => {
      if (el.dataset.setnayanEditorBound === '1') return;
      el.dataset.setnayanEditorBound = '1';
      const prevCursor = el.style.cursor;
      el.style.cursor = 'pointer';
      const send = (e: Event) => {
        /*
          📖 AN OPEN-UP SCENE (Maker Phase 8) OPENS IN THE CANVAS TOO. Its
          trigger goes nowhere — it lays the scene full screen over this same
          page, and ✕ / Esc / Back return — so the couple can check it where
          they edit it. The tile is still selected: by the NEAREST bound
          section only (an enclosing one — the whole story — must not take the
          selection back), and the event is left to bubble, because React
          listens at the root and a stopped click would never open anything.
        */
        const trigger = (e.target as Element | null)?.closest?.('[data-open-up-trigger]');
        if (trigger) {
          if (trigger.closest('[data-setnayan-editor-bound="1"]') === el) {
            window.parent?.postMessage({ source: 'setnayan-site', t: 'edit', key }, origin);
          }
          return;
        }
        // A link or button inside the section keeps its own job; the canvas
        // never follows it anywhere (see maker-canvas-guard.tsx).
        e.preventDefault();
        e.stopPropagation();
        window.parent?.postMessage({ source: 'setnayan-site', t: 'edit', key }, origin);
      };
      el.addEventListener('click', send);
      cleanups.push(() => {
        el.removeEventListener('click', send);
        el.style.cursor = prevCursor;
        delete el.dataset.setnayanEditorBound;
      });
    };
    document.querySelectorAll('[data-maker-section]').forEach((m) => {
      const el = sectionAfter(m);
      if (el) bind(el, m.getAttribute('data-maker-section')!);
    });
    for (const key of ['f:entourage', 'f:story']) {
      const el = findMakerSection(document, key);
      if (el) bind(el, key);
    }
    // The legacy rows (details, …) — bubbling from a section above stops first.
    for (const key of ['home', 'details', 'gallery', 'me']) {
      const el = findMakerSection(document, key);
      if (el) bind(el, key);
    }

    // ── Maker → canvas: scroll to a tile, or play its entrance in place ──────
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as { source?: string; t?: string; key?: string } | null;
      if (!data || data.source !== 'setnayan-editor' || typeof data.key !== 'string') return;
      const el = findMakerSection(document, data.key);
      if (!el) return;
      if (data.t === 'scrollTo') {
        el.scrollIntoView({ behavior: 'smooth', block: el.offsetHeight > window.innerHeight * 0.8 ? 'start' : 'center' });
        flash(el);
      } else if (data.t === 'play') {
        // ▶ PLAY THIS SCENE — in place, in the canvas: bring it into view, then
        // replay its entrance and let it come to rest. Reduced motion: a flash.
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce || typeof el.animate !== 'function') {
          flash(el);
          return;
        }
        el.animate(
          [
            { opacity: 0, transform: 'translateY(22px) scale(.985)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)' },
        );
      }
    };
    window.addEventListener('message', onMessage);
    cleanups.push(() => window.removeEventListener('message', onMessage));

    // Tell the parent the frame is ready, with the order it actually drew.
    window.parent?.postMessage({ source: 'setnayan-site', t: 'ready', order: drawnMakerOrder(document) }, origin);

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
