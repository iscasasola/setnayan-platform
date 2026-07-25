'use client';

import { useEffect } from 'react';

/**
 * EditorBridge — the guest site's half of the unified-editor two-way sync
 * (Unified Website Editor · design 2026-07-25 · PR-1).
 *
 * Mounts ONLY when the site page resolved `editorMode === true`, which requires
 * BOTH `?editor=1` AND a server-verified host membership — the same fence the
 * `?phase=` preview override uses (app/[slug]/page.tsx). For guests and
 * anonymous visitors this component never renders, so their HTML is unchanged
 * byte-for-byte (the `anonymous-zero-guest` + site-body-plan goldens stay green).
 *
 * It deliberately does NOT need per-section markup: the site already stamps the
 * canonical anchors (`SITE_MENU_ANCHORS` → site-home / site-details / site-story
 * / site-gallery / site-me) and the widget sections carry ids. The bridge finds
 * those at runtime and decorates them, so site-body.tsx keeps ONE gated mount
 * instead of threading editor attributes through every branch.
 *
 * Protocol (both directions verify `event.origin === window.location.origin`;
 * the editor iframe is same-origin by construction):
 *   parent → frame  { source:'setnayan-editor', t:'scrollTo', key }
 *   frame  → parent { source:'setnayan-site',   t:'edit',     key }
 */

/** Section keys the editor rail can address, mapped to the DOM ids the site
 *  already renders. Keys the current phase doesn't render are simply absent —
 *  the bridge skips them (no dead anchors, mirroring the menu's present-flags). */
const SECTION_IDS: Record<string, string> = {
  home: 'site-home',
  hero: 'site-home',
  details: 'site-details',
  story: 'site-story',
  gallery: 'site-gallery',
  me: 'site-me',
};

const EDIT_BADGE_CLASS = 'setnayan-editor-badge';

export function EditorBridge() {
  useEffect(() => {
    const origin = window.location.origin;
    const cleanups: Array<() => void> = [];

    // ── Decorate each present section with a click-to-edit affordance ───────
    for (const [key, id] of Object.entries(SECTION_IDS)) {
      const anchor = document.getElementById(id);
      if (!anchor) continue;
      // The anchors are often zero-height <span> markers; the editable region
      // is their nearest section-ish ancestor. Fall back to the anchor itself.
      const host =
        (anchor.closest('section, article, div[id]') as HTMLElement | null) ?? anchor;
      if (!host || host.dataset.setnayanEditorBound === '1') continue;
      host.dataset.setnayanEditorBound = '1';
      host.dataset.setnayanEditorKey = key;

      const previousPosition = host.style.position;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.style.cursor = 'pointer';

      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = EDIT_BADGE_CLASS;
      badge.textContent = '✎ Edit';
      badge.setAttribute('aria-label', `Edit this section`);
      badge.style.cssText = [
        'position:absolute',
        'top:8px',
        'right:10px',
        'z-index:40',
        'border:0',
        'border-radius:999px',
        'padding:4px 10px',
        'font:700 10px/1 ui-monospace,monospace',
        'letter-spacing:.1em',
        'text-transform:uppercase',
        'color:#7a5a20',
        'background:#f3e8cd',
        'box-shadow:0 1px 3px rgba(38,34,27,.18)',
        'cursor:pointer',
        'opacity:0',
        'transition:opacity .15s',
      ].join(';');

      const send = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        window.parent?.postMessage({ source: 'setnayan-site', t: 'edit', key }, origin);
      };
      const show = () => {
        badge.style.opacity = '1';
      };
      const hide = () => {
        badge.style.opacity = '0';
      };

      badge.addEventListener('click', send);
      host.addEventListener('click', send);
      host.addEventListener('mouseenter', show);
      host.addEventListener('mouseleave', hide);
      host.appendChild(badge);

      cleanups.push(() => {
        badge.removeEventListener('click', send);
        host.removeEventListener('click', send);
        host.removeEventListener('mouseenter', show);
        host.removeEventListener('mouseleave', hide);
        badge.remove();
        host.style.cursor = '';
        host.style.position = previousPosition;
        delete host.dataset.setnayanEditorBound;
        delete host.dataset.setnayanEditorKey;
      });
    }

    // ── parent → frame: scroll to a section the rail selected ───────────────
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as { source?: string; t?: string; key?: string } | null;
      if (!data || data.source !== 'setnayan-editor') return;
      if (data.t !== 'scrollTo' || typeof data.key !== 'string') return;
      const id = SECTION_IDS[data.key];
      if (!id) return;
      const anchor = document.getElementById(id);
      if (!anchor) return;
      const host =
        (anchor.closest('section, article, div[id]') as HTMLElement | null) ?? anchor;
      host.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight so the couple sees WHICH block they're editing.
      const prior = host.style.boxShadow;
      host.style.boxShadow = '0 0 0 3px rgba(168,128,47,.55)';
      window.setTimeout(() => {
        host.style.boxShadow = prior;
      }, 1400);
    };
    window.addEventListener('message', onMessage);
    cleanups.push(() => window.removeEventListener('message', onMessage));

    // Tell the parent the frame is ready (it may want to sync an initial row).
    window.parent?.postMessage({ source: 'setnayan-site', t: 'ready' }, origin);

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
