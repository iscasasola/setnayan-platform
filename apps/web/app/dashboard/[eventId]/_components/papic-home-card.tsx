'use client';

/**
 * papic-home-card.tsx — PAPIC ON HOME: one head with its ON/OFF switch, and the camera settings opening UNDER it.
 *
 * Owner 2026-10-26, on the Home card: *"name it Papic and not Guest Photos."* · *"the gallery should not be there."* ·
 * *"it just needs to have a quick on off button and expand for more settings for papic"* — superseding the 2026-10-23/24
 * quick view (coverage · credits meter · the latest five · Add more) and the phone's own closed tile face.
 *
 *   CLOSED   the head only — the camera mark · "Papic" (small line "Guest photos") · the Papic switch · › to expand.
 *            Nothing else: no coverage, no credits, no meter, no photos, no Add more.
 *   OPEN     a tap on the head reveals the camera settings directly under it, inline — the height grows and the
 *            settings fade in (420 ms, the house ease; reduced motion: at once). No navigation, no overlay, the address
 *            does not change; the head (⌄) folds it back. Credits, Add more and the dates live in the settings; after
 *            the day, the Thank-You Video door is the open card's first row.
 *
 * ONE card, on Home › Today (owner 2026-10-26, DECISION_LOG "THE PAPIC CARD LIVES ON HOME › TODAY; THE STANDALONE
 * PAPIC PAGE IS REMOVED": *"that papic frame with toggle, place that on home and remove that page"* · *"it should be on
 * the today"*). The Papic page is gone; its every setting opens from this card's ›.
 *
 * 🔢 THE FACE CARRIES THE COUNTS (owner 2026-10-26, on the Papic row: *"this is the widget that should be at home with
 * the count of the total, taken, remaining and a button to add more"*): under the head, one line Total · Taken ·
 * Remaining (credits, from the one pot read Home already makes — a failed read says "Couldn't check", never 0) and
 * "Add more", the one buy sheet (Apple's in the app, the web's on the web; none where neither sells). Both sit OUTSIDE
 * the head's button — a sheet's button inside a button is invalid HTML — so the head still only opens the settings.
 */

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Clapperboard } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { PapicCardPhase } from '@/lib/papic-home-card';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';
import { formatCount } from '@/lib/format-number';
import { PAPIC_CARD_ANCHOR } from '@/lib/papic-home-href';
import { papicCountsWords } from '@/lib/papic-card-counts';

/**
 * 📷 THE HEAD'S LINE CAN BE SAID BY THE HEAD'S SWITCH (owner 2026-10-30: the head switch is "Let everybody shoot now"
 * once Papic is on, with a short line under the title). The server draws the line from what is saved (`headLine`); the
 * switch, a sibling of the head's button, says the new line the moment it is pressed and takes it back if the save
 * fails — so the line and the switch never say two things. null = the saved line.
 * A refused save is said UNDER THE HEAD, in the card's flow (`problem`) — never inside the switch's absolute slot, where
 * a sentence widened the slot and threw the switch over the camera mark (walk 2026-10-30, 390 px).
 */
type PapicHeadSay = { line: (line: string | null) => void; problem: (problem: string | null) => void };
const PapicHeadContext = createContext<PapicHeadSay | null>(null);
const SAY_NOTHING: PapicHeadSay = { line: () => {}, problem: () => {} };
export function usePapicHead(): PapicHeadSay {
  return useContext(PapicHeadContext) ?? SAY_NOTHING;
}

export function PapicHomeCard({
  name,
  brand,
  icon,
  phase,
  thankYouHref,
  settings,
  marker,
  defaultOpen = false,
  headControl = null,
  headLine = null,
  counts = null,
  buy = null,
}: {
  name: string;
  brand?: string;
  icon: ReactNode;
  /** Where the capture window stands — after the day, the open card leads with the Thank-You Video door. */
  phase: PapicCardPhase | null;
  /** The Thank-You Video door, offered after the day (null: not offered). */
  thankYouHref?: string | null;
  /** The camera settings, drawn by the server — revealed under the head. */
  settings: ReactNode;
  marker?: Record<string, string>;
  /** Open on arrival — the Papic page draws this same card, open (owner ruling 2026-10-24: one card, everywhere). */
  defaultOpen?: boolean;
  /**
   * The Papic ON/OFF switch, in the head beside the › — shown closed AND open (owner 2026-10-26: "a quick on off
   * button"). A SIBLING of the head's button, never inside it (a switch in a button is invalid HTML).
   */
  headControl?: ReactNode;
  /** The line under the title in place of `brand` — what the head's switch has saved (owner 2026-10-30); null = `brand`. */
  headLine?: ReactNode;
  /** The pot: what it holds and has left. null = not shown (a lab); a field null = not measured ("Couldn't check"). */
  counts?: { total: number | null; left: number | null } | null;
  /** "Add more" — the one buy sheet, built by the server for this platform; null = not offered here. */
  buy?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [saidLine, sayLine] = useState<string | null>(null);
  const [saidProblem, sayProblem] = useState<string | null>(null);
  const [say] = useState<PapicHeadSay>(() => ({ line: sayLine, problem: sayProblem }));
  // 🔒 ONE OPEN AT A TIME on Home (owner-approved 2026-10-24): opening Papic closes the service open before.
  const oneOpenId = useOneOpen(open, setOpen);
  const regionId = useId();
  const root = useRef<HTMLDivElement>(null);
  // 🔗 An old link to the retired Papic page lands on Home as `?papic=open` (owner 2026-10-24: "the controller page is
  // retired; its contents live inside the expanded card"): the card opens itself, scrolls into view, and the address
  // goes back to Home's own — opening never navigates.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('papic') !== 'open') return;
      setOpen(true);
      url.searchParams.delete('papic');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      root.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      /* no window history — stay as drawn */
    }
  }, []);

  return (
    <div ref={root} id={PAPIC_CARD_ANCHOR} className="col-span-full flex min-w-0 scroll-mt-20 flex-col md:col-span-1" data-papic-home-card={open ? 'open' : 'rest'}>
      <OneOpenScope id={oneOpenId}>
        <PapicHeadContext.Provider value={say}>
        <div className="sg-row relative" {...marker}>
          {/* THE SWITCH — in the head, closed and open, over the head's right edge beside the ›. */}
          {headControl ? (
            <div className="absolute right-12 top-[7px] z-[1] [&_[data-form-row-name]]:sr-only [&_[data-form-row]]:!min-h-0 [&_[data-form-row]]:!p-0" data-papic-head-switch="">
              {headControl}
            </div>
          ) : null}
          {/* THE HEAD — the card's one press: it opens the settings under the card, never another page. */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={regionId}
            onClick={() => setOpen((v) => !v)}
            className="block w-full min-w-0 text-left"
            data-papic-card-head=""
            data-tour="home-papic-card"
          >
            <span className="sg-head">
              <span className="sg-mark" aria-hidden>
                {icon}
              </span>
              {/* The head's control is a compact dropdown (owner 2026-10-30: Off · On — event day · On — everyone, now) — the
                  title keeps clear of its widest face. */}
              <span className={`min-w-0 ${headControl ? 'pr-24' : ''}`}>
                <span className="sg-name block truncate">{name}</span>
                {saidLine !== null || headLine || brand ? (
                  <span className={`sg-brand block ${saidLine !== null || headLine ? '[text-wrap:balance]' : 'truncate'}`} data-papic-head-line="">
                    {saidLine ?? headLine ?? brand}
                  </span>
                ) : null}
              </span>
              {/* › turns to ⌄ as the card grows in place (owner 2026-10-24). */}
              <ChevronRight
                aria-hidden
                className={`sg-arrow h-[18px] w-[18px] transition-transform duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
                strokeWidth={1.9}
              />
            </span>
          </button>

          {saidProblem ? (
            <p role="alert" className="pt-1 text-[12.5px] font-semibold leading-snug text-danger-700" data-papic-head-problem="">
              {saidProblem}
            </p>
          ) : null}

          {/* 🔢 TOTAL · TAKEN · REMAINING, and ADD MORE — on the face, closed and open (owner 2026-10-26). */}
          {counts || buy ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2" data-papic-card-face="">
              {counts ? <PapicCounts total={counts.total} left={counts.left} /> : <span />}
              {buy ? (
                <span className="shrink-0" data-papic-card-add-more="">
                  {buy}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* THE SETTINGS, INSIDE THE CARD'S OWN FRAME — the height grows, the settings fade in; folded, they are inert. */}
          <div
            id={regionId}
            role="region"
            aria-label="Papic settings"
            inert={!open}
            data-papic-home-settings={open ? 'open' : 'closed'}
            className={`grid transition-[grid-template-rows,opacity] duration-[420ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${
              open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              {/* After the day, the Thank-You Video door leads the open card (it lived on the closed card until 2026-10-26). */}
              {phase === 'after' && thankYouHref ? (
                <div className="sg-acts" data-papic-thank-you="">
                  <ActionButton tone="brand" icon={<Clapperboard aria-hidden="true" strokeWidth={1.9} />} label="Thank-You Video" href={thankYouHref} />
                </div>
              ) : null}
              <div className="pt-4">{settings}</div>
            </div>
          </div>
        </div>
        </PapicHeadContext.Provider>
      </OneOpenScope>
    </div>
  );
}

/** Total · Taken · Remaining — the pot, in one line. A field that was not measured says so, never 0. */
function PapicCounts({ total, left }: { total: number | null; left: number | null }) {
  const words = papicCountsWords(total, left);
  if (!words) {
    return (
      <p role="status" className="text-[13px] text-ink/60" data-papic-card-counts="unread">
        Credits · Couldn&rsquo;t check
      </p>
    );
  }
  return (
    <dl className="flex items-baseline gap-3 text-[13px] text-ink/65" data-papic-card-counts="">
      {words.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-1">
          <dt>{k}</dt>
          <dd className={`font-semibold ${k === 'Remaining' ? 'text-success-700' : 'text-ink'}`} data-papic-card-count={k.toLowerCase()}>
            {formatCount(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
