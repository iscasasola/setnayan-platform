'use client';

import { useTransition } from 'react';
import { ArrowRight } from 'lucide-react';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { canvasFingerprint, canvasWriteKey, draftedCanvasOr, forgetCanvasSent, noteDraftedCanvas, sendCanvasBase } from '@/lib/maker-draft-store';
import { ANIMATE_FEELS, ANIMATE_FEEL_LABEL, FEEL_SECONDS, partFeel, partSpeedOf, type AnimateFeel } from '@/lib/animate-feel';
import {
  COVER_ENTRANCES,
  coverEntranceBeats,
  coverEntranceChoice,
  coverWordIsOwn,
  withoutOwnEntrance,
  type CoverEntranceChoice,
  type HubCoverEntrance,
} from '@/lib/cover-entrance';
import type { HubHeroElementKey } from '@/lib/element-style';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { SP_ROWS, SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { MAKER_PART_OPS_EVENT, type MakerPartRaw } from '../maker-part-ops';
import { noteMergedSave, usePickUntilDraftMoves } from './follow-draft';
import { Dd } from './kit';

/**
 * 🎬 COVER SCENE › ANIMATE — ONE ENTRANCE FOR THE WHOLE COVER (owner-approved 2026-10-16; prototype
 * `cover_scene_edit_animate_2026-10-16.html` `drawCoverAnimate`; Pro ◆ at Apply — "ALL ANIMATE, EFFECTS, STYLES AND
 * ACCENTS ARE EVENT HUB PRO ◆"). The toolbar's own four rows:
 *
 *   row 1   Entrance ▾ — The theme's own · Event title first · Top to bottom · All together · Soft focus · From the sides · Still
 *   row 2   Movement ◆ — Quick · Calm · Cinematic (every word's speed); grey while nothing enters
 *   row 3   the beats — which lines arrive on each of the three beats (the shipped Delay steps), numbered, not pressable
 *   row 4   the words on their own (a word's own Build in wins) and "Reset to the cover's entrance ›"
 *
 * Stored as ONE value on the hero row (`canvas.entrance`), resolved at read time (`resolveCoverEntrance`) — nothing is
 * written into the words. A pick redraws the page (the entrance is laid by the server). Held by
 * `lib/the-cover-scene-has-its-own-animate.test.ts`.
 */

export type CoverWord = { key: HubHeroElementKey; label: string };

function askDoor() {
  let got: MakerPartRaw | null = null;
  window.dispatchEvent(new CustomEvent(MAKER_PART_OPS_EVENT, { detail: (raw: MakerPartRaw) => (got = raw) }));
  const raw = got as MakerPartRaw | null;
  return raw ? { eventId: raw.eventId, draftAction: raw.elementEditing?.draftAction ?? null, hero: (raw.elementEditing?.canvases.hero ?? null) as HubSectionCanvas | null } : null;
}

/** One write of the hero row (the entrance, or the words' own Build in taken off) — then the page is drawn again. */
async function keepHero(change: (c: HubSectionCanvas) => HubSectionCanvas): Promise<boolean> {
  const o = askDoor();
  if (!o?.draftAction) return false;
  const before = draftedCanvasOr('hero', o.hero);
  const next = change({ ...before });
  if (canvasFingerprint(before) === canvasFingerprint(next)) return true;
  noteDraftedCanvas('hero', next, o.hero);
  let res: HubDraftActionResult | typeof SUPERSEDED;
  try {
    res = await makerSave(
      () =>
        makerLatestWrite(canvasWriteKey('hero'), () => {
          const fd = new FormData();
          fd.set('intent', 'save');
          fd.set('patch', JSON.stringify({ widgets: { hero: { canvas: next } } }));
          // 👥 …with the canvas this screen last sent: another host's pick on the cover meanwhile is kept.
          sendCanvasBase(fd, 'hero', o.hero, next);
          fd.set(HUB_DRAFT_BAR_FIELD, '1');
          return o.draftAction!(o.eventId, fd);
        }),
      requestMakerRefresh,
    );
  } catch {
    res = { ok: false, intent: 'save', error: '' };
  }
  noteMergedSave(res, o.hero);
  if (res === SUPERSEDED || res.ok) return true;
  forgetCanvasSent('hero');
  noteDraftedCanvas('hero', before, o.hero);
  return false;
}

const NOT_SAVED = 'That did not save. Nothing changed — please try again.';
export const COVER_FEEL_OFF = 'Pick an entrance first — Movement times it.';

export function CoverAnimate({ words, onSay }: { words: readonly CoverWord[]; onSay: (w: string) => void }) {
  const o = typeof window === 'undefined' ? null : askDoor();
  const stored = draftedCanvasOr('hero', o?.hero ?? null);
  /* ↺ The pick until the draft moves, then the draft (`follow-draft.ts`) — never a copy seeded once. */
  const [canvas, setCanvas] = usePickUntilDraftMoves<HubSectionCanvas>(stored);
  const [pending, start] = useTransition();
  const entrance = canvas.entrance ?? null;
  const choice = coverEntranceChoice(entrance);
  const moves = choice !== 'theme' && choice !== 'still';
  const feel: AnimateFeel = partFeel(entrance?.speed);
  const own = words.filter((w) => coverWordIsOwn(canvas.elements, w.key));
  const beats = coverEntranceBeats(entrance, canvas.elements, words);

  const save = (change: (c: HubSectionCanvas) => HubSectionCanvas) => {
    const next = change({ ...canvas });
    setCanvas(next);
    start(async () => {
      let ok = false;
      try {
        ok = await keepHero(() => next);
      } catch {
        ok = false;
      }
      if (!ok) {
        /* Refused: the hero row was put back in the Maker's copy — show it. */
        setCanvas(null);
        onSay(NOT_SAVED);
      }
    });
  };
  const pickEntrance = (k: string) =>
    save((c) => {
      if (k === 'theme') delete c.entrance;
      else c.entrance = { key: k as HubCoverEntrance['key'], ...(entrance?.speed && k !== 'still' ? { speed: entrance.speed } : {}) };
      return c;
    });
  const pickFeel = (f: string) =>
    save((c) => {
      if (!c.entrance) return c;
      const speed = partSpeedOf(f as AnimateFeel);
      c.entrance = { key: c.entrance.key, ...(speed ? { speed } : {}) };
      return c;
    });
  const reset = () =>
    save((c) => {
      const elements = withoutOwnEntrance(c.elements, own.map((w) => w.key));
      if (elements) c.elements = elements;
      else delete c.elements;
      return c;
    });

  return (
    <div className={`${SP_ROWS} shrink-0 px-[10px]`} data-cover-animate="" aria-busy={pending || undefined}>
      <div className={`${SP_ROWS_ROW} row-start-1`}>
        <Dd
          stacked
          small="Entrance ◆"
          label="Entrance of the Cover Scene"
          data="cover-entrance"
          value={choice}
          options={COVER_ENTRANCES.map((e) => ({ key: e.key, label: e.label }))}
          onPick={pickEntrance}
        />
      </div>
      <div className={`${SP_ROWS_ROW} row-start-2`}>
        <Dd
          stacked
          small="Movement ◆"
          label="Movement of the cover's entrance"
          data="cover-feel"
          value={feel}
          options={ANIMATE_FEELS.map((f) => ({ key: f, label: `${ANIMATE_FEEL_LABEL[f]} · ${FEEL_SECONDS[f].toFixed(1)} s` }))}
          buttonText={ANIMATE_FEEL_LABEL[feel]}
          onPick={pickFeel}
          off={moves ? undefined : () => onSay(COVER_FEEL_OFF)}
        />
      </div>
      <div className={`${SP_ROWS_ROW} row-start-3 overflow-hidden`} data-cover-beats="" aria-label="In this order">
        {beats.length > 0 ? (
          beats.map((names, i) => (
            <span key={i} className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-[var(--sp-ink2)]" data-cover-beat={i + 1}>
              <i className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--sp-cta)] text-[10px] font-bold not-italic text-white">{i + 1}</i>
              <span className="truncate">{names.join(', ')}</span>
            </span>
          ))
        ) : (
          <span className="px-1 text-[12.5px] text-[var(--sp-ink)]/70">
            {choice === 'theme' ? 'The theme’s own entrance — each word as the look plays it.' : 'The words are simply there — they appear together on the unveil.'}
          </span>
        )}
      </div>
      <div className={`${SP_ROWS_ROW} row-start-4`} data-cover-own="">
        {own.length > 0 ? (
          <>
            <span className="min-w-0 flex-1 truncate px-1 text-[12.5px] text-[var(--sp-ink)]/70">
              <b className="font-semibold text-[var(--sp-ink)]">{own.map((w) => w.label).join(', ')}</b> {own.length === 1 ? 'has an entrance of its own.' : 'have entrances of their own.'}
            </span>
            <button type="button" onClick={reset} data-cover-reset="" className="sn-press inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-[var(--sp-cta)]">
              Reset to the cover’s
              <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          </>
        ) : (
          <span className="px-1 text-[12.5px] text-[var(--sp-ink)]/70">Tap a word to animate it on its own — it then keeps its own Build in.</span>
        )}
      </div>
    </div>
  );
}

export type { CoverEntranceChoice };
