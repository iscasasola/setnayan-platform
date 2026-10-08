'use client';

import { useEffect, useState } from 'react';
import { RsvpOneAtATime } from './rsvp-one-at-a-time';
import { RSVP_BRIDGE_SOURCE, RSVP_SITE_SOURCE } from '@/lib/rsvp-stage-shared';

/**
 * 🗳 THE RSVP PAGES' HALF OF THE EDITOR BRIDGE — mounted ONLY in the Maker's
 * RSVP stage canvas (`?editor=1` from a VERIFIED host, on the SAMPLE guest —
 * `invite/reply` and `invite/enter` decide that on the server). A guest's page
 * never renders it, so their HTML is unchanged.
 *
 * ⚡ EVERY EDIT IS ON THE PAGE AT ONCE (owner 2026-09-30: *"make sure what we
 * rebuild is fast and realtime and changes instantly"*). The Maker posts the
 * editor bridge's own `words` message for text (`{ t:'words', key, text }`,
 * the same shape `editor-bridge.tsx` takes for a scene's words) and
 * `{ t:'rsvpAsk', ask, oneAtATime }` for the form's switches; this lays them on
 * the page the server already drew — nothing is fetched, nothing reloads:
 *
 *   · `[data-rsvp-word="rsvp:<key>"]` takes the text; an empty text puts back
 *     the page's own words (`data-rsvp-default`), and an optional line
 *     (`data-rsvp-word-optional`, a message) hides while it is empty;
 *   · `[data-rsvp-ask="<field>"]` shows or hides with its switch (the canvas
 *     draws every question — `rsvp-widget.tsx` `canvasAsk`);
 *   · "one question at a time" turns the walker on or off
 *     (`RsvpOneAtATimeLive` below), and re-measures its steps on a switch.
 *
 * Frame → Maker: `{ t:'rsvpReady' }` once mounted (the Maker then re-sends what
 * it holds, so a frame that loaded an older draft still shows the newest), and
 * `{ t:'rsvpEdit', key }` when a word is tapped (its field opens on the right).
 *
 * 🔒 A SAMPLE SENDS NOTHING. On the canvas a submit is stopped before React
 * reads it, and a link does not navigate — the couple is looking at the page,
 * not replying for somebody.
 */
export const RSVP_FRAME_ASK_EVENT = 'setnayan:rsvp-frame-ask';

/** The form's own fields — on the Maker's canvas they never take a tap, a press or a keystroke. */
const INERT_FIELDS = 'input, textarea, select, label, [role="checkbox"], [role="radio"], [role="switch"], [contenteditable="true"]';

export function RsvpCanvasBridge({ inertButtons = false }: { inertButtons?: boolean }) {
  useEffect(() => {
    const origin = window.location.origin;
    let lastAsk = '';
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      const d = e.data as { source?: string; t?: string; key?: unknown; text?: unknown; ask?: unknown; oneAtATime?: unknown } | null;
      if (!d || d.source !== RSVP_BRIDGE_SOURCE) return;
      if (d.t === 'words' && typeof d.key === 'string' && d.key.startsWith('rsvp:') && typeof d.text === 'string') {
        const text = d.text;
        /* `{name}` becomes the sample guest's name, as it will each guest's (`fillRsvpName`). */
        const named = (el: HTMLElement, t: string) =>
          el.dataset.rsvpName === undefined ? t : t.replace(/\{name\}/g, el.dataset.rsvpName).replace(/\s+([,.!?])/g, '$1').trim();
        document.querySelectorAll<HTMLElement>(`[data-rsvp-word="${CSS.escape(d.key)}"]`).forEach((el) => {
          const shown = named(el, text) || el.dataset.rsvpDefault || '';
          if (el.textContent !== shown) el.textContent = shown;
          if (el.hasAttribute('data-rsvp-word-optional')) el.hidden = shown === '';
        });
        /* A word drawn by a shared component (the door's own title): a hidden
           proxy names the key, the element and the page's own words. */
        document.querySelectorAll<HTMLElement>(`[data-rsvp-word-proxy="${CSS.escape(d.key)}"]`).forEach((proxy) => {
          const el = proxy.dataset.rsvpTarget ? document.querySelector<HTMLElement>(proxy.dataset.rsvpTarget) : null;
          const shown = named(proxy, text) || proxy.dataset.rsvpDefault || '';
          if (el && shown && el.textContent !== shown) el.textContent = shown;
        });
        return;
      }
      if (d.t === 'rsvpAsk' && d.ask && typeof d.ask === 'object') {
        const ask = d.ask as Record<string, unknown>;
        document.querySelectorAll<HTMLElement>('[data-rsvp-ask]').forEach((el) => {
          const field = el.dataset.rsvpAsk;
          if (field && typeof ask[field] === 'boolean') el.hidden = !ask[field];
        });
        const key = JSON.stringify([ask, d.oneAtATime === true]);
        if (key === lastAsk) return;
        lastAsk = key;
        window.dispatchEvent(new CustomEvent(RSVP_FRAME_ASK_EVENT, { detail: { oneAtATime: d.oneAtATime === true } }));
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const word = target?.closest<HTMLElement>('[data-rsvp-word]');
      const proxied = Array.from(document.querySelectorAll<HTMLElement>('[data-rsvp-word-proxy]')).find((p) => {
        const el = p.dataset.rsvpTarget ? document.querySelector(p.dataset.rsvpTarget) : null;
        return Boolean(el && target && el.contains(target));
      });
      const key = word?.dataset.rsvpWord ?? proxied?.dataset.rsvpWordProxy;
      if (key) window.parent.postMessage({ source: RSVP_SITE_SOURCE, t: 'rsvpEdit', key }, origin);
      if (target?.closest('a[href]')) e.preventDefault();
      /* The thank-you's buttons (save to an account, save a ticket) would act
         for real — on the sample they do nothing. The form's own buttons stay
         live, so one-question mode can be walked. */
      if (inertButtons && target?.closest('button')) {
        e.preventDefault();
        e.stopPropagation();
      }
      /* 🔒 The couple is LOOKING at the form, never filling it in (owner 2026-10-07: "it is the actual RSVP not an
         editing way"): a tick, a choice or a field never takes the tap. */
      if (target?.closest(INERT_FIELDS)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    /* …nor the press that would focus a field and raise a keyboard. */
    const onDown = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(INERT_FIELDS)) e.preventDefault();
    };
    const onKey = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(INERT_FIELDS)) e.preventDefault();
    };
    const onSubmit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('beforeinput', onKey, true);
    window.addEventListener('submit', onSubmit, true);
    if (window.parent !== window) window.parent.postMessage({ source: RSVP_SITE_SOURCE, t: 'rsvpReady' }, origin);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('beforeinput', onKey, true);
      window.removeEventListener('submit', onSubmit, true);
    };
  }, [inertButtons]);
  return null;
}

/**
 * "Ask one question at a time", LIVE on the canvas: the walker as the couple's
 * switch says, starting from what the server drew. A switch that changes which
 * questions are asked re-mounts it, so it re-measures its steps (it counts only
 * the ones drawn) and starts again from the first.
 */
export function RsvpOneAtATimeLive({ initial }: { initial: boolean }) {
  const [state, setState] = useState({ on: initial, n: 0 });
  useEffect(() => {
    const onAsk = (e: Event) => {
      const on = (e as CustomEvent<{ oneAtATime: boolean }>).detail?.oneAtATime === true;
      setState((s) => ({ on, n: s.n + 1 }));
    };
    window.addEventListener(RSVP_FRAME_ASK_EVENT, onAsk);
    return () => window.removeEventListener(RSVP_FRAME_ASK_EVENT, onAsk);
  }, []);
  return state.on ? <RsvpOneAtATime key={state.n} /> : null;
}
