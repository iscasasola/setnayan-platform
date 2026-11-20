'use client';

/**
 * papic-home-card.tsx — 📷 PAPIC, THE BLOCK AT THE TOP OF MEMORIES (owner 2026-11-20, *"memories approved"* —
 * `prototypes/memories_redesign_2026-11-20/memories_redesign_2026-11-20_fable.html`, DECISION_LOG 2026-11-20 "EVENT ›
 * MEMORIES — PAPIC ON TOP + FIVE OPENED PAGES, APPROVED"). Owner: *"on the Top will have papic … turning papic service on
 * and off. to add a media file manually, Remaining Credits to use. Tapping will open the rest of papic settings … easy"*.
 *
 *   THE BLOCK   the camera mark · "Papic" · the head's ONE dropdown (Off · On — event day · On — everyone, now — the
 *               shipped `PapicHeadPicker`, its writes unchanged) · ONE state line (`lib/papic-guest-cameras-line.ts`,
 *               the gate's own answer) · ONE big "N credits left" (Total · Taken in its ⓘ; an unread pot is "—", never
 *               0) · two equal buttons, **Add photos** (main — the picker at once, `memories-add-photos.tsx`) and **Add
 *               more** (the shipped buy sheet) · a full-width "All Papic settings ›" row.
 *   OPENED      a tap on the block's body or that row RISES every Papic setting as one full screen — the app's shared
 *               `RiseScreen` (house rule: rise full screen; ✕, Esc and the phone's Back close it). Same items, same
 *               order as the unfold it replaces, "Shooting into" first. Until 20 Nov the settings unfolded in place under
 *               the card (owner 2026-10-23/26) — that unfold, its › → ⌄ and the inline region are gone.
 *
 * The switch, the ⓘ and the two buttons are presses of their own — a tap on one never also opens the settings, and a
 * sheet they open (portalled to <body>) never bubbles into "open the settings" either.
 *
 * Seats: Memories only since 2026-11-08 (THE ONE BUILD: *"Papic + Thank You into Memories"*); the dev home-lab draws it
 * on fixtures. 🔒 `papic-opens-in-memories.test.ts` · `papic-lives-in-memories.test.ts` · `memories-papic-is-on-top.test.ts`.
 */

import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronRight, Clapperboard } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import type { PapicCardPhase } from '@/lib/papic-home-card';
import { formatCount } from '@/lib/format-number';
import { PAPIC_CARD_ANCHOR } from '@/lib/papic-home-href';
import { OneOpenScope, useOneOpen } from '@/lib/one-open';
import { papicCountsWords } from '@/lib/papic-card-counts';

/**
 * 📷 THE HEAD'S LINE CAN BE SAID BY THE HEAD'S SWITCH (owner 2026-10-30). The server draws the line from what is saved
 * (`headLine`); the switch, a sibling of the head's button, says the new line the moment it is pressed and takes it back
 * if the save fails — so the line and the switch never say two things. The switch says ITS words (`papicHeadLine`); the
 * card shows the state line for them (`lineFor`, 2026-11-20). null = the saved line.
 * A refused save is said UNDER THE HEAD, in the card's flow (`problem`) — never inside the switch's slot.
 */
type PapicHeadSay = { line: (line: string | null) => void; problem: (problem: string | null) => void };
const PapicHeadContext = createContext<PapicHeadSay | null>(null);
const SAY_NOTHING: PapicHeadSay = { line: () => {}, problem: () => {} };
export function usePapicHead(): PapicHeadSay {
  return useContext(PapicHeadContext) ?? SAY_NOTHING;
}

/** A tap that landed on one of the block's own presses (or a popover hanging from one) is that press's, not "open". */
const OWN_PRESS = 'button, a, input, select, textarea, label, [role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"], [data-papic-card-acts]';

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
  lineFor = null,
  counts = null,
  add = null,
  buy = null,
  chapter = null,
}: {
  name: string;
  brand?: string;
  icon: ReactNode;
  /** Where the capture window stands — after the day, the opened settings lead with the Thank-You Video door. */
  phase: PapicCardPhase | null;
  /** The Thank-You Video door, offered after the day (null: not offered — Memories' keepsake row is its one home). */
  thankYouHref?: string | null;
  /** Every Papic setting, drawn by the server — risen full screen on a tap. */
  settings: ReactNode;
  marker?: Record<string, string>;
  /** Open on arrival — a save's outcome, a purchase error, or an old `?papic=open` link: the settings rise at once. */
  defaultOpen?: boolean;
  /** The head's ONE dropdown (Off · On — event day · On — everyone, now). A SIBLING of the head's button. */
  headControl?: ReactNode;
  /** The ONE state line under the name (`papicGuestCamerasLine`); null = `brand`. */
  headLine?: ReactNode;
  /** The state line for each line the head's switch can say (`papicGuestCamerasLines().byHead`); null = say it as is. */
  lineFor?: Record<string, string> | null;
  /** The pot: what it holds and has left. null = not shown (a lab); a field null = not measured ("—", never 0). */
  counts?: { total: number | null; left: number | null } | null;
  /** "Add photos" — the main button (`MemoriesAddPhotosButton`); null = not offered here. */
  add?: ReactNode;
  /** "Add more" — the one buy sheet, built by the server for this platform; null = not offered here. */
  buy?: ReactNode;
  /** 📷 "Shooting into" — the chapter row (owner 2026-11-01), the opened settings' FIRST row since 20 Nov. */
  chapter?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [saidLine, sayLine] = useState<string | null>(null);
  const [saidProblem, sayProblem] = useState<string | null>(null);
  // The switch says ITS words; the card keeps the state line for them (`lineFor`) — one fact, one wording.
  const lineForRef = useRef(lineFor);
  lineForRef.current = lineFor;
  const [say] = useState<PapicHeadSay>(() => ({
    line: (said) => sayLine(said === null ? null : (lineForRef.current?.[said] ?? said)),
    problem: sayProblem,
  }));
  // 🔒 ONE OPEN AT A TIME (owner-approved 2026-10-24): the risen settings join one-open, and the scope below keeps a
  // dropdown or ⓘ inside them from closing their own sheet.
  const oneOpenId = useOneOpen(open, setOpen);
  const root = useRef<HTMLDivElement>(null);
  // 🔗 An old link to the retired Papic page lands here as `?papic=open` (`lib/legacy-redirects.ts`): the settings rise,
  // the card scrolls into view, and the address goes back to the page's own — opening never navigates.
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

  // The block's body opens the settings — never a tap on its own presses, and never a click that bubbled (through React)
  // out of a sheet one of them portalled to <body>: that target is not inside this block.
  const onBody = (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as Element;
    if (!e.currentTarget.contains(t) || t.closest(OWN_PRESS)) return;
    setOpen(true);
  };

  return (
    <div ref={root} id={PAPIC_CARD_ANCHOR} className="flex min-w-0 scroll-mt-20 flex-col" data-papic-home-card={open ? 'open' : 'rest'}>
      <OneOpenScope id={oneOpenId}>
      <PapicHeadContext.Provider value={say}>
        <div className="sn-frame flex min-w-0 cursor-pointer flex-col gap-2.5 px-3.5 pb-0 pt-3 text-ink" onClick={onBody} {...marker}>
          <div className="flex min-w-0 items-center gap-2.5">
            {/* THE HEAD — a press of its own (keyboard and reader): it rises the settings, never another page. */}
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left"
              data-papic-card-head=""
              data-tour="home-papic-card"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink/[0.06] [&_svg]:h-5 [&_svg]:w-5" aria-hidden>
                {icon}
              </span>
              <span className="min-w-0 truncate text-[18px] font-bold leading-tight">{name}</span>
            </button>
            {/* THE SWITCH — the head's one dropdown, on the right, a sibling of the head's button. */}
            {headControl ? (
              <div className="shrink-0 [&_[data-form-row-name]]:sr-only [&_[data-form-row]]:!min-h-0 [&_[data-form-row]]:!p-0" data-papic-head-switch="">
                {headControl}
              </div>
            ) : null}
          </div>

          {saidLine !== null || headLine || brand ? (
            <p className="-mt-1 text-[13.5px] leading-snug text-ink/65 [text-wrap:balance]" data-papic-head-line="">
              {saidLine ?? headLine ?? brand}
            </p>
          ) : null}
          {saidProblem ? (
            <p role="alert" className="-mt-1 text-[12.5px] font-semibold leading-snug text-danger-700" data-papic-head-problem="">
              {saidProblem}
            </p>
          ) : null}

          {/* 🔢 ONE BIG NUMBER — the credits left; Total · Taken live in its ⓘ. */}
          {counts ? <PapicCounts total={counts.total} left={counts.left} /> : null}

          {/* Add photos (main) · Add more — two equal buttons, each a press of its own. */}
          {add || buy ? (
            <div className="grid grid-cols-2 gap-2 [&_.ab]:w-full [&_.ab]:justify-center" data-papic-card-acts="" data-papic-card-face="">
              {add ? (
                <span className="min-w-0" data-papic-card-add="">
                  {add}
                </span>
              ) : null}
              {buy ? (
                <span className={`min-w-0 ${add ? '' : 'col-span-2'}`} data-papic-card-add-more="">
                  {buy}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* "All Papic settings ›" — the full-width row that rises them (the › that unfolded the card until 20 Nov). */}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
            className="-mx-3.5 flex min-h-[46px] items-center gap-2 border-t border-ink/10 px-3.5 text-left text-[14.5px] font-semibold"
            data-papic-all-settings=""
          >
            <span className="min-w-0 flex-1 truncate">All {name} settings</span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.9} />
          </button>
        </div>

        {/* ⤴ EVERY PAPIC SETTING, RISEN FULL SCREEN — the shared part; "Shooting into" first, then the shipped settings
            in their own order. Drawn only while open. */}
        {open ? (
          <RiseScreen title={`${name} settings`} data="papic-settings" kind="stack" onClose={() => setOpen(false)}>
            <div role="region" aria-label={`${name} settings`} className="px-4 pt-2" data-papic-home-settings="open">
              {/* After the day, the Thank-You Video door leads (where a seat hands one — Memories' keepsake row is its home). */}
              {phase === 'after' && thankYouHref ? (
                <div className="sg-acts pb-2" data-papic-thank-you="">
                  <ActionButton tone="brand" icon={<Clapperboard aria-hidden="true" strokeWidth={1.9} />} label="Thank-You Video" href={thankYouHref} />
                </div>
              ) : null}
              {chapter ? <div data-papic-settings-first="">{chapter}</div> : null}
              <div className="pt-4">{settings}</div>
            </div>
          </RiseScreen>
        ) : null}
      </PapicHeadContext.Provider>
      </OneOpenScope>
    </div>
  );
}

/** "N credits left", big — Total · Taken in its ⓘ. A field that was not measured is "—", never 0. */
function PapicCounts({ total, left }: { total: number | null; left: number | null }) {
  const words = papicCountsWords(total, left);
  if (!words) {
    return (
      <div role="status" className="flex items-center gap-2" data-papic-card-counts="unread">
        <span className="text-[30px] font-bold leading-none tracking-[-0.01em]">—</span>
        <InfoTip label="credits left" labelClassName="text-[15px] font-medium text-ink/65" align="start">
          Couldn&rsquo;t check your credits just now. Nothing has changed — refresh to try again.
        </InfoTip>
      </div>
    );
  }
  const [all, taken, rest] = words.map(([, n]) => n) as [number, number, number];
  return (
    <div className="flex items-center gap-2" data-papic-card-counts="">
      <span className="text-[30px] font-bold leading-none tracking-[-0.01em]" data-papic-card-count="remaining">
        {formatCount(rest)}
      </span>
      <InfoTip label={rest === 1 ? 'credit left' : 'credits left'} labelClassName="text-[15px] font-medium text-ink/65" align="start">
        Total <b data-papic-card-count="total">{formatCount(all)}</b> · Taken <b data-papic-card-count="taken">{formatCount(taken)}</b>
      </InfoTip>
    </div>
  );
}
