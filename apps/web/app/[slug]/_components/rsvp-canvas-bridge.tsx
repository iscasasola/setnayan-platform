'use client';

import { useEffect, useState } from 'react';
import { RsvpOneAtATime } from './rsvp-one-at-a-time';
import { RSVP_BRIDGE_SOURCE, RSVP_SITE_SOURCE } from '@/lib/rsvp-stage-shared';
import { makerStageMayType } from '@/lib/maker-stage-type';
import {
  RSVP_CANVAS_CONTROLS,
  RSVP_GROUND_MESSAGE,
  RSVP_PICKED_MESSAGE,
  RSVP_PICK_MESSAGE,
  RSVP_TOP_MESSAGE,
  RSVP_TYPED_MESSAGE,
  RSVP_TYPE_STOP_MESSAGE,
  RSVP_TYPING_MESSAGE,
  createRsvpCanvasTop,
  rsvpPartOfTap,
  rsvpTypedText,
  rsvpWordIsTyped,
  stampRsvpCanvas,
  type RsvpTapPart,
} from './rsvp-canvas-parts';

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
 * it holds, so a frame that loaded an older draft still shows the newest).
 *
 * 🧩 EVERY PIECE IS A PART THE COUPLE PICKS (owner 2026-10-07/08: *"RSVP cannot
 * select anything"* · *"it is the actual RSVP not an editing way"*). A tap on the
 * page is never the form's: it PICKS the part under it and says so
 * (`{ t:'rsvpPick', key, el }` — the pair the Event Hub canvas posts with its
 * `edit`, under the RSVP stage's own name: `rsvp-canvas-parts.ts` says why), and
 * a tap on the page's ground lets the part go (`rsvpGround`). The masthead's
 * parts are named here, on the canvas only (`stampRsvpCanvas`).
 *
 * ⌨ TYPING IS A SECOND TAP (DECISION_LOG 2026-10-07 rule 1; `makerStageMayType`,
 * the Event Hub canvas's own gate): the Maker says which part is picked
 * (`rsvpPicked`); a tap on the words of THAT part puts the caret in them, here,
 * in the tap itself, and every keystroke is told (`rsvpType`) — the RSVP panel
 * saves it to the draft, the same value its own box holds. A first tap only picks.
 *
 * 🔝 A screen its tab just opened starts at the top and stays there
 * (`rsvpTop`, `createRsvpCanvasTop`).
 *
 * 🔒 A SAMPLE SENDS NOTHING. On the canvas a submit is stopped before React
 * reads it, no link navigates, no field takes a tap, a press or a keystroke —
 * the couple is editing the page, not replying for somebody.
 */
export const RSVP_FRAME_ASK_EVENT = 'setnayan:rsvp-frame-ask';

/** The form's own fields — on the Maker's canvas they never take a tap, a press or a keystroke. */
const INERT_FIELDS = 'input, textarea, select, label, [role="checkbox"], [role="radio"], [role="switch"], [contenteditable="true"]';

export function RsvpCanvasBridge() {
  useEffect(() => {
    const origin = window.location.origin;
    let lastAsk = '';
    const toMaker = (message: Record<string, unknown>) => {
      if (window.parent !== window) window.parent.postMessage({ source: RSVP_SITE_SOURCE, ...message }, origin);
    };
    /* 🏷 The masthead's parts, named for the canvas (nothing a guest is served). */
    stampRsvpCanvas(document);
    /* 🔒 No control of the sample page can take focus or be pressed (`inert`) — the ones the page drew, and any it
       draws later (the one-question walker's own buttons). */
    const lock = () => document.querySelectorAll(RSVP_CANVAS_CONTROLS).forEach((c) => c.setAttribute('inert', ''));
    lock();
    const locker = new MutationObserver(lock);
    locker.observe(document.body, { childList: true, subtree: true });
    const pageTop = createRsvpCanvasTop(window);
    /** The part the Maker has picked (`<canvas>|<el>`) — a tap on ITS words types. */
    let picked: string | null = null;
    /** The couple's words as the Maker last sent them (`{name}` still in them), by word. */
    const own = new Map<string, string>();
    /** The words under the caret now. */
    let typing: { el: HTMLElement; word: string; part: RsvpTapPart; sent: string | null; off: () => void } | null = null;
    /* `{name}` becomes the sample guest's name, as it will each guest's (`fillRsvpName`). */
    const named = (el: HTMLElement, t: string) =>
      el.dataset.rsvpName === undefined ? t : t.replace(/\{name\}/g, el.dataset.rsvpName).replace(/\s+([,.!?])/g, '$1').trim();
    const draw = (el: HTMLElement, text: string) => {
      const shown = named(el, text) || el.dataset.rsvpDefault || '';
      if (el.textContent !== shown) el.textContent = shown;
      if (el.hasAttribute('data-rsvp-word-optional')) el.hidden = shown === '';
    };
    /** Leave the words: they are drawn as a guest reads them again (`{name}` filled, the page's own when empty). */
    const stopTyping = () => {
      const t = typing;
      if (!t) return;
      typing = null;
      t.off();
      t.el.removeAttribute('contenteditable');
      draw(t.el, t.sent ?? own.get(t.word) ?? '');
      toMaker({ t: RSVP_TYPING_MESSAGE, phase: 'end', key: t.part.key, word: t.word });
    };
    const beginTyping = (el: HTMLElement, word: string, part: RsvpTapPart) => {
      stopTyping();
      /* The couple's own words go under the caret as THEY wrote them — `{name}` is typed as `{name}`. */
      const theirs = own.get(word);
      if (theirs && el.textContent !== theirs) el.textContent = theirs;
      el.setAttribute('contenteditable', 'plaintext-only');
      if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
      const session = { el, word, part, sent: null as string | null, off: () => {} };
      const onInput = () => {
        session.sent = rsvpTypedText(el.textContent);
        toMaker({ t: RSVP_TYPED_MESSAGE, key: word, text: session.sent });
      };
      const onLeave = (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== 'Escape') return;
        e.preventDefault();
        el.blur();
      };
      const onPaste = (e: ClipboardEvent) => {
        e.preventDefault();
        document.execCommand('insertText', false, rsvpTypedText(e.clipboardData?.getData('text/plain')));
      };
      const onBlur = () => stopTyping();
      el.addEventListener('input', onInput);
      el.addEventListener('keydown', onLeave);
      el.addEventListener('paste', onPaste);
      el.addEventListener('blur', onBlur);
      session.off = () => {
        el.removeEventListener('input', onInput);
        el.removeEventListener('keydown', onLeave);
        el.removeEventListener('paste', onPaste);
        el.removeEventListener('blur', onBlur);
      };
      typing = session;
      /* In the tap itself — a phone raises its keyboard only for a focus made in the gesture. */
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      toMaker({ t: RSVP_TYPING_MESSAGE, phase: 'start', key: part.key, word });
    };
    const inTyping = (target: Element | null) => Boolean(typing && target && typing.el.contains(target));
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      const d = e.data as { source?: string; t?: string; key?: unknown; text?: unknown; ask?: unknown; oneAtATime?: unknown; picked?: unknown } | null;
      if (!d || d.source !== RSVP_BRIDGE_SOURCE) return;
      if (d.t === RSVP_PICKED_MESSAGE) {
        picked = typeof d.picked === 'string' && d.picked ? d.picked : null;
        /* The Maker may bring the picked part into view — the page is the couple's again. */
        pageTop.onPicked(picked);
        return;
      }
      if (d.t === RSVP_TOP_MESSAGE) {
        stopTyping();
        pageTop.open();
        return;
      }
      if (d.t === RSVP_TYPE_STOP_MESSAGE) {
        stopTyping();
        return;
      }
      if (d.t === 'words' && typeof d.key === 'string' && d.key.startsWith('rsvp:') && typeof d.text === 'string') {
        const text = d.text;
        own.set(d.key, text);
        document.querySelectorAll<HTMLElement>(`[data-rsvp-word="${CSS.escape(d.key)}"]`).forEach((el) => {
          /* ⌨ The words under the caret are the couple's own keystrokes — never redrawn under them. */
          if (typing?.el === el) return;
          draw(el, text);
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
      /* ⌨ A tap inside the words being typed only moves the caret (it never ticks the answer they sit in). */
      if (inTyping(target)) {
        e.preventDefault();
        return;
      }
      /* 🔒 THE TAP IS NEVER THE PAGE'S OWN (owner 2026-10-07: "it is the actual RSVP not an editing way"): no link
         navigates, no button acts (Send, Save my ticket, the one-question walker's Next — whose check would put
         the caret in a field), no tick, choice or field takes it. React never hears it. */
      e.preventDefault();
      e.stopPropagation();
      /* 🧩 …it PICKS the part under it. A tap on the page's ground lets the picked part go. */
      const part = rsvpPartOfTap(target);
      if (!part) {
        stopTyping();
        toMaker({ t: RSVP_GROUND_MESSAGE });
        return;
      }
      /* ⌨ A SECOND tap, on the words of the part already picked, types them — the caret goes in, here. */
      const wordEl = part.word ? (target?.closest<HTMLElement>('[data-rsvp-word]') ?? null) : null;
      if (wordEl && part.word && rsvpWordIsTyped(part.word) && makerStageMayType(picked, part.key, part.el)) {
        beginTyping(wordEl, part.word, part);
        return;
      }
      stopTyping();
      toMaker({ t: RSVP_PICK_MESSAGE, key: part.key, ...(part.el ? { el: part.el } : {}), ...(part.word ? { word: part.word } : {}), ...(part.line ? { line: part.line } : {}) });
    };
    /* …nor the press that would focus a field and raise a keyboard. */
    const onDown = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null;
      /* The couple's own touch: a screen its tab just opened is theirs to move again. */
      pageTop.onTouch();
      if (inTyping(target)) return;
      if (target?.closest(INERT_FIELDS)) e.preventDefault();
    };
    const onKey = (e: Event) => {
      const target = e.target instanceof Element ? e.target : null;
      if (inTyping(target)) return;
      if (target?.closest(INERT_FIELDS)) e.preventDefault();
    };
    const onScroll = () => {
      pageTop.onScroll();
    };
    const onWheel = () => pageTop.onTouch();
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
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    toMaker({ t: 'rsvpReady' });
    return () => {
      stopTyping();
      locker.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('beforeinput', onKey, true);
      window.removeEventListener('submit', onSubmit, true);
    };
  }, []);
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
