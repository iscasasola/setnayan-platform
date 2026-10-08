'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, CircleCheck, CircleX, Clock, FileText, Heart, Reply } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RSVP_STAGE_KEY } from '@/lib/rsvp-stage-shared';
import { RSVP_STAGE_SCENES, type RsvpStageScene } from '@/lib/rsvp-stage';
import { MAKER_STAGE_KEYS, type MakerStageKey } from '@/lib/maker-parts';
import { makerStagesPages } from '@/lib/maker-stage-filing';
import { STAGE_ITEM_BUTTON, STAGE_SHEET_ROW } from '@/lib/maker-stage-room';
import { useOneOpen } from '@/lib/one-open';
import { MakerSheet } from './stages-studio-parts';
import { makerPagePick, makerStageLabel } from './maker-bar';

/**
 * 🧭 THE STAGE ▾ — the Stages side's one item menu (owner 2026-10-06; plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 2; prototype
 * `#pmenu`). PR 1's one bottom sheet (`MakerSheet`) lists the FIVE stages — and only
 * the stages (redraw 2026-10-07, side-by-side M4): a pick goes to that stage's first
 * page; the guest's tab bar under the page picks the page. The stage on screen says
 * HERE ✓. The RSVP stage's pages are its three screens (`lib/rsvp-stage.ts`).
 *
 * The pages are the shell's own Page ▾ options (`makerPageMenu`), so this and
 * the desktop's Page ▾ can never disagree. 🔒 Nothing here writes.
 */

export type StagePageOption = { key: string; label: string; disabledNote?: string };

const RSVP_ICON: Record<RsvpStageScene, LucideIcon> = { form: Reply, thanks: CircleCheck, decline: CircleX };

/** The stage a page option belongs to (the RSVP stage's one option is its key). */
function stageOf(key: string): MakerStageKey | null {
  if (key === RSVP_STAGE_KEY) return RSVP_STAGE_KEY;
  const p = makerPagePick(key);
  return p?.kind === 'page' ? p.stage : null;
}

export function StageItemMenu({
  options,
  stage,
  page,
  rsvpScreen,
  onPick,
  onRsvpScreen,
}: {
  /** Every stage's pages, as the shell's Page ▾ lists them. */
  options: readonly StagePageOption[];
  /** The stage on screen. */
  stage: MakerStageKey;
  /** The page on screen (a guest-bar page key) — or, on the RSVP stage, null. */
  page: string | null;
  /** The RSVP stage's screen on show. */
  rsvpScreen: RsvpStageScene;
  /** A page picked — the shell's own Page ▾ door (`pickPage`). */
  onPick: (key: string) => void;
  /** One of the RSVP stage's three screens picked. */
  onRsvpScreen: (screen: RsvpStageScene) => void;
}) {
  const [open, setOpen] = useState(false);
  useOneOpen(open, setOpen);

  const pagesOf = (s: MakerStageKey): Array<{ key: string; label: string; icon: LucideIcon | null; here: boolean; note?: string; pick: () => void }> => {
    if (s === RSVP_STAGE_KEY) {
      return RSVP_STAGE_SCENES.map((sc) => ({
        key: sc.key,
        label: sc.label,
        icon: RSVP_ICON[sc.key],
        here: stage === RSVP_STAGE_KEY && rsvpScreen === sc.key,
        pick: () => {
          if (stage !== RSVP_STAGE_KEY) onPick(RSVP_STAGE_KEY);
          onRsvpScreen(sc.key);
        },
      }));
    }
    /* 🧭 The pages the CANVAS draws this stage as (`makerStagesPages` — the one list its groups and the tab bar
       under the page share), so "3 pages" here is three pages there; a stage it draws as one page says "One page". */
    const own = new Set(makerStagesPages(s).map((p) => p.key));
    return options
      .filter((o) => {
        const pk = makerPagePick(o.key);
        return stageOf(o.key) === s && pk?.kind === 'page' && own.has(pk.page);
      })
      .map((o) => {
        const pk = makerPagePick(o.key);
        const key = pk?.kind === 'page' ? pk.page : '';
        return {
          key,
          label: o.label,
          icon: null,
          here: stage === s && page === key,
          note: o.disabledNote,
          pick: () => onPick(o.key),
        };
      });
  };

  const label = makerStageLabel(stage as never);
  /* 🧭 STAGES ONLY (owner 2026-10-06: *"if we are having this, then we don't need the expand on the drop down"*;
     side-by-side M4): the sheet lists the five stages — icon · name · its pages in a grey line · HERE ✓ on the one
     on screen. A page is picked from the guest's tab bar under the page, never from here. */
  const STAGE_ICON: Record<string, LucideIcon> = { save_the_date: CalendarDays, [RSVP_STAGE_KEY]: Reply, rsvp: FileText, event: Clock, editorial: Heart };
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-stage-item-menu=""
        onClick={() => setOpen((o) => !o)}
        className={STAGE_ITEM_BUTTON}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown aria-hidden className={`h-3.5 w-3.5 shrink-0 text-sn-accent transition-transform duration-[220ms] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
      </button>
      {/* ▁ Portalled to <body>: the panel moves (it slides away while typing), and a moved box would hold a fixed sheet. */}
      {open && typeof document !== 'undefined' ? createPortal(
        <MakerSheet label="Stages" onClose={() => setOpen(false)}>
          <ul className="flex flex-col gap-0.5 pb-1" data-stage-menu="">
            {MAKER_STAGE_KEYS.map((s) => {
              const pages = pagesOf(s);
              const on = s === stage;
              const Icon = STAGE_ICON[s] ?? FileText;
              const first = pages.find((p) => !p.note);
              return (
                <li key={s}>
                  <button
                    type="button"
                    aria-current={on ? 'true' : undefined}
                    data-stage-menu-stage={s}
                    disabled={!on && !first}
                    onClick={() => {
                      setOpen(false);
                      if (!on) first?.pick();
                    }}
                    className={`${STAGE_SHEET_ROW} ${on ? 'bg-[var(--sp-cta-wash)] font-semibold' : ''}`}
                  >
                    <Icon aria-hidden className="h-[18px] w-[18px] shrink-0 text-[var(--sp-ink2)]" strokeWidth={1.9} />
                    <span className="min-w-0 flex-1 truncate">
                      {makerStageLabel(s as never)}
                      <small className="block text-[10.5px] font-medium text-[var(--sp-mute)]">{pages.length > 1 ? `${pages.length} pages` : 'One page'}</small>
                    </span>
                    {on ? (
                      <>
                        <span className="shrink-0 rounded-full bg-[var(--sp-pill)] px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--sp-ink2)]">Here</span>
                        <Check aria-hidden className="h-[18px] w-[18px] shrink-0 text-[var(--sp-cta)]" strokeWidth={2.4} />
                      </>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </MakerSheet>,
        document.body,
      ) : null}
    </>
  );
}
