'use client';

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { RSVP_LIST_DONE_EVENT, RSVP_LIST_SAY_EVENT, RSVP_LIST_WORDS, rsvpGroupId, type RsvpListDone } from '@/lib/rsvp-layout-edit';
import { RSVP_ADDED_MAX, RSVP_GROUP_ATTR, RSVP_SCREEN_LINES, rsvpAddedId, rsvpLookCard, type RsvpAddedLine, type RsvpLookCard } from '@/lib/rsvp-look';
import { RSVP_ADDED_NAME } from '@/app/[slug]/_components/rsvp-lines';
import { RSVP_LINE_NAME } from '@/app/[slug]/_components/rsvp-canvas-parts';
import { rsvpLineRow, rsvpLinesBox } from './rsvp-canvas-arrange';
import { RsvpAddLineSheet, askRsvpListEdit } from './rsvp-line-list';

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

type Meta = { name: string | null; inGroup: boolean; own: boolean; add: { above: boolean; below: boolean } | null };
const NONE: Meta = { name: null, inGroup: false, own: false, add: null };

function frameDoc(frameSel: string): Document | null {
  return document.querySelector<HTMLIFrameElement>(frameSel)?.contentDocument ?? null;
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
  /** Pick this line of the same part — null: let go. `tool`: the tool the prototype opens on it (a line just added: Edit). */
  onPick: (line: string | null, tool?: 'edit' | 'bg') => void;
  /** The toolbar's own toast. */
  onSay: (words: string) => void;
}): {
  /** What an added line or a group is called (null: one of the page's own lines — the toolbar has its name). */
  name: string | null;
  /** The picked line stands inside a group. */
  inGroup: boolean;
  /** Its Edit rows are the RSVP panel's (an added line's words, a group's place) — the toolbar's own stand aside. */
  own: boolean;
  /** Where ＋ stands on the picked thing's frame — null: nowhere. */
  add: { above: boolean; below: boolean; onAdd: (where: 'above' | 'below') => void } | null;
  node: ReactNode;
} {
  const listPart = on ? rsvpLookCard(part) : null;
  const [stamp, setStamp] = useState(0);
  const [meta, setMeta] = useState<Meta>(NONE);
  const [adding, setAdding] = useState<'above' | 'below' | null>(null);

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
      if (done.ok && done.edit.do !== 'words') onPick(done.pick, done.edit.do === 'add' ? 'edit' : done.edit.do === 'group' ? 'bg' : undefined);
      setStamp((n) => n + 1);
    };
    const onSaid = (e: Event) => {
      const words = (e as CustomEvent<string>).detail;
      if (typeof words === 'string' && words) onSay(words);
    };
    window.addEventListener(RSVP_LIST_DONE_EVENT, onDone);
    window.addEventListener(RSVP_LIST_SAY_EVENT, onSaid);
    return () => {
      window.removeEventListener(RSVP_LIST_DONE_EVENT, onDone);
      window.removeEventListener(RSVP_LIST_SAY_EVENT, onSaid);
    };
  }, [on, onPick, onSay]);

  const onAdd = useCallback(
    (where: 'above' | 'below') => {
      if (!listPart) return;
      /* A full screen says so at ＋ — the sheet would only offer what cannot be taken. */
      const doc = frameDoc(frameSel);
      const box = doc ? rsvpLinesBox(doc, listPart) : null;
      if (box && box.querySelectorAll('p[data-rsvp-added]').length >= RSVP_ADDED_MAX) return onSay(RSVP_LIST_WORDS.full);
      setAdding(where);
    },
    [frameSel, listPart, onSay],
  );
  const anchorName = line ? (meta.name ?? RSVP_LINE_NAME[line] ?? line) : '';
  const node =
    adding && listPart && line ? (
      <RsvpAddLineSheet
        where={adding}
        anchorName={anchorName}
        onClose={() => setAdding(null)}
        onAdd={(kind) => {
          setAdding(null);
          askRsvpListEdit({ do: 'add', part: listPart, kind, anchor: line, where: adding });
        }}
      />
    ) : null;
  return { name: meta.name, inGroup: meta.inGroup, own: meta.own, add: meta.add ? { ...meta.add, onAdd } : null, node };
}
