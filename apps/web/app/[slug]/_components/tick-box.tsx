import type { InputHTMLAttributes } from 'react';

/**
 * ☑ THE HOUSE TICK BOX — one drawing for every affirmative tick a guest gives: the Terms tick on Send
 * (`terms-tick.tsx`) and the reply's "They're coming" under a +1's name (`rsvp-plus-ones.tsx`). Controller's call on
 * the owner's 2026-10-25 "make sure to follow the rules and design templates": the two share ONE piece, so a fix to
 * one is a fix to both.
 *
 *  - A 20px painted box inside a 44×44 press. The input is the one real, focusable checkbox — it only fills the press,
 *    invisible (`appearance-none`); `press` takes the extra room back so the words sit where they sat.
 *  - 🌙 THE FILL IS THE PAGE'S OWN PAPER (`TICK_BOX_FILL`), never a white square: on a dark Event Hub (candlelight)
 *    the empty box was a bright white tile on black. `bg-cream` IS the paper token — white on the light page, the dark
 *    stock in candlelight (`--color-cream` follows `--color-paper` there).
 *  - Ticked: the event's accent (`terracotta`, which a dark look re-points at its gild) with a white check.
 *  - Never ticked by this piece: `checked` / `defaultChecked` are the caller's, and the house never pre-ticks consent.
 *
 * No hooks and no `'use client'`: it renders inside the server-drawn Terms line and inside client components as-is.
 * Keep `>` out of these class lists — guards find the input by `[^>]*`.
 */
export const TICK_BOX_FILL = 'bg-cream';

export function TickBox({ press, ...input }: { press: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>) {
  return (
    <span className={`relative ${press} flex h-11 w-11 shrink-0 items-center justify-center`} data-tick-box="">
      <input {...input} type="checkbox" className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none" />
      <span
        aria-hidden="true"
        className={`pointer-events-none h-5 w-5 rounded-sm border-[1.5px] border-ink/50 ${TICK_BOX_FILL} peer-checked:border-terracotta peer-checked:bg-terracotta peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mulberry`}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute inset-0 m-auto hidden h-5 w-5 text-white peer-checked:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5.5 10.5 3 3 6-6.5" />
      </svg>
    </span>
  );
}
