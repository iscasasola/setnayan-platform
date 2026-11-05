'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useOneOpen } from '@/lib/one-open';
import { ExplainNote, ExplainPopup, loadExplainOpen as loadOpen } from './explain-lazy';

/**
 * ⓘ EXPLANATION — the longer "what is this", behind its own small button (`INTERACTION_RULES.md` § 9, kind 7;
 * approved gallery `prototypes/control_templates_2026-10-08.html` § 7).
 *
 * Owner, 2026-10-08: *"explanation on what you show is for desktop / there is an appropriate info like a center
 * screen popup?"* · on the Page card: *"a small (i) that will give a more detailed explanation"*.
 *
 *   · ITS OWN 44-PX TARGET, beside the thing it explains — never inside another button (a tap on it must not also
 *     press the row or open the card);
 *   · ON A PHONE: a popup in the centre of the screen with ONE button, "Got it". The pop-up rule holds — the rest of
 *     the screen is dark and blurred (`.sn-popup-dark`), nothing behind it works (`inertBehind`), the page behind
 *     does not scroll and Esc closes (`useModalA11y`), and a tap on the dark closes it;
 *   · ON A COMPUTER: a small note under the ⓘ, attached to it — it does not darken the page. A press anywhere else,
 *     or Esc, closes it;
 *   · ONE OPEN AT A TIME (`useOneOpen`): opening one closes any other explanation, dropdown or fold's peer.
 *
 * Only for what a person does NOT need in order to act. Costs, dates, errors and consequences stay on the page.
 *
 * 🎯 THE MARK IS THE HOUSE ⓘ, CLASS FOR CLASS — `<InfoTip>`'s drawn circle (16 px, an ink/25 hairline, a 10-px
 * semibold ink/55 "i"). Open or hovered it turns the app's accent `sn-accent` where InfoTip turns `terracotta`: a
 * template names no colour (`the-form-row.test.ts` (10)), and this one only draws on the app's own pages, where the
 * two are the app's "on". Owner, 2026-10-25, on the Suppliers page's
 * "Cover your event": *"and the (i) is not consistent across the app"* — this mark was a 22-px white disc with an
 * ACCENT "i" while every InfoTip beside it was grey ink. One look now; only the behaviour differs (a 44-px button and
 * a popup here, a hover note there). Held by `app/_components/there-is-one-info-dot.test.ts`.
 * (`InfoTip` is the older `(i)` — a hover note that prints its own label; a screen moves to this one when it moves
 * onto the templates.)
 */

/**
 * ⚡ WHAT OPENS LOADS ON THE FIRST PRESS (2026-11-01, PR #7142). The ⓘ is drawn on most screens and opened on few: its
 * popup and its note (`explain-open.tsx` — the portal, the dark, the modal contract, the placement) are code nobody
 * needs until the press, so they are their own chunk (stand-ins in `explain-lazy.tsx`), warmed the moment a finger or pointer comes down on the ⓘ and
 * never drawn by the server (they only exist after a press). The mark itself — the house "i" — stays here, drawn with
 * the page. Measured: with the Field template on more screens, the ⓘ's whole code in every first load put the Event
 * Hub Maker 0.3 KB over its budget (`check-maker-js-budget.mjs`).
 */

/** A phone's width — the same line the Maker's sheet and every `PickMenu` draw (below `lg`). */
export const EXPLAIN_PHONE_QUERY = '(max-width: 1023.98px)';
/** The desktop note's width. */
export const EXPLAIN_NOTE_WIDTH = 280;

/** How an explanation opens at this width: the centred popup on a phone, the attached note on a computer. */
export function explainOpensAs(viewportWidth: number): 'popup' | 'note' {
  return viewportWidth < 1024 ? 'popup' : 'note';
}

export function Explain({
  title,
  children,
  label,
  className = '',
  data,
}: {
  /** The popup's heading — the name of the thing explained ("Look", "Event name"). */
  title: string;
  /** The explanation: a sentence or three, plain words. */
  children: ReactNode;
  /** The button's name for a screen reader. Defaults to "About <title>". */
  label?: string;
  className?: string;
  /** `data-explain="<data>"`. */
  data?: string;
}) {
  const [open, setOpen] = useState<'popup' | 'note' | null>(null);
  useOneOpen(open !== null, () => setOpen(null));
  const btn = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(null);
  return (
    <>
      <button
        ref={btn}
        type="button"
        data-explain={data ?? ''}
        aria-label={label ?? `About ${title}`}
        aria-haspopup="dialog"
        aria-expanded={open !== null}
        onPointerDown={() => void loadOpen()}
        onFocus={() => void loadOpen()}
        onClick={() => setOpen((o) => (o ? null : explainOpensAs(window.innerWidth)))}
        className={`sn-press group/explain inline-flex h-11 w-11 flex-none items-center justify-center rounded-full ${className}`}
      >
        <span
          aria-hidden
          className="sn-press-ring inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 transition-all duration-sn-control ease-sn group-hover/explain:border-sn-accent group-hover/explain:text-sn-accent group-aria-expanded/explain:border-sn-accent group-aria-expanded/explain:text-sn-accent"
        >
          i
        </span>
      </button>
      {open === 'popup' ? (
        <ExplainPopup title={title} onClose={close}>
          {children}
        </ExplainPopup>
      ) : open === 'note' ? (
        <ExplainNote title={title} anchor={btn} onClose={close}>
          {children}
        </ExplainNote>
      ) : null}
    </>
  );
}
