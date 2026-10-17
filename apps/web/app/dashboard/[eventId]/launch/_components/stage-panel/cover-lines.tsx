'use client';

import { useState, useTransition } from 'react';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { canvasFingerprint, canvasWriteKey, draftedCanvasOr, forgetCanvasSent, noteDraftedCanvas, sendCanvasBase } from '@/lib/maker-draft-store';
import { canvasPickUndo } from '@/lib/canvas-pick-undo';
import { withElementChoice, type HubElementKey } from '@/lib/element-style';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { MAKER_PARTS, type MakerPartKey } from '@/lib/maker-parts';
import { SP_ROWS } from '@/lib/maker-stage-room';
import { elementPreview } from '../../../website/editor/_components/element-preview';
import { MAKER_PART_OPS_EVENT, type MakerPartRaw } from '../maker-part-ops';
import { PanelSwitch } from './kit';

/**
 * ✏️ COVER SCENE › EDIT — THE COVER'S LINES, EACH WITH THE HOUSE SWITCH (owner-approved 2026-10-16, DECISION_LOG "APPROVED —
 * THE COVER SCENE'S OWN EDIT · STYLE (OPENING) · ANIMATE…"; prototype `cover_scene_edit_animate_2026-10-16.html`
 * `drawLines`): the lines top to bottom, two to a row, each a pill — its NAME (a tap picks that word, with its own tools)
 * and the app's one switch (`PanelSwitch`).
 *
 *   · Event title (the names) has NO switch — "always"; a tap says why. The names are what the cover IS (the element's
 *     `hidden` field is gone: `HUB_ELEMENT_FIELDS.names`).
 *   · Logo's switch is Studio's "Show the logo on Cover and QR" — `events.logo_wanted`, ONE fact (owner 2026-10-15 (4)),
 *     written through the same draft door the Studio answer uses (`AnswerPicker`). Off: no mark on the cover.
 *   · Every other line writes its own `elements[el].hidden` on the hero row — the part sheet's own write
 *     (`withElementChoice`, the Maker's copy `draftedCanvasOr`, laid on the page at once by `elementPreview`, one draft
 *     save under the hero's queue key). A hidden line LEAVES the cover at once (never ghosted), and comes back here.
 *
 * Held by `lib/the-cover-scene-has-its-own-edit.test.ts`.
 */

export const COVER_TITLE_ALWAYS = 'The names are the cover — they are always shown.';
const NOT_SAVED = 'That did not save. Nothing changed — please try again.';

export type CoverLine = {
  part: MakerPartKey;
  label: string;
  /** The words the canvas draws for it (the logo: "the monogram"). */
  sample: string;
  /** Shown on the cover now. */
  shown: boolean;
};

/** The line has a switch? Every cover line but the Event title. */
export function coverLineHasSwitch(part: MakerPartKey): boolean {
  return part !== 'names';
}

/** The work area's own draft door and the hero row as the Maker holds it (`MAKER_PART_OPS_EVENT`) — asked here, not
 *  through the ＋ sheet's chunk, so this file stays light. */
function askDoor(): { eventId: string; draftAction: NonNullable<NonNullable<MakerPartRaw['elementEditing']>['draftAction']> | null; hero: HubSectionCanvas | null } | null {
  let got: MakerPartRaw | null = null;
  window.dispatchEvent(new CustomEvent(MAKER_PART_OPS_EVENT, { detail: (raw: MakerPartRaw) => (got = raw) }));
  const raw = got as MakerPartRaw | null;
  if (!raw) return null;
  return { eventId: raw.eventId, draftAction: raw.elementEditing?.draftAction ?? null, hero: (raw.elementEditing?.canvases.hero ?? null) as HubSectionCanvas | null };
}

function show(message: unknown): void {
  document.querySelectorAll<HTMLIFrameElement>('iframe[data-maker-canvas-frame]').forEach((frame) => {
    frame.contentWindow?.postMessage(message, window.location.origin);
  });
}

/** Show / hide one cover word: the hero row's `elements[el].hidden` — on the page now, then ONE draft write, held. */
async function keepShown(el: HubElementKey, shown: boolean): Promise<boolean> {
  const o = askDoor();
  if (!o?.draftAction) return false;
  const server = o.hero;
  const before = draftedCanvasOr('hero', server);
  const elements = withElementChoice(before.elements ?? null, el, 'hidden', shown ? null : true);
  const next: HubSectionCanvas = { ...before };
  if (elements) next.elements = elements;
  else delete next.elements;
  if (canvasFingerprint(before) === canvasFingerprint(next)) return true;
  show(elementPreview('f:hero', el, before, next));
  noteDraftedCanvas('hero', next, server);
  let res: HubDraftActionResult | typeof SUPERSEDED;
  try {
    res = await makerSave(
      () =>
        makerLatestWrite(canvasWriteKey('hero'), () => {
          const fd = new FormData();
          fd.set('intent', 'save');
          fd.set('patch', JSON.stringify({ widgets: { hero: { canvas: next } } }));
          // 👥 …with the canvas this screen last sent: another host's pick on the cover meanwhile is kept.
          sendCanvasBase(fd, 'hero', server, next);
          fd.set(HUB_DRAFT_BAR_FIELD, '1');
          return o.draftAction!(o.eventId, fd);
        }),
      requestMakerRefresh,
      { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true, undo: canvasPickUndo('hero', before, next, server, (from, to) => [elementPreview('f:hero', el, from, to, false)]) },
    );
  } catch {
    res = { ok: false, intent: 'save', error: '' };
  }
  if (res === SUPERSEDED || res.ok) return true;
  forgetCanvasSent('hero');
  if (canvasFingerprint(draftedCanvasOr('hero', server)) === canvasFingerprint(next)) {
    show(elementPreview('f:hero', el, next, before, false));
    noteDraftedCanvas('hero', before, server);
  }
  return false;
}

/** The Logo's switch: `events.logo_wanted` — Studio's own answer, in the draft (it redraws the page). */
async function keepLogo(on: boolean): Promise<boolean> {
  const o = askDoor();
  if (!o?.draftAction) return false;
  try {
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ events: { logo_wanted: on } }));
    const r = await makerSave(() => o.draftAction!(o.eventId, fd), requestMakerRefresh);
    return r.ok;
  } catch {
    return false;
  }
}

export function CoverLines({ lines, onPick, onSay }: { lines: readonly CoverLine[]; onPick: (part: MakerPartKey) => void; onSay: (words: string) => void }) {
  /* What a switch says until the page that shows it comes back (the canvas redraws, then `lines` follows). */
  const [own, setOwn] = useState<Partial<Record<MakerPartKey, boolean>>>({});
  const [pending, start] = useTransition();
  const shownOf = (l: CoverLine) => own[l.part] ?? l.shown;
  const flip = (l: CoverLine, on: boolean) => {
    setOwn((m) => ({ ...m, [l.part]: on }));
    start(async () => {
      const el = MAKER_PARTS[l.part].el;
      let ok = false;
      try {
        ok = l.part === 'logo' ? await keepLogo(on) : el ? await keepShown(el, on) : false;
      } catch {
        ok = false;
      }
      if (!ok) {
        setOwn((m) => ({ ...m, [l.part]: !on }));
        onSay(NOT_SAVED);
      }
    });
  };
  const hidden = lines.filter((l) => coverLineHasSwitch(l.part) && !shownOf(l)).length;
  const tall = lines.length > 6;
  return (
    <div className={SP_ROWS} data-cover-lines="" aria-busy={pending || undefined}>
      <div
        role="group"
        aria-label="The cover’s lines"
        className={`grid grid-cols-2 content-start gap-x-2 gap-y-[var(--sp-rg)] ${tall ? 'row-span-4' : 'row-span-3'}`}
        data-cover-lines-grid=""
      >
        {lines.map((l) => {
          const on = shownOf(l);
          return (
            <div
              key={l.part}
              data-cover-line-row={l.part}
              data-off={coverLineHasSwitch(l.part) && !on ? '' : undefined}
              className="flex h-[var(--sp-rh)] min-w-0 items-center rounded-full bg-[var(--sp-pill)] pr-1 shadow-[inset_0_0_0_1px_var(--sp-line)]"
            >
              <button
                type="button"
                onClick={() => onPick(l.part)}
                data-cover-line-pick={l.part}
                className="flex h-11 min-w-0 flex-1 flex-col justify-center pl-3 pr-0.5 text-left"
              >
                <b className={`block truncate text-[13px] font-semibold leading-tight ${coverLineHasSwitch(l.part) && !on ? 'text-[var(--sp-mute)] line-through' : 'text-[var(--sp-ink)]'}`}>{l.label}</b>
                <small className="mt-px block truncate text-[10.5px] leading-tight text-[var(--sp-mute)]">{l.sample}</small>
              </button>
              {coverLineHasSwitch(l.part) ? (
                <PanelSwitch on={on} label={`Show ${l.label}`} data={`cover-line-${l.part}`} onChange={(next) => flip(l, next)} />
              ) : (
                <button
                  type="button"
                  aria-label="Always shown"
                  data-cover-line-always=""
                  onClick={() => onSay(COVER_TITLE_ALWAYS)}
                  className="h-11 shrink-0 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--sp-mute)]"
                >
                  always
                </button>
              )}
            </div>
          );
        })}
      </div>
      {tall ? null : (
        <p className="row-start-4 flex min-w-0 items-center px-1 text-[12.5px] leading-snug text-[var(--sp-ink)]/70" data-cover-lines-note="">
          {hidden > 0 ? (
            <>
              <b className="mr-1 font-semibold text-[var(--sp-ink)]">{hidden} hidden</b>— guests won’t see {hidden === 1 ? 'it' : 'them'}. Tap a name to edit that word.
            </>
          ) : (
            'Tap a name to edit that word.'
          )}
        </p>
      )}
    </div>
  );
}
