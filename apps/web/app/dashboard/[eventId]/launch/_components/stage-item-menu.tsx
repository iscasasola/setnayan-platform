'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, CircleCheck, CircleX, Reply } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GUEST_PAGE_ICON } from '../../website/editor/_components/page-pick';
import { RSVP_STAGE_KEY } from '@/lib/rsvp-stage-shared';
import { RSVP_STAGE_SCENES, type RsvpStageScene } from '@/lib/rsvp-stage';
import { MAKER_STAGE_KEYS, type MakerStageKey } from '@/lib/maker-parts';
import { STAGE_ITEM_BUTTON, STAGE_SHEET_ROW } from '@/lib/maker-stage-room';
import { useOneOpen } from '@/lib/one-open';
import { MakerSheet } from './stages-studio-parts';
import { makerPagePick, makerStageLabel } from './maker-bar';
import type { NavSlotKey } from '@/app/[slug]/_lib/site-nav';

/**
 * 🧭 THE STAGE ▾ — the Stages side's one item menu (owner 2026-10-06; plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 2; prototype
 * `#pmenu`). PR 1's one bottom sheet (`MakerSheet`) lists the FIVE stages; a stage
 * of one page jumps there; a stage of several EXPANDS IN PLACE to its pages —
 * the guest bar's own pages, with the guest bar's own icons (`page-pick.tsx`
 * `GUEST_PAGE_ICON`, `lib/maker-guest-pages.ts` `guestBarForStage`) — and the
 * page on screen says "Here". One stage open at a time. The RSVP stage's pages
 * are its three screens (`lib/rsvp-stage.ts`).
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
  /* The stage on screen opens expanded; one stage open at a time. */
  const [expanded, setExpanded] = useState<MakerStageKey | null>(stage);
  useEffect(() => {
    if (open) setExpanded(stage);
  }, [open, stage]);

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
    return options
      .filter((o) => stageOf(o.key) === s)
      .map((o) => {
        const pk = makerPagePick(o.key);
        const key = pk?.kind === 'page' ? pk.page : '';
        return {
          key,
          label: o.label,
          icon: GUEST_PAGE_ICON[key as NavSlotKey] ?? null,
          here: stage === s && page === key,
          note: o.disabledNote,
          pick: () => onPick(o.key),
        };
      });
  };

  const label = makerStageLabel(stage as never);
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
        <ChevronDown aria-hidden className={`h-3.5 w-3.5 shrink-0 transition-transform duration-[240ms] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
      </button>
      {/* ▁ Portalled to <body>: the panel moves (it slides away while typing), and a moved box would hold a fixed sheet. */}
      {open && typeof document !== 'undefined' ? createPortal(
        <MakerSheet label="Stages" onClose={() => setOpen(false)}>
          <ul className="flex flex-col gap-0.5 pb-1" data-stage-menu="">
            {MAKER_STAGE_KEYS.map((s) => {
              const pages = pagesOf(s);
              const many = pages.length > 1;
              const isOpen = expanded === s && many;
              const on = s === stage;
              return (
                <li key={s}>
                  <button
                    type="button"
                    aria-expanded={many ? isOpen : undefined}
                    data-stage-menu-stage={s}
                    onClick={() => {
                      if (many) setExpanded((e) => (e === s ? null : s));
                      else {
                        setOpen(false);
                        pages[0]?.pick();
                      }
                    }}
                    className={`${STAGE_SHEET_ROW} ${on ? 'font-semibold' : ''}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{makerStageLabel(s as never)}</span>
                    {many ? (
                      <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 text-ink/50 transition-transform duration-[240ms] motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.2} />
                    ) : on ? (
                      <Check aria-hidden className="h-4 w-4 shrink-0 text-mulberry" strokeWidth={2.4} />
                    ) : null}
                  </button>
                  {isOpen ? (
                    <ul className="flex flex-col gap-0.5 pb-1 pl-3" data-stage-menu-pages={s}>
                      {pages.map((p) => {
                        const Icon = p.icon;
                        return (
                          <li key={p.key}>
                            <button
                              type="button"
                              disabled={Boolean(p.note)}
                              aria-current={p.here ? 'page' : undefined}
                              data-stage-menu-page={`${s}:${p.key}`}
                              onClick={() => {
                                setOpen(false);
                                p.pick();
                              }}
                              className={`${STAGE_SHEET_ROW} ${p.here ? 'bg-mulberry/10 font-semibold' : ''}`}
                            >
                              {Icon ? <Icon aria-hidden className="h-[18px] w-[18px] shrink-0 text-ink/70" strokeWidth={1.75} /> : null}
                              <span className="min-w-0 flex-1 truncate">{p.label}</span>
                              {p.here ? <span className="shrink-0 text-[12px] font-semibold text-mulberry">Here</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
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

