'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RSVP_GROUP_PICK_EVENT, RSVP_LIST_DONE_EVENT, RSVP_LIST_PICK_EVENT, RSVP_LIST_SAY_EVENT, RSVP_LIST_WORDS, rsvpGroupId, type RsvpListDone, type RsvpListPick } from '@/lib/rsvp-layout-edit';
import { RSVP_ADDED_MAX, RSVP_GROUP_ATTR, RSVP_SCREEN_LINES, rsvpAddedId, rsvpLookCard, type RsvpAddedLine, type RsvpLookCard } from '@/lib/rsvp-look';
import { RSVP_SITE_SOURCE, isRsvpStageScene } from '@/lib/rsvp-stage';
import { RSVP_ADDED_NAME } from '@/app/[slug]/_components/rsvp-lines';
import { RSVP_LINE_NAME } from '@/app/[slug]/_components/rsvp-canvas-parts';
import { RSVP_SCENE_PART, rsvpGroupRows, rsvpLineRow, rsvpLinesBox, rsvpTopRows } from './rsvp-canvas-arrange';
import { attachRsvpDrag, type RsvpDragSubject } from './rsvp-canvas-drag';
import { RsvpAddLineSheet, RsvpGroupPickBar, askRsvpListEdit } from './rsvp-line-list';

/**
 * ＋ THE TOOLBAR'S HALF OF THE RSVP STAGE'S LIST (owner's ruling 2026-10-09; approved prototype
 * `prototypes/maker_rsvp_add_drag_group_2026-10-09.html`) — kept out of `stage-tools.tsx`, which only asks this hook
 * four things: what the picked line is CALLED, whether its Edit rows are the panel's, where ＋ may stand on its
 * frame, and the sheet to draw.
 *
 *   · ＋ on the picked line's frame (top and bottom edge) → the sheet (Heading · Message) → one edit of the list, asked
 *     of the RSVP panel; the new line is PICKED when the panel answers, and what happened is said in the toolbar's
 *     own toast. ＋ is drawn for a line that has a place in a screen's list and for a group; the Hint takes ＋ above
 *     only (it stays at the card's foot); the card, the pass and the masthead take none.
 *   · THE PICKED LINE STEPS APART from its neighbours on the page (the prototype's `.el.on{margin-block:36px}`): the
 *     frame's edge then sits in the middle of the gap and the 26 px ＋ on it never lies over another line's words.
 *     On the Maker's sample only — a mark and one rule put on the frame's document from here.
 *
 *   · ✋ HOLD A LINE TO MOVE IT (`rsvp-canvas-drag.ts`, the Wedding March's feel): wired on the frame of the screen on
 *     show, whatever is picked. What a press picks up is the prototype's rule (`rsvpDragSubject`): the line — or,
 *     inside a group, the WHOLE GROUP unless that very line is the picked one. A drop asks the panel for ONE edit
 *     (`do: 'place'`), like every other change; what was held is picked. While a line is held the frame steps aside.
 *
 *   · 🫧 GROUP (the prototype's picking mode): Edit's last row asks for it (`RSVP_GROUP_PICK_EVENT`); the lines of
 *     the screen step apart and wear a ring, a tap ticks one (or lets it go), the lower third is the picking bar
 *     (`RsvpGroupPickBar`), and Done asks the panel for ONE edit (`do: 'group'`). A group cannot go inside a group; a
 *     line already in one cannot be picked; nothing is held or framed while picking. A GROUP is then a part like a
 *     line: tapped on its own paper it is picked, framed, moved, and takes ＋ — its tools are Edit and Background
 *     (Style and Animate stay grey and say why: `groupWhy`).
 *
 * What is on the page is read FROM the page (the same-origin frame): the toolbar holds no copy of the config, so a
 * name can never disagree with what the couple is looking at.
 */

/**
 * 🎟 THE PASS'S SAVE BUTTON has no place in a list — the pass is each guest's own ticket, and its button stays under
 * it. Its Edit row is the toolbar's own three (it is no line of a card); what its grey steps say (controller
 * 2026-10-10). Remove says what every line of the page's own says.
 */
export const RSVP_SAVE_STAYS = { earlier: RSVP_LIST_WORDS.save, later: RSVP_LIST_WORDS.save, remove: RSVP_LIST_WORDS.ownLine } as const;

const APART_ATTR = 'data-rsvp-apart';
const APART_CSS = `[${APART_ATTR}]{margin-block:36px!important}`;

/**
 * 🫧 THE MARKS WHILE LINES ARE PICKED (the prototype's `.can` · `.tick` · `.cant`): every line that can join steps
 * apart and wears a ring to its left, a picked one a tick and an outline, a group stands back (it cannot join).
 * On the Maker's sample only. Colour tokens only (owner 2026-10-11) — the page's paper and ink, the one accent.
 */
export const RSVP_PICK_ATTR = 'data-rsvp-pick';
const PICK_CSS =
  `[${RSVP_PICK_ATTR}]{position:relative;margin:12px 0 12px 24px!important}` +
  `[${RSVP_PICK_ATTR}="can"]::after,[${RSVP_PICK_ATTR}="tick"]::after{content:'';position:absolute;left:-26px;top:50%;box-sizing:border-box;width:18px;height:18px;margin-top:-9px;display:grid;place-items:center;border-radius:50%;border:1.5px solid rgb(var(--color-ink) / .4);background:rgb(var(--color-cream));font:700 11px/1 system-ui,sans-serif;letter-spacing:0;text-transform:none}` +
  `[${RSVP_PICK_ATTR}="tick"]::after{content:'✓';border-color:rgb(var(--sn-accent));background:rgb(var(--sn-accent));color:rgb(var(--sn-on-accent))}` +
  `[${RSVP_PICK_ATTR}="tick"]{outline:2px solid rgb(var(--sn-accent));outline-offset:2px}` +
  `[${RSVP_PICK_ATTR}="cant"]{opacity:.4}`;
/** What a grey tool says on a group (the prototype's two sentences). */
const GROUP_WHY = { style: RSVP_LIST_WORDS.groupStyle, animate: RSVP_LIST_WORDS.groupAnimate } as const;

type Meta = { name: string | null; inGroup: boolean; own: boolean; group: boolean; add: { above: boolean; below: boolean } | null };
const NONE: Meta = { name: null, inGroup: false, own: false, group: false, add: null };

function frameDoc(frameSel: string): Document | null {
  return document.querySelector<HTMLIFrameElement>(frameSel)?.contentDocument ?? null;
}
/** The card whose list the screen on show lays out (the frame names its screen). */
function framePart(frameSel: string): RsvpLookCard | null {
  const scene = document.querySelector<HTMLIFrameElement>(frameSel)?.getAttribute('data-rsvp-stage-frame');
  return isRsvpStageScene(scene) ? RSVP_SCENE_PART[scene] : null;
}

type DragSubject = RsvpDragSubject & { part: RsvpLookCard };
/**
 * ✋ WHAT A PRESS PICKS UP (the prototype's `subjectOf`): the line under the finger, among the screen's top row — or,
 * inside a group, the whole group, unless that very line is the one picked (then it moves inside its group). Null:
 * nothing can be moved from here — the card's own ground, the Hint, a question's field, the pass, the masthead.
 */
export function rsvpDragSubject(doc: Document, part: RsvpLookCard, target: Element, pickedLine: string | null): DragSubject | null {
  const box = rsvpLinesBox(doc, part);
  if (!box || !box.contains(target)) return null;
  /* Words being typed on the page (the bridge's typing): a long press there is the caret's, never a lift. */
  if ((target as HTMLElement).isContentEditable) return null;
  const top = rsvpTopRows(box, part);
  const wrap = target.closest<HTMLElement>(`[${RSVP_GROUP_ATTR}]`);
  if (wrap && box.contains(wrap)) {
    const inside = rsvpGroupRows(box, wrap);
    const line = inside.find((r) => r.row.contains(target));
    if (line && line.name === pickedLine) return { part, ...line, beside: inside };
    const self = top.find((r) => r.row === wrap);
    return self ? { part, ...self, beside: top } : null;
  }
  const line = top.find((r) => r.row.contains(target));
  return line ? { part, ...line, beside: top } : null;
}
/** The element a list name stands for on the page: a line (the page's own, or added) or a group's wrapper. */
function nodeOf(doc: Document, part: RsvpLookCard, name: string): HTMLElement | null {
  const box = rsvpLinesBox(doc, part);
  if (!box) return null;
  const group = rsvpGroupId(name);
  return group ? box.querySelector<HTMLElement>(`[${RSVP_GROUP_ATTR}="${CSS.escape(group)}"]`) : rsvpLineRow(box, name);
}

export function useRsvpListStage({
  on,
  frameSel,
  part,
  line,
  onPick,
  onSay,
}: {
  /** The RSVP stage is open. */
  on: boolean;
  /** The frame of the screen on show. */
  frameSel: string;
  /** The picked Maker part (`rsvp` the form · `yesnote` · `nonote` · `pass` …) and the picked line of it. */
  part: string | null;
  line: string | null;
  /** Pick this line — null: let go. `tool`: the tool the prototype opens on it (a line just added: Edit). `part`: the
   *  card it is a line of (a line held and dropped may be on a card that is not the picked part); absent: the picked one. */
  onPick: (line: string | null, tool?: 'edit' | 'bg', part?: RsvpLookCard) => void;
  /** The toolbar's own toast. */
  onSay: (words: string) => void;
}): {
  /** What an added line or a group is called (null: one of the page's own lines — the toolbar has its name). */
  name: string | null;
  /** The picked line stands inside a group. */
  inGroup: boolean;
  /** Its Edit rows are the RSVP panel's (an added line's words, a group's place) — the toolbar's own stand aside. */
  own: boolean;
  /** A GROUP is picked: its tools are Edit and Background — what its grey Style and Animate say. Null: not a group. */
  groupWhy: { style: string; animate: string } | null;
  /** Where ＋ stands on the picked thing's frame — null: nowhere. */
  add: { above: boolean; below: boolean; onAdd: (where: 'above' | 'below') => void } | null;
  /** 🎟 The pass's Save button is picked: what its grey Earlier · Later · Remove say (`RSVP_SAVE_STAYS`). Null: any other. */
  stays: typeof RSVP_SAVE_STAYS | null;
  /** The picked part's frame steps aside: a line is held, or lines are being picked for a group. */
  away: boolean;
  node: ReactNode;
} {
  const listPart = on ? rsvpLookCard(part) : null;
  const [stamp, setStamp] = useState(0);
  const [meta, setMeta] = useState<Meta>(NONE);
  const [adding, setAdding] = useState<'above' | 'below' | null>(null);
  /** 🫧 Lines being picked for a group: the screen's card, and the names ticked so far. Null: not picking. */
  const [multi, setMulti] = useState<{ part: RsvpLookCard; names: string[] } | null>(null);
  const multiNow = useRef(multi);
  multiNow.current = multi;

  /* What the picked thing IS, read off the page — again after every edit of the list. */
  useLayoutEffect(() => {
    if (!listPart || !line) return setMeta(NONE);
    const doc = frameDoc(frameSel);
    const node = doc ? nodeOf(doc, listPart, line) : null;
    const isGroup = rsvpGroupId(line) !== null;
    const added = rsvpAddedId(line) ? ((doc?.querySelector(`[data-rsvp-line="${CSS.escape(line)}"]`)?.getAttribute('data-rsvp-added') ?? null) as RsvpAddedLine['k'] | null) : null;
    const inList = isGroup || added !== null || RSVP_SCREEN_LINES[listPart].includes(line);
    const foot = listPart === 'rsvp' && line === 'hint';
    setMeta({
      name: isGroup ? 'Group' : added ? RSVP_ADDED_NAME[added] : null,
      inGroup: Boolean(node && !isGroup && node.parentElement?.closest(`[${RSVP_GROUP_ATTR}]`)),
      own: isGroup || added !== null,
      group: isGroup,
      add: node && inList ? { above: true, below: true } : foot ? { above: true, below: false } : null,
    });
  }, [listPart, line, frameSel, stamp]);

  /* The picked line steps apart, so ＋ has room on its frame. */
  useEffect(() => {
    const doc = on ? frameDoc(frameSel) : null;
    if (!doc) return;
    doc.querySelectorAll(`[${APART_ATTR}]`).forEach((el) => el.removeAttribute(APART_ATTR));
    if (!listPart || !line || !meta.add) return;
    if (!doc.querySelector('style[data-rsvp-apart-rule]')) {
      const style = doc.createElement('style');
      style.setAttribute('data-rsvp-apart-rule', '');
      style.textContent = APART_CSS;
      doc.head.appendChild(style);
    }
    const node = line === 'hint' ? doc.querySelector<HTMLElement>('[data-rsvp-line="hint"]') : nodeOf(doc, listPart, line);
    node?.setAttribute(APART_ATTR, '');
    return () => node?.removeAttribute(APART_ATTR);
  }, [on, frameSel, listPart, line, meta.add, stamp]);

  /* The panel's answer to an edit: what to pick now, what to say. And a grey button's reason. */
  useEffect(() => {
    if (!on) return;
    const onDone = (e: Event) => {
      const done = (e as CustomEvent<RsvpListDone>).detail;
      if (!done) return;
      if (done.said) onSay(done.said);
      if (done.ok && done.edit.do !== 'words') onPick(done.pick, done.edit.do === 'add' ? 'edit' : done.edit.do === 'group' ? 'bg' : undefined, done.edit.part);
      /* The group was made: picking is over (refused — a fifth group — it stays, and the reason is said). */
      if (done.ok && done.edit.do === 'group') setMulti(null);
      setStamp((n) => n + 1);
    };
    /* "Open the group", from a line inside it. */
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<RsvpListPick>).detail;
      if (d && typeof d.name === 'string' && rsvpLookCard(d.part)) onPick(d.name, d.tool, d.part);
    };
    /* 🫧 Edit's last row asked for a group: picking starts from the line it was asked on. */
    const onGroup = (e: Event) => {
      const d = (e as CustomEvent<{ part?: unknown; line?: unknown }>).detail;
      const part = rsvpLookCard(typeof d?.part === 'string' ? d.part : null);
      if (part && typeof d?.line === 'string') setMulti({ part, names: [d.line] });
    };
    const onSaid = (e: Event) => {
      const words = (e as CustomEvent<string>).detail;
      if (typeof words === 'string' && words) onSay(words);
    };
    window.addEventListener(RSVP_LIST_DONE_EVENT, onDone);
    window.addEventListener(RSVP_LIST_SAY_EVENT, onSaid);
    window.addEventListener(RSVP_LIST_PICK_EVENT, onOpen);
    window.addEventListener(RSVP_GROUP_PICK_EVENT, onGroup);
    return () => {
      window.removeEventListener(RSVP_LIST_DONE_EVENT, onDone);
      window.removeEventListener(RSVP_LIST_SAY_EVENT, onSaid);
      window.removeEventListener(RSVP_LIST_PICK_EVENT, onOpen);
      window.removeEventListener(RSVP_GROUP_PICK_EVENT, onGroup);
    };
  }, [on, onPick, onSay]);

  /* 🫧 PICKING THE LINES OF A GROUP — the marks on the page, and a tap that ticks instead of picking. Heard on the
     frame's WINDOW, before the page's own tap (which would pick the line as a part). */
  const say = useRef(onSay);
  say.current = onSay;
  useEffect(() => setMulti(null), [on, frameSel]); /* another screen, or the stage closed: picking is over */
  useEffect(() => {
    if (!multi) return;
    const doc = frameDoc(frameSel);
    const win = doc?.defaultView;
    const box = doc ? rsvpLinesBox(doc, multi.part) : null;
    if (!doc || !win || !box) return;
    const style = doc.createElement('style');
    style.setAttribute('data-rsvp-pick-rule', '');
    style.textContent = PICK_CSS;
    doc.head.appendChild(style);
    const rows = rsvpTopRows(box, multi.part);
    for (const { name, row } of rows) row.setAttribute(RSVP_PICK_ATTR, rsvpGroupId(name) ? 'cant' : multi.names.includes(name) ? 'tick' : 'can');
    const onTap = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const target = e.target as Element | null;
      if (!target || target.nodeType !== 1) return;
      const hit = rows.find((r) => r.row.contains(target));
      if (!hit) return;
      /* A group cannot go inside a group; a line already in one must be ungrouped first (the prototype's two lines). */
      if (rsvpGroupId(hit.name)) return say.current(target.closest('[data-rsvp-line]') ? RSVP_LIST_WORDS.inGroupPick : RSVP_LIST_WORDS.isGroup);
      setMulti((m) => (m ? { part: m.part, names: m.names.includes(hit.name) ? m.names.filter((n) => n !== hit.name) : [...m.names, hit.name] } : m));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMulti(null);
    };
    win.addEventListener('click', onTap, true);
    window.addEventListener('keydown', onKey);
    return () => {
      win.removeEventListener('click', onTap, true);
      window.removeEventListener('keydown', onKey);
      style.remove();
      for (const { row } of rows) row.removeAttribute(RSVP_PICK_ATTR);
    };
  }, [multi, frameSel]);

  /* ✋ HOLD TO MOVE — on the frame of the screen on show; wired again when that page says it is up (a frame that
     loads later, or loads again, is a new document). */
  const [held, setHeld] = useState(false);
  const [up, setUp] = useState(0);
  const lineNow = useRef(line);
  lineNow.current = line;
  const pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    if (!on) return;
    const onReady = (e: MessageEvent) => {
      const d = e.data as { source?: unknown; t?: unknown } | null;
      if (d?.source === RSVP_SITE_SOURCE && d.t === 'rsvpReady') setUp((n) => n + 1);
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [on]);
  useEffect(() => {
    const doc = on ? frameDoc(frameSel) : null;
    const part = on ? framePart(frameSel) : null;
    if (!doc?.body || !part) return;
    const undo = attachRsvpDrag<DragSubject>(doc, {
      /* Nothing is held while lines are picked for a group (the prototype's `S.multi` guard). */
      subject: (target) => (multiNow.current ? null : rsvpDragSubject(doc, part, target, lineNow.current)),
      onLift: () => setHeld(true),
      onDrop: (subject, before) => {
        setHeld(false);
        /* Back where it was: nothing is asked — what was held is picked (the prototype picks it on every drop). */
        if (before === undefined) return pick.current(subject.name, undefined, subject.part);
        askRsvpListEdit({ do: 'place', part: subject.part, name: subject.name, before });
      },
    });
    return () => {
      undo();
      setHeld(false);
    };
  }, [on, frameSel, up]);

  const onAdd = useCallback(
    (where: 'above' | 'below') => {
      if (!listPart) return;
      /* A full screen says so at ＋ — the sheet would only offer what cannot be taken. */
      const doc = frameDoc(frameSel);
      const box = doc ? rsvpLinesBox(doc, listPart) : null;
      if (box && box.querySelectorAll('[data-rsvp-added]').length >= RSVP_ADDED_MAX) return onSay(RSVP_LIST_WORDS.full);
      setAdding(where);
    },
    [frameSel, listPart, onSay],
  );
  const anchorName = line ? (meta.name ?? RSVP_LINE_NAME[line] ?? line) : '';
  /* 🚪 THE SHEET IS DRAWN ON THE PAGE'S BODY, never inside the toolbar: the stage's own panel (Edit's rows) lies over
     the toolbar, and a sheet drawn in it opened UNDER those rows — seen in the first picture of this step (2026-10-11:
     the dark was there, "Heading · Message" were not). The same door every sheet of a part uses (`usePartEdits`).
     `adding` is only ever set by a press, so it is null in both first renders and the body is there whenever it is not. */
  const node =
    adding && listPart && line
      ? createPortal(
          <RsvpAddLineSheet
            where={adding}
            anchorName={anchorName}
            onClose={() => setAdding(null)}
            onAdd={(kind) => {
              setAdding(null);
              askRsvpListEdit({ do: 'add', part: listPart, kind, anchor: line, where: adding });
            }}
          />,
          document.body,
        )
      : null;
  const bar = multi ? (
    <RsvpGroupPickBar
      count={multi.names.length}
      onWhy={onSay}
      onCancel={() => setMulti(null)}
      onDone={() => {
        const m = multiNow.current;
        if (m) askRsvpListEdit({ do: 'group', part: m.part, lines: m.names });
      }}
    />
  ) : null;
  return {
    name: meta.name,
    inGroup: meta.inGroup,
    own: meta.own,
    groupWhy: meta.group ? GROUP_WHY : null,
    add: meta.add ? { ...meta.add, onAdd } : null,
    stays: on && part === 'pass' && line === 'save' ? RSVP_SAVE_STAYS : null,
    away: held || multi !== null,
    node: (
      <>
        {node}
        {bar}
      </>
    ),
  };
}
