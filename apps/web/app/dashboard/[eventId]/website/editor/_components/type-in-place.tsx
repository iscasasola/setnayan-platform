'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EyeOff, Eye, Check } from 'lucide-react';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { canvasFingerprint, canvasWriteKey, draftedCanvasOr, draftedOwnWordsOr, noteDraftedCanvas, noteDraftedOwnWords } from '@/lib/maker-draft-store';
import { announceMakerSave } from '@/lib/maker-save-status';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult, HubDraftPatch } from '@/lib/hub-draft';
import { HUB_ELEMENT_LABEL, withElementChoice, type HubElementKey } from '@/lib/element-style';
import { HUB_FORMAT_DEFAULT } from '@/lib/hub-date-formats';
import { formatChoices, formatWords, isTypeCaretPart, withTypedFormat, withTypedWords, wordingLines } from '@/lib/type-in-place';
import { PickMenu } from './pick-menu';
import { IRow } from './inspector-kit';
import { elementPreview, refusedChoiceWords } from './element-preview';
import type { ElementDraftAction } from './element-sheet';
import type { TypeStart } from '@/lib/hub-part-words';
import { SCENE_FIELD_LABEL, sceneTypeWrite, type SceneOwnWords } from '@/lib/scene-type-words';
import { typedDisplayName } from '@/lib/typed-names';
import { nameStyleChoicesFor, type NameParts, type NameStyle } from '@/lib/name-style';
import { nameStyleDraftPatch } from '@/lib/name-style-save';
import { useMaker } from '../../../launch/_components/maker-context';
import { SP_KEY_BAR, SP_KEY_DONE } from '@/lib/maker-stage-room';

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
 *
 * ✍ THE NAMES (owner 2026-10-01, "wait for apply"). The names are the event's
 * own (`events.display_name`), not the hero's: typed here they go into the
 * DRAFT's `events` — the same draft, the same one write path, held the same
 * way — so guests read them only at Apply, and Undo takes them back. Their
 * Wording ▾ is the event's Name style (Full · Middle initial · Surname first),
 * each written in the couple's OWN name (`nameStyleChoicesFor`) — the ONE
 * setting the prints read, and a pick goes into the SAME draft
 * (`nameStyleDraftPatch`; owner 2026-10-01, "in event hub maker will only take
 * effect when pressed apply"), written to the prints' setting at Apply.
 *
 * ✍ EVERY SCENE, NOT ONLY THE HERO (two-week audit, Area B). A tap on a
 * scene's words the canvas marked (`markSceneWords` — the Special message, the
 * Reminders, a scene of their own's heading and words) opens this same bar,
 * with `start.field` naming the ONE place those words live
 * (`lib/scene-type-words.ts`): typed, they go into the DRAFT through the same
 * one write path (`write`), held, and reach guests at Apply. No Wording ▾ —
 * no line already exists for a couple's own words, and none is invented (✂ the
 * re-plan row) — and no Format ▾ (words, not a date). Style ▾ opens that
 * part's own sheet; Hide is that part's own show/hide on its scene's canvas.
 */
type TypeSession = TypeStart;
/** The fields this bar writes on a part — a refusal puts back only these. */
const TYPE_BAR_FIELDS = ['word', 'format', 'hidden'] as const;
/** `now`, with `el`'s own fields (`TYPE_BAR_FIELDS`) as `from` has them. */
function withOwnFieldsFrom(now: HubSectionCanvas, from: HubSectionCanvas, el: HubElementKey): HubSectionCanvas {
  const part: Record<string, unknown> = { ...(now.elements?.[el] ?? {}) };
  const was = (from.elements?.[el] ?? {}) as Record<string, unknown>;
  for (const f of TYPE_BAR_FIELDS) {
    if (was[f] === undefined) delete part[f];
    else part[f] = was[f];
  }
  const elements = { ...(now.elements ?? {}) } as Record<string, unknown>;
  if (Object.keys(part).length) elements[el] = part;
  else delete elements[el];
  const next: HubSectionCanvas = { ...now };
  if (Object.keys(elements).length) next.elements = elements as HubSectionCanvas['elements'];
  else delete next.elements;
  return next;
}
/** The draft save every change the bar makes goes through — the hero's canvas, or the names. */
async function saveDraft(draftAction: ElementDraftAction, eventId: string, patch: HubDraftPatch) {
  const fd = new FormData();
  fd.set('intent', 'save');
  fd.set('patch', JSON.stringify(patch));
  fd.set(HUB_DRAFT_BAR_FIELD, '1');
  return draftAction(eventId, fd);
}
/** The names' own queue key — a burst of letters is ONE write, the latest. */
const NAMES_WRITE_KEY = 'event:display_name';
/** …and the Name style's — two quick picks are ONE write, the latest. */
const NAME_STYLE_WRITE_KEY = 'event:name-style';

export type TypeBarProps = {
  eventId: string;
  /** The tap that began typing. */
  start: TypeStart;
  /** The hero's canvas as the last render drew it — the Maker's own copy is laid over it. */
  heroCanvas: HubSectionCanvas;
  /** ✍ A scene's words: that scene's canvas as the last render drew it (its part's Hide). */
  sceneCanvas?: HubSectionCanvas;
  /** ✍ A scene of their own: its heading and words as the last render had them (the other half rides along). */
  ownWords?: SceneOwnWords | null;
  draftAction: ElementDraftAction;
  twoPeople: boolean;
  /** ✍ The names' Wording ▾: the event's Name style and one of the couple's own names (null = not offered). */
  names?: { style: NameStyle; person: NameParts | null } | null;
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
  /**
   * 🧰 A PHONE: no floating bar (owner 2026-10-05, the lower third approved —
   * one tap on a part opens ITS tools). The bar's rows are drawn INSIDE the
   * part's own Text tools, in `slot` (null while another tab is on — the bar
   * stays mounted, so every keystroke is still heard and written). Style is
   * the tools themselves, Hide is Arrange's row, Done is the column's ×.
   */
  inline?: { slot: HTMLElement | null } | null;
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
       the canvas is the canvas's own — `edit`, or a new `type`). Inline (a
       phone), the bar lives as long as the part's tools it sits in. */
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest?.('[data-type-bar], [role="listbox"]')) closeRef.current();
    };
    const inline = Boolean(p.inline);
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKey);
    if (!inline) window.addEventListener('pointerdown', onDown, true);
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
  /** ✍ A scene's words (not the hero's): the one field they are, and their scene's row. */
  const field = p.start.field ?? null;
  const sceneType = field ? p.start.key.slice(2) : null;
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
  const layMessages = (before: HubSectionCanvas, next: HubSectionCanvas): unknown[] => {
    const messages: unknown[] = [{ source: 'setnayan-editor', t: 'typeText', key: session.key, el, text: shownWords(next) }];
    if (Boolean(before.elements?.[el]?.hidden) !== Boolean(next.elements?.[el]?.hidden)) {
      messages.push(elementPreview(session.key, el, before, next, false));
    }
    return messages;
  };
  /** To every frame — or, when the words were typed in one, to every OTHER frame. */
  const postToCanvas = (messages: readonly unknown[], typedIn: MessageEventSource | null) => {
    for (const m of messages) {
      if (typedIn) props.current.post(m, typedIn);
      else props.current.broadcast(m);
    }
  };
  const lay = (before: HubSectionCanvas, next: HubSectionCanvas, typedIn: MessageEventSource | null) =>
    postToCanvas(layMessages(before, next), typedIn);

  /**
   * ONE write path for every change the bar makes: drawn on the canvas FIRST
   * (`shown` — every other frame; the one typed in already shows it), then
   * into the draft after a pause, `held` (no Maker render, no canvas reload;
   * the Apply count comes back with the save). The latest write for `key` wins.
   */
  const write = (
    key: string,
    patch: HubDraftPatch,
    shown: { messages: readonly unknown[]; typedIn: MessageEventSource | null },
    onSaved: () => void,
    onRefused: (reason: string) => void,
  ) => {
    postToCanvas(shown.messages, shown.typedIn);
    const { draftAction, eventId } = props.current;
    const tap = ++newest.current;
    void (async () => {
      let res: HubDraftActionResult | typeof SUPERSEDED;
      try {
        res = await makerSave(
          () => makerLatestWrite(key, () => saveDraft(draftAction, eventId, patch)),
          // Owed only if something else in the burst asked for a render (`makerNeedsRender`).
          requestMakerRefresh,
          { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
        );
      } catch {
        res = { ok: false, intent: 'save', error: '' };
      }
      if (res === SUPERSEDED) return;
      if (res.ok) {
        onSaved();
        return;
      }
      if (tap !== newest.current) return;
      onRefused(res.error);
    })();
  };

  /** A hero canvas change: drawn on the canvas, on the Maker's copy, then saved behind. */
  const commit = (next: HubSectionCanvas, what: string, typedIn: MessageEventSource | null = null) => {
    const { heroCanvas } = props.current;
    const before = draftedCanvasOr('hero', heroCanvas);
    if (canvasFingerprint(before) === canvasFingerprint(next)) return;
    noteDraftedCanvas('hero', next, heroCanvas);
    props.current.onSaving('hero', next);
    setError(null);
    write(
      canvasWriteKey('hero'),
      { widgets: { hero: { canvas: next } } },
      { messages: layMessages(before, next), typedIn },
      () => {
        saved.current = next;
      },
      (reason) => {
        /* ↩ Refused: the page, the Maker's copy and the hold go back — and it is said.
           Only what THIS bar writes (the part's words, format, show/hide) goes
           back: a pick the part's tools made beside it (a phone) is kept. */
        const back = withOwnFieldsFrom(draftedCanvasOr('hero', props.current.heroCanvas), saved.current, el);
        noteDraftedCanvas('hero', back, props.current.heroCanvas);
        props.current.onSaving('hero', back);
        lay(next, back, null);
        const text = refusedChoiceWords(el, what, reason || null);
        setError(text);
        announceMakerSave({ state: 'error', text });
      },
    );
  };

  /**
   * ✍ THE NAMES, TYPED → `events.display_name` in the DRAFT (never the live
   * row — guests read them at Apply). The canvas already shows the letters;
   * the other pane gets them; a refused save puts the last saved names back.
   */
  const savedNames = useRef(p.start.text);
  const typeNames = (text: string) => {
    const name = typedDisplayName(text, props.current.twoPeople);
    refusedRef.current = name === null;
    if (!name) {
      setError(`${HUB_ELEMENT_LABEL[el]}: type a name on each side — the names cannot be left empty.`);
      return;
    }
    setError(null);
    write(
      NAMES_WRITE_KEY,
      { events: { display_name: name } },
      { messages: [{ source: 'setnayan-editor', t: 'typeText', key: session.key, el, text: name }], typedIn: session.source },
      () => {
        savedNames.current = name;
      },
      (reason) => {
        props.current.broadcast({ source: 'setnayan-editor', t: 'typeText', key: session.key, el, text: savedNames.current });
        const text = `Your names did not save${reason ? ` — ${reason}` : ''}. They are back as they were.`;
        setError(text);
        announceMakerSave({ state: 'error', text });
      },
    );
  };

  /**
   * ✍ A SCENE'S WORDS, TYPED → the ONE place they live, in the DRAFT
   * (`sceneTypeWrite`): the Special message and the Reminders are the event's
   * own words; a scene of their own's heading and words are its `custom`, the
   * other half carried as the Maker has it now. The canvas already shows the
   * letters; the other pane gets them; a refused save puts the last saved
   * words back on every frame and says so.
   */
  const savedScene = useRef(p.start.text);
  const typeScene = (text: string) => {
    if (!field || !sceneType) return;
    const own = draftedOwnWordsOr(sceneType, props.current.ownWords ?? null);
    const w = sceneTypeWrite(field, sceneType, text, own);
    refusedRef.current = !w.ok;
    if (!w.ok) {
      setError(w.reason);
      return;
    }
    setError(null);
    const custom = w.patch.widgets?.[sceneType as keyof NonNullable<HubDraftPatch['widgets']>]?.custom;
    if (custom) noteDraftedOwnWords(sceneType, custom, props.current.ownWords ?? null);
    write(
      w.writeKey,
      w.patch,
      { messages: [{ source: 'setnayan-editor', t: 'typeText', key: session.key, el, field, text: w.words }], typedIn: session.source },
      () => {
        savedScene.current = w.words;
      },
      (reason) => {
        if (custom) noteDraftedOwnWords(sceneType, own, props.current.ownWords ?? null);
        props.current.broadcast({ source: 'setnayan-editor', t: 'typeText', key: session.key, el, field, text: savedScene.current });
        const said = `${SCENE_FIELD_LABEL[field]}: the new words did not save${reason ? ` — ${reason}` : ''}. The words are back as they were.`;
        setError(said);
        announceMakerSave({ state: 'error', text: said });
      },
    );
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
      if (field) {
        props.current.broadcast({ source: 'setnayan-editor', t: 'typeText', key: p.start.key, el, field, text: savedScene.current });
        return;
      }
      const back = el === 'names' ? savedNames.current : words(draftedCanvasOr('hero', props.current.heroCanvas));
      props.current.broadcast({ source: 'setnayan-editor', t: 'typeText', key: p.start.key, el, text: back });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    if ((!field && !isTypeCaretPart(el)) || session.text === lastText.current) return;
    lastText.current = session.text;
    if (field) {
      typeScene(session.text);
      return;
    }
    if (el === 'names') {
      typeNames(session.text);
      return;
    }
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

  const current = sceneType ? draftedCanvasOr(sceneType, p.sceneCanvas) : draftedCanvasOr('hero', p.heroCanvas);
  const style = current.elements?.[el] ?? {};
  // ✍ A scene's own words: no line exists to offer, and no format (words, not a date).
  const lines = field ? [] : wordingLines(el, { auto: session.auto, twoPeople: p.twoPeople });
  const formats = field ? [] : formatChoices(el, session);

  /* 🔤 THE NAMES' WORDING ▾ — the event's Name style, the three choices only,
     each in the couple's own name. Shown at once; held in the DRAFT (guests and
     the prints read it at Apply); a refusal puts back the last saved style
     (only for the latest pick). */
  const nameChoices = el === 'names' && p.names ? nameStyleChoicesFor(p.names.person) : [];
  const [nameStyle, setNameStyle] = useState<NameStyle | null>(p.names?.style ?? null);
  const nameStyleSaved = useRef<NameStyle | null>(p.names?.style ?? null);
  const nameStyleLatest = useRef<NameStyle | null>(p.names?.style ?? null);
  const pickNameStyle = (key: string) => {
    const picked = nameChoices.find((c) => c.key === key)?.key;
    if (!picked || picked === nameStyleLatest.current) return;
    nameStyleLatest.current = picked;
    setNameStyle(picked);
    setError(null);
    write(
      NAME_STYLE_WRITE_KEY,
      nameStyleDraftPatch(picked),
      { messages: [], typedIn: null },
      () => {
        nameStyleSaved.current = picked;
      },
      () => {
        if (nameStyleLatest.current !== picked) return;
        nameStyleLatest.current = nameStyleSaved.current;
        setNameStyle(nameStyleSaved.current);
        const text = 'That name style did not save — please try again.';
        setError(text);
        announceMakerSave({ state: 'error', text });
      },
    );
  };

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
    if (sceneType) {
      hideScenePart();
      return;
    }
    const before = draftedCanvasOr('hero', props.current.heroCanvas);
    const elements = withElementChoice(before.elements, el, 'hidden', style.hidden ? null : true);
    const next: HubSectionCanvas = { ...before };
    if (elements) next.elements = elements;
    else delete next.elements;
    commit(next, 'hidden');
  };

  /**
   * ✍ A SCENE PART'S HIDE — its own show/hide on ITS scene's canvas (Arrange's),
   * through the same one write path and the element sheet's queue and key for
   * that scene: on the canvas first, the Maker's copy and the canvas hold, then
   * held into the draft. Refused: all three go back, and it is said.
   */
  const hideScenePart = () => {
    if (!sceneType) return;
    const server = props.current.sceneCanvas;
    const before = draftedCanvasOr(sceneType, server);
    const elements = withElementChoice(before.elements, el, 'hidden', before.elements?.[el]?.hidden ? null : true);
    const next: HubSectionCanvas = { ...before };
    if (elements) next.elements = elements;
    else delete next.elements;
    noteDraftedCanvas(sceneType, next, server);
    props.current.onSaving(sceneType, next);
    setError(null);
    write(
      canvasWriteKey(sceneType),
      { widgets: { [sceneType]: { canvas: next } } } as HubDraftPatch,
      { messages: [elementPreview(session.key, el, before, next, false)], typedIn: null },
      () => {},
      (reason) => {
        noteDraftedCanvas(sceneType, before, props.current.sceneCanvas);
        props.current.onSaving(sceneType, before);
        props.current.broadcast(elementPreview(session.key, el, next, before, false));
        const said = refusedChoiceWords(el, 'hidden', reason || null);
        setError(said);
        announceMakerSave({ state: 'error', text: said });
      },
    );
  };

  /* 📍 Over the words: above them, or under them when there is no room. */
  const bar = useRef<HTMLDivElement>(null);
  /* 🧭 The new Maker types with the panel away and ONE bar over the keyboard (`stage-tools.tsx`). */
  const stagesStudio = useMaker()?.stagesStudio === true;
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
    /* 🧰 On a phone the bar sits in the LOWER THIRD (owner 2026-10-05: "all tools
       can only reside on the thumb area") — the foot of what is visible, just
       above the keyboard — never over the page. A desktop keeps it by the words. */
    const onPhone = window.innerWidth < 1024;
    let top = onPhone ? vTop + vH - h - 6 : partTop - h - 8;
    if (!onPhone && top < vTop + 4) top = Math.min(partBottom + 8, vTop + vH - h - 4);
    const mid = box.left + (r.left + r.width / 2) * box.scale;
    const left = onPhone ? 8 : Math.max(8, Math.min(window.innerWidth - w - 8, mid - w / 2));
    setAt((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  }, [session.rect, session.vw, session.source, tick]);

  /* 🧭 THE NEW MAKER ON A PHONE (DECISION_LOG 2026-10-07 rule 1; prototype `#kbd .kbar`): the panel has
     stepped aside, the keyboard takes the bottom half, and ONE bar rides on it — "Typing · Names" and Done,
     which brings the panel back. No Wording / Style / Hide: those are the panel's (Style · Text · Animate). */
  if (stagesStudio && !p.inline && typeof window !== 'undefined' && window.innerWidth < 1024) {
    const vv = window.visualViewport;
    const bottom = Math.max(0, window.innerHeight - ((vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight)));
    return createPortal(
      <div
        ref={bar}
        role="toolbar"
        aria-label={`${field ? SCENE_FIELD_LABEL[field] : HUB_ELEMENT_LABEL[el]} — words`}
        data-type-bar={el}
        data-type-bar-keys=""
        style={{ bottom }}
        className={`fixed inset-x-0 z-[85] ${SP_KEY_BAR}`}
      >
        <span className="min-w-0 truncate">Typing · {field ? SCENE_FIELD_LABEL[field] : HUB_ELEMENT_LABEL[el]}</span>
        <button type="button" onClick={p.onClose} data-type-done="" className={SP_KEY_DONE}>
          <span className="inline-flex h-8 items-center rounded-full bg-[#2C2A29] px-4 text-[13px] font-semibold text-white">Done</span>
        </button>
        {error ? (
          <p role="alert" className="absolute inset-x-3 -top-9 rounded-lg bg-white px-2 py-1 text-[12px] font-semibold text-terracotta-700 shadow">
            {error}
          </p>
        ) : null}
      </div>,
      document.body,
    );
  }
  /* 🧰 A PHONE: the rows, inside the part's own Text tools — never over the page. */
  if (p.inline) {
    if (!p.inline.slot) return null;
    return createPortal(
      <div role="group" aria-label={`${field ? SCENE_FIELD_LABEL[field] : HUB_ELEMENT_LABEL[el]} — words`} data-type-bar={el} data-type-bar-inline="">
        {nameChoices.length > 0 ? (
          <IRow label="Wording" data="type-wording">
            <PickMenu
              label={`${HUB_ELEMENT_LABEL[el]} — name style`}
              dataAttr="data-type-wording"
              value={nameStyle}
              options={nameChoices.map((c) => ({ key: c.key, label: c.example, hint: c.label }))}
              onPick={pickNameStyle}
            />
          </IRow>
        ) : lines.length > 0 ? (
          <IRow label="Wording" data="type-wording">
            <PickMenu
              label={`${HUB_ELEMENT_LABEL[el]} — wording`}
              dataAttr="data-type-wording"
              value={words(current) || null}
              buttonText={lines.includes(words(current)) ? undefined : 'Choose a line'}
              options={lines.map((line, i) => ({ key: line, label: line, ...(i === 0 ? { hint: 'Automatic' } : {}) }))}
              onPick={pickLine}
            />
          </IRow>
        ) : null}
        {formats.length > 0 ? (
          <IRow label="Format" data="type-format">
            <PickMenu
              label={`${HUB_ELEMENT_LABEL[el]} — format`}
              dataAttr="data-type-format"
              value={style.format ?? HUB_FORMAT_DEFAULT}
              options={formats}
              onPick={pickFormat}
            />
          </IRow>
        ) : null}
        {error ? (
          <p role="alert" className="py-2 text-[12px] font-semibold text-terracotta-700">
            {error}
          </p>
        ) : null}
      </div>,
      p.inline.slot,
    );
  }
  const phone = typeof window !== 'undefined' && window.innerWidth < 1024;
  /* Portalled to <body>: a glass ancestor (`backdrop-filter`) would become the
     box `position: fixed` is measured from (PickMenu's own rule). */
  return createPortal(
    <div
      ref={bar}
      role="toolbar"
      aria-label={`${field ? SCENE_FIELD_LABEL[field] : HUB_ELEMENT_LABEL[el]} — words`}
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
      {nameChoices.length > 0 ? (
        <PickMenu
          label={`${HUB_ELEMENT_LABEL[el]} — name style`}
          dataAttr="data-type-wording"
          value={nameStyle}
          buttonText="Wording"
          options={nameChoices.map((c) => ({ key: c.key, label: c.example, hint: c.label }))}
          onPick={pickNameStyle}
        />
      ) : lines.length > 0 ? (
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
