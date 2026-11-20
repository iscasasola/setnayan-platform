'use client';

import { useRef, useState } from 'react';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { ChevronRight, Eye, Lock, Palette } from 'lucide-react';
import type { MakerPartKey, MakerStageKey } from '@/lib/maker-parts';
import { MAKER_OPEN_GUESTS_SEE_EVENT, MAKER_OPEN_LOOK_EVENT } from './maker-context';
import { MakerSheet } from './stages-studio-parts';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';

/**
 * ≡ PAGES — the toolbar's page ▾ and the resting bar's Pages (owner 20 Nov 2026, DECISION_LOG "EVENT HUB MAKER — ONE
 * TOOLBAR, FULL SCREEN, APPROVED" and "MAKER · WAY BACK + BUILT-IN GUEST PAGES"; the approved drawing
 * `maker_one_toolbar_expand_2026-11-20_fable.html` v17, its Pages sheet).
 *
 *   · WHOLE EVENT HUB first — the one Look (theme, colours, font, buttons, background, music), the shell's `openLook`;
 *   · then this stage's pages, the one on show open: its scenes in page order, a tap goes there and SELECTS the scene
 *     (a tap always selects — the toolbar is then up on it);
 *   · 👁 per page: the shipped "What guests see" table (`guests-see-sheet.tsx`) — the one place a scene is hidden per
 *     stage; never a second hide store;
 *   · BUILT-IN pages (Me, Live, Camera) say so: their words are the couple's, their look is the Whole Event Hub's.
 *
 * It decides nothing: the toolbar hands over the pages, the scenes each one DREW, and its own two doors (`goPage`,
 * `pickScene` — the very ones the desktop's parts column uses). Nothing of it is in the Maker's first load.
 */
export type MakerPagesAsk = {
  stage: MakerStageKey;
  page: string | null;
  pages: ReadonlyArray<{ key: string; label: string; scenes: ReadonlyArray<{ key: MakerPartKey; label: string }> }>;
  goPage: (key: string) => void;
  pickScene: (page: string, key: MakerPartKey) => void;
};

/** The pages the guest app draws itself — the couple types their words; the look is the Whole Event Hub's. */
export const MAKER_BUILT_IN_PAGES: Readonly<Record<string, string>> = {
  me: 'Built in · each guest’s own QR',
  live: 'Built in · runs from your Schedule',
  camera: 'Built in · shows when Papic is on',
};
export const MAKER_BUILT_IN_WHY = 'Words only here — its Style and Animate follow the Whole Event Hub.';

/**
 * 🔒 BEFORE THEY COME IN (owner 20 Nov 2026, DECISION_LOG "MAKER · WAY BACK + BUILT-IN GUEST PAGES", the approved drawing
 * v17 `pagesSheet`): the pages the guest app draws before a guest is in. What they DO is the same for every guest, so no
 * guest gets stuck; they wear the one theme. Shown here so a couple can find them — never redesigned.
 */
export const MAKER_BEFORE_THEY_COME_IN = [
  {
    key: 'door',
    name: 'Login · the door',
    line: 'Every stage · guests without their link',
    why: 'Every guest comes in through their own invite link. What the door asks is the same on every event, so no guest gets stuck. It wears your theme.',
  },
  {
    key: 'plus-one',
    name: 'Plus-one welcome',
    line: 'Their own door · wears your theme',
    why: 'A plus-one opens their own link and sees only a few questions. The words are the same for every event so nobody is confused. It wears your theme.',
  },
  {
    key: 'pending',
    name: 'Waiting for you to accept',
    line: 'A request’s own ticket · wears your theme',
    why: 'Someone who asked to come sees their ticket marked Request pending until you accept. Fixed words, your theme.',
  },
] as const;
/** What each built-in page of a stage does — its ⓘ (v17 `TOOLWHY`). */
export const MAKER_BUILT_IN_DOES: Readonly<Record<string, string>> = {
  me: 'Each guest’s own QR. It is how they get in at the door, so it cannot be hidden or moved. It wears your theme.',
  live: 'Live runs itself from your Schedule: what is happening now shows first, then what is next. Watch plays your Studio Live stream inside it.',
  camera: 'Shows when Papic is on. Taking and sending photos works the same for every guest, so it cannot be redesigned. It wears your theme.',
};

const ROW = 'flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-ink transition-colors hover:bg-ink/[0.04] active:bg-ink/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30';

export function MakerPagesSheet({ ask, onClose }: { ask: MakerPagesAsk; onClose: () => void }) {
  const [open, setOpen] = useState<string | null>(ask.page ?? ask.pages[0]?.key ?? null);
  const one = ask.pages.length <= 1;
  /* 🔭 An opened page glides into view (the house reveal-on-open — app/_components/reveal-on-open.ts). */
  const sectionEls = useRef(new Map<string, HTMLElement>());
  const intend = useRevealOnOpen(open !== null, () => ({ head: (open && sectionEls.current.get(open)) || null }));
  return (
    <MakerSheet label="Pages" onClose={onClose} tall>
      <div className="flex flex-col gap-1 px-1 pb-2" data-maker-pages="">
        <button
          type="button"
          data-maker-pages-look=""
          className={`${ROW} bg-ink/[0.03] font-semibold`}
          onClick={() => {
            onClose();
            window.dispatchEvent(new Event(MAKER_OPEN_LOOK_EVENT));
          }}
        >
          <Palette aria-hidden className="h-5 w-5 shrink-0 text-ink/60" strokeWidth={1.75} />
          <span className="min-w-0 flex-1">
            Whole Event Hub
            <span className="block text-[12.5px] font-normal text-ink/60">One theme · colours · font · buttons · music</span>
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" />
        </button>

        {/* 🔒 BEFORE THEY COME IN — built in, on every stage (v17). */}
        <section aria-label="Before they come in" data-maker-pages-before="" className="mt-1 rounded-2xl ring-1 ring-ink/10">
          <p className="flex items-center justify-between px-3 pb-1 pt-2.5 text-[13px] font-semibold text-ink">
            <span>Before they come in</span>
            <span className="text-[12px] font-normal text-ink/55">built in</span>
          </p>
          <ul className="flex flex-col pb-1.5">
            {MAKER_BEFORE_THEY_COME_IN.map((row) => (
              <li key={row.key} className="flex min-h-[48px] items-center gap-3 px-3" data-maker-pages-built-in={row.key}>
                <Lock aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={2} />
                <span className="min-w-0 flex-1 text-[14.5px] text-ink">
                  {row.name}
                  <span className="block text-[12px] text-ink/55">{row.line}</span>
                </span>
                <InfoTip label="" ariaLabel={`Why ${row.name} is built in`} align="end">
                  {row.why}
                </InfoTip>
              </li>
            ))}
          </ul>
        </section>

        {ask.pages.map((p) => {
          const on = one || open === p.key;
          const built = MAKER_BUILT_IN_PAGES[p.key] ?? null;
          return (
            <section
              key={p.key}
              ref={(el) => {
                if (el) sectionEls.current.set(p.key, el);
                else sectionEls.current.delete(p.key);
              }}
              data-maker-pages-page={p.key}
              aria-label={p.label}
              className="mt-1 rounded-2xl ring-1 ring-ink/10"
            >
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  aria-expanded={on}
                  data-maker-pages-open={p.key}
                  className={`${ROW} flex-1 font-semibold`}
                  onClick={() => {
                    intend();
                    setOpen(on && !one ? null : p.key);
                    if (p.key !== ask.page) ask.goPage(p.key);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    {p.label}
                    {built ? <span className="block text-[12px] font-normal text-ink/55" data-maker-pages-built="">{built}</span> : null}
                  </span>
                  {p.key === ask.page ? <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sn-accent">On show</span> : null}
                </button>
                <span data-maker-pages-eye={p.key} className="shrink-0">
                  <ActionButton
                    tone="neutral"
                    iconOnly
                    icon={Eye}
                    label={`What guests see on ${p.label}`}
                    onClick={() => {
                      onClose();
                      window.dispatchEvent(new Event(MAKER_OPEN_GUESTS_SEE_EVENT));
                    }}
                  />
                </span>
              </div>
              {on ? (
                <ul className="flex flex-col pb-1.5" data-maker-pages-scenes={p.key}>
                  {built ? (
                    <li className="flex items-center gap-2 px-4 pb-1 text-[12.5px] text-ink/60" data-maker-pages-built-why={p.key}>
                      <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1">{MAKER_BUILT_IN_WHY}</span>
                      {MAKER_BUILT_IN_DOES[p.key] ? (
                        <InfoTip label="" ariaLabel={`What ${p.label} does`} align="end">
                          {MAKER_BUILT_IN_DOES[p.key]}
                        </InfoTip>
                      ) : null}
                    </li>
                  ) : null}
                  {p.scenes.length === 0 ? <li className="px-4 py-2 text-[13px] text-ink/55">Nothing on this page yet.</li> : null}
                  {p.scenes.map((sc) => (
                    <li key={sc.key}>
                      <button
                        type="button"
                        data-maker-pages-scene={sc.key}
                        className={`${ROW} pl-5 text-[14.5px]`}
                        onClick={() => {
                          onClose();
                          if (p.key !== ask.page) ask.goPage(p.key);
                          ask.pickScene(p.key, sc.key);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{sc.label}</span>
                        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/35" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
        <p className="px-3 pt-2 text-[12.5px] text-ink/55" data-maker-pages-foot="">
          <InfoTip label="To move or add a scene, select it" align="start">
            Then ↑ ↓ or ＋ on the page. 🔒 Built-in pages work the same for every guest; the theme dresses them.
          </InfoTip>
        </p>
      </div>
    </MakerSheet>
  );
}
