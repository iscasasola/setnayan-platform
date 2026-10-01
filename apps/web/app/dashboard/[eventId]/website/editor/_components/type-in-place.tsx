'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EyeOff, Eye, Check } from 'lucide-react';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { canvasFingerprint, canvasWriteKey, draftedCanvasOr, noteDraftedCanvas } from '@/lib/maker-draft-store';
import { announceMakerSave } from '@/lib/maker-save-status';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { HUB_ELEMENT_LABEL, withElementChoice, type HubElementKey } from '@/lib/element-style';
import { HUB_FORMAT_DEFAULT } from '@/lib/hub-date-formats';
import { formatChoices, formatWords, isTypeCaretPart, withTypedFormat, withTypedWords, wordingLines } from '@/lib/type-in-place';
import { PickMenu } from './pick-menu';
import { elementPreview, refusedChoiceWords } from './element-preview';
import type { ElementDraftAction } from './element-sheet';
import type { TypeStart } from '@/lib/hub-part-words';

/**
 * ✍ THE TYPE BAR — the small floating bar over the words being typed (Maker
 * core part 2; `prototypes/maker_in_four_2026-09-30_fable.html` frames B · C ·
 * H): **Wording ▾ · Format ▾ · Style ▾ · Hide**, and on a phone **Done**.
 *
 *   · Wording ▾ — what the part says: the lines that already exist for it
 *     (`wordingLines`), the page's own first. One PickMenu, never pills.
 *   · Format ▾ — the date and the time only: how the fact is written, every
 *     choice shown in the couple's own date (`formatChoices`).
 *   · Style ▾ — size · font · colour · alignment: the part's own sheet, the
 *     shipped `ElementSheet`, opened on the same part (and the letters
 *     selected in it). Not a second style editor.
 *   · Hide — the part's own show/hide (Arrange's), ghosted on the canvas.
 *
 * ⚡ INSTANT BY DESIGN (DECISION_LOG "EVERYTHING REBUILT IN THE MAKER IS
 * INSTANT BY DESIGN"). The words are typed INTO the canvas, so they are on the
 * page at the keystroke; this bar only writes them — the scene's WHOLE canvas,
 * built on the Maker's own copy (`draftedCanvasOr`), sent after a pause as ONE
 * write (`makerLatestWrite`, the element sheet's own queue and key, so the two
 * never race), `held` (no Maker render, no canvas reload — the Apply count
 * comes back with the save). A refused write puts the words back on the page,
 * on the Maker's copy and in the hold, and says what did not save.
 *
 * 👂 IT HEARS THE CANVAS ITSELF. The Maker's shell only keeps the tap that
 * began typing (`type` start — `readTypeStart`) and mounts this bar, which
 * loads with the Details pieces on that first tap, never with the Maker; from
 * then on every keystroke is heard HERE, so a letter re-renders this bar and
 * never the whole Maker. On mount it asks the canvas for the words as they are
 * now (`typeSync`), so letters typed while it loaded are not lost. It closes
 * on Done (phone), Esc, a tap outside it and its lists, a tap on another part
 * or scene, and Style ▾ (the part's own sheet takes over).
 */
type TypeSession = TypeStart;
async function saveCanvas(draftAction: ElementDraftAction, eventId: string, canvas: HubSectionCanvas) {
  const fd = new FormData();
  fd.set('intent', 'save');
  fd.set('patch', JSON.stringify({ widgets: { hero: { canvas } } }));
  fd.set(HUB_DRAFT_BAR_FIELD, '1');
  return draftAction(eventId, fd);
}

export type TypeBarProps = {
  eventId: string;
  /** The tap that began typing. */
  start: TypeStart;
  /** The hero's canvas as the last render drew it — the Maker's own copy is laid over it. */
  heroCanvas: HubSectionCanvas;
  draftAction: ElementDraftAction;
  twoPeople: boolean;
  /** The frames shown — the one typed in is found by its window, to sit the bar over its words. */
  frames: () => Array<HTMLIFrameElement | null>;
  /** To the frames shown (both panes), except the one the words were typed in. */
  post: (message: unknown, except?: MessageEventSource | null) => void;
  /** To every frame the Maker holds (warm stages too) — a pick is on every one. */
  broadcast: (message: unknown) => void;
  /** The canvas now shows this hero canvas — hold it through any render. */
  onSaving: (widgetType: string, canvas: HubSectionCanvas) => void;
  onStyle: () => void;
  onClose: () => void;
};

export function TypeBar(p: TypeBarProps) {
  const [session, setSession] = useState<TypeSession>(p.start);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const closeRef = useRef(p.onClose);
  closeRef.current = p.onClose;

  /* 👂 Every keystroke, scroll and blur of THIS part, from THIS frame. */
  useEffect(() => {
    const origin = window.location.origin;
    const from = p.start.source as Window | null;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== from) return;
      const d = event.data as Record<string, unknown> | null;
      if (!d || d.source !== 'setnayan-site') return;
      if (d.t === 'edit') {
        closeRef.current();
        return;
      }
      if (d.t !== 'type' || d.key !== p.start.key || d.el !== p.start.el || d.phase === 'start') return;
      setSession((s) => ({
        ...s,
        text: typeof d.text === 'string' ? d.text : s.text,
        rect: (d.rect as TypeSession['rect'] | undefined) ?? s.rect,
        vw: typeof d.vw === 'number' && d.vw > 0 ? d.vw : s.vw,
      }));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    /* A tap outside the bar and outside a list it opened closes it (a tap in
       the canvas is the canvas's own — `edit`, or a new `type`). */
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest?.('[data-type-bar], [role="listbox"]')) closeRef.current();
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    // Letters typed while this bar loaded: the canvas says the words as they are now.
    from?.postMessage({ source: 'setnayan-editor', t: 'typeSync' }, origin);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const el = session.el as HubElementKey;
  const [error, setError] = useState<string | null>(null);
  /** The canvas the draft last ACCEPTED — a refused write goes back here. */
  const saved = useRef<HubSectionCanvas>(draftedCanvasOr('hero', p.heroCanvas));
  const newest = useRef(0);
  const props = useRef(p);
  props.current = p;

  const words = (canvas: HubSectionCanvas) => canvas.elements?.[el]?.word ?? session.auto ?? '';

  /**
   * ⚡ ON THE CANVAS — every frame the Maker holds shows `next` now: the part's
   * words (or its fact in its format) and, when it changed, its show/hide.
   * `typedIn` is the frame the words were typed in: the browser already drew
   * them there, and writing them again would move the caret — so it is skipped.
   */
  const lay = (before: HubSectionCanvas, next: HubSectionCanvas, typedIn: MessageEventSource | null) => {
    const messages: unknown[] = [{ source: 'setnayan-editor', t: 'typeText', key: session.key, el, text: shownWords(next) }];
    if (Boolean(before.elements?.[el]?.hidden) !== Boolean(next.elements?.[el]?.hidden)) {
      messages.push(elementPreview(session.key, el, before, next, false));
    }
    for (const m of messages) {
      if (typedIn) props.current.post(m, typedIn);
      else props.current.broadcast(m);
    }
  };

  /** ONE write path for every change the bar makes: drawn on the canvas, on the Maker's copy, then saved behind. */
  const commit = (next: HubSectionCanvas, what: string, typedIn: MessageEventSource | null = null) => {
    const { heroCanvas, draftAction, eventId } = props.current;
    const before = draftedCanvasOr('hero', heroCanvas);
    if (canvasFingerprint(before) === canvasFingerprint(next)) return;
    lay(before, next, typedIn);
    noteDraftedCanvas('hero', next, heroCanvas);
    props.current.onSaving('hero', next);
    setError(null);
    const tap = ++newest.current;
    void (async () => {
      let res: HubDraftActionResult | typeof SUPERSEDED;
      try {
        res = await makerSave(
          () => makerLatestWrite(canvasWriteKey('hero'), () => saveCanvas(draftAction, eventId, next)),
          // Owed only if something else in the burst asked for a render (`makerNeedsRender`).
          requestMakerRefresh,
          { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
        );
      } catch {
        res = { ok: false, intent: 'save', error: '' };
      }
      if (res === SUPERSEDED) return;
      if (res.ok) {
        saved.current = next;
        return;
      }
      if (tap !== newest.current) return;
      /* ↩ Refused: the page, the Maker's copy and the hold go back — and it is said. */
      const back = saved.current;
      noteDraftedCanvas('hero', back, props.current.heroCanvas);
      props.current.onSaving('hero', back);
      lay(next, back, null);
      const text = refusedChoiceWords(el, what, res.error || null);
      setError(text);
      announceMakerSave({ state: 'error', text });
    })();
  };

  /** What the page shows for a canvas — the part's words, or its fact in its format. */
  const shownWords = (canvas: HubSectionCanvas): string => {
    if (el === 'date' || el === 'time') {
      return formatWords(el, canvas.elements?.[el]?.format ?? HUB_FORMAT_DEFAULT, session) ?? session.text;
    }
    return words(canvas);
  };

  /* ✍ EVERY KEYSTROKE (the canvas already shows it): the other pane gets the
     words, and the write waits for the pause. */
  const lastText = useRef(p.start.text);
  /* Words the sanitizer refused are on the page but not in the draft: when the
     bar goes, the page goes back to the words that ARE saved — never looking
     like success. */
  const refusedRef = useRef(false);
  useEffect(
    () => () => {
      if (!refusedRef.current) return;
      const back = draftedCanvasOr('hero', props.current.heroCanvas);
      props.current.broadcast({ source: 'setnayan-editor', t: 'typeText', key: p.start.key, el, text: words(back) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    if (!isTypeCaretPart(el) || session.text === lastText.current) return;
    lastText.current = session.text;
    const before = draftedCanvasOr('hero', props.current.heroCanvas);
    const { elements, refused } = withTypedWords(before.elements, el, session.text, session.auto);
    refusedRef.current = refused;
    if (refused) {
      setError(`${HUB_ELEMENT_LABEL[el]}: those words cannot be used here — keep it to one short line of words.`);
      return;
    }
    const next: HubSectionCanvas = { ...before };
    if (elements) next.elements = elements;
    else delete next.elements;
    commit(next, 'word', session.source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.text]);

  const current = draftedCanvasOr('hero', p.heroCanvas);
  const style = current.elements?.[el] ?? {};
  const lines = wordingLines(el, { auto: session.auto, twoPeople: p.twoPeople });
  const formats = formatChoices(el, session);

  const pickLine = (line: string) => {
    const before = draftedCanvasOr('hero', props.current.heroCanvas);
    const { elements } = withTypedWords(before.elements, el, line, session.auto);
    const next: HubSectionCanvas = { ...before };
    if (elements) next.elements = elements;
    else delete next.elements;
    lastText.current = line;
    commit(next, 'word');
  };
  const pickFormat = (format: string) => {
    const before = draftedCanvasOr('hero', props.current.heroCanvas);
    const elements = withTypedFormat(before.elements, el, format);
    const next: HubSectionCanvas = { ...before };
    if (elements) next.elements = elements;
    else delete next.elements;
    commit(next, 'format');
  };
  const toggleHidden = () => {
    const before = draftedCanvasOr('hero', props.current.heroCanvas);
    const elements = withElementChoice(before.elements, el, 'hidden', style.hidden ? null : true);
    const next: HubSectionCanvas = { ...before };
    if (elements) next.elements = elements;
    else delete next.elements;
    commit(next, 'hidden');
  };

  /* 📍 Over the words: above them, or under them when there is no room. */
  const bar = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  /* The Maker's own window moving (a phone's keyboard, a resize) moves the words on screen too. */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((n) => n + 1);
    const vv = window.visualViewport;
    window.addEventListener('resize', on);
    vv?.addEventListener('resize', on);
    vv?.addEventListener('scroll', on);
    return () => {
      window.removeEventListener('resize', on);
      vv?.removeEventListener('resize', on);
      vv?.removeEventListener('scroll', on);
    };
  }, []);
  const framesRef = useRef(p.frames);
  framesRef.current = p.frames;
  useLayoutEffect(() => {
    const f = framesRef.current().find((x) => x?.contentWindow && x.contentWindow === session.source) ?? null;
    const b = bar.current;
    if (!f || !b) return;
    const fr = f.getBoundingClientRect();
    const box = { left: fr.left, top: fr.top, scale: session.vw > 0 ? fr.width / session.vw : 1 };
    const vv = window.visualViewport;
    const vTop = vv?.offsetTop ?? 0;
    const vH = vv?.height ?? window.innerHeight;
    const w = b.offsetWidth;
    const h = b.offsetHeight;
    const r = session.rect;
    const partTop = box.top + r.top * box.scale;
    const partBottom = partTop + r.height * box.scale;
    let top = partTop - h - 8;
    if (top < vTop + 4) top = Math.min(partBottom + 8, vTop + vH - h - 4);
    const mid = box.left + (r.left + r.width / 2) * box.scale;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, mid - w / 2));
    setAt((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, [session.rect, session.vw, session.source, tick]);

  const phone = typeof window !== 'undefined' && window.innerWidth < 1024;
  /* Portalled to <body>: a glass ancestor (`backdrop-filter`) would become the
     box `position: fixed` is measured from (PickMenu's own rule). */
  return createPortal(
    <div
      ref={bar}
      role="toolbar"
      aria-label={`${HUB_ELEMENT_LABEL[el]} — words`}
      data-type-bar={el}
      style={at ? { top: at.top, left: at.left } : { top: -9999, left: 0 }}
      className="sn-glass-bare fixed z-[85] flex max-w-[calc(100vw-16px)] flex-wrap items-center gap-1 rounded-2xl px-1.5 py-1 shadow-[0_8px_24px_rgba(30,34,41,0.18)]"
    >
      {phone ? (
        <button
          type="button"
          onClick={p.onClose}
          className="sn-press inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-[13px] font-semibold text-ink"
        >
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Done
        </button>
      ) : null}
      {lines.length > 0 ? (
        <PickMenu
          label={`${HUB_ELEMENT_LABEL[el]} — wording`}
          dataAttr="data-type-wording"
          value={words(current) || null}
          buttonText="Wording"
          options={lines.map((line, i) => ({ key: line, label: line, ...(i === 0 ? { hint: 'Automatic' } : {}) }))}
          onPick={pickLine}
        />
      ) : null}
      {formats.length > 0 ? (
        <PickMenu
          label={`${HUB_ELEMENT_LABEL[el]} — format`}
          dataAttr="data-type-format"
          value={style.format ?? HUB_FORMAT_DEFAULT}
          buttonText="Format"
          options={formats}
          onPick={pickFormat}
        />
      ) : null}
      <button
        type="button"
        data-type-style=""
        onClick={p.onStyle}
        className="sn-press inline-flex min-h-11 items-center rounded-xl px-3 text-[13px] font-semibold text-ink hover:bg-ink/5"
      >
        Style ▾
      </button>
      <button
        type="button"
        data-type-hide={style.hidden ? 'hidden' : 'shown'}
        aria-pressed={Boolean(style.hidden)}
        onClick={toggleHidden}
        className="sn-press inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-[13px] font-semibold text-ink hover:bg-ink/5"
      >
        {style.hidden ? <Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} /> : <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        {style.hidden ? 'Show' : 'Hide'}
      </button>
      {error ? (
        <p role="alert" className="basis-full px-2 pb-1 text-[12px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
