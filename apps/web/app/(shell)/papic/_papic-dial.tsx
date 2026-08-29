'use client';

/**
 * THE CREDIT DIAL — one + and one −, in place of sixteen price rows.
 *
 * Owner, 2026-08-29: *"instead of showing the 16 different pricing tiers, we
 * show +- and show what they can have"*, and then the correction that decides
 * every number in here: *"50 credits. 50 pesos become 150 credits because it
 * has a free 50 credits already."*
 *
 * ── THE ARITHMETIC RULE ───────────────────────────────────────────────────
 * The free grant is not rung zero and it is not an alternative to buying. It
 * is ALWAYS THERE and it ALWAYS STACKS, so the big number is what the
 * celebration HOLDS (`bought + free`), never what the money bought. Every
 * derived line below reads that total. Getting this backwards understates
 * every rung on the page by the size of the free grant.
 *
 * ── NOTHING HERE IS TYPED ─────────────────────────────────────────────────
 * `rungs`, `freeCredits` and `clipCost` all arrive from the caller, which reads
 * them out of the admin-owned tables. `lib/papic-copy-guardrails.test.ts` fails
 * CI if a Papic display surface grows a literal photo count, clip count or cap
 * figure — and this file is on its list. Do not hand-write a number, and do not
 * divide a credit total by a literal: derive from `clipCost`.
 *
 * ⚠ `idealPerGuest` IS THE ONE NUMBER THAT IS NOT READ OUT OF THE PRODUCT, and
 * it is deliberately a single prop rather than a table read, because the
 * product has no opinion to read yet. See the note at its call site.
 */

import { useState } from 'react';
import { papicCreditsHeld, papicVideosAffordable } from '@/lib/papic-credits-held';

export type PapicRung = {
  /** Peso price of this rung, from the ACTIVE customer catalog. */
  peso: number;
  /** Credits the money buys, from `papic_pass_tiers`. The free grant is added on top. */
  bought: number;
  /**
   * What it costs while the celebration is being set up, or null when there is
   * no real saving. Resolved by the SAME function the charge uses — never
   * computed here, so this card cannot quote a price checkout will not honour.
   */
  setupPeso: number | null;
};

const peso = (n: number) => '₱' + n.toLocaleString('en-PH');
const count = (n: number) => n.toLocaleString('en-PH');

/** Guest-count steps for the "spread across the room" line. */
const GUEST_STEP = 25;
const GUEST_MIN = 25;
const GUEST_MAX = 600;

export function PapicDial({
  rungs,
  freeCredits,
  clipCost,
  idealPerGuest,
}: {
  rungs: readonly PapicRung[];
  freeCredits: number;
  /** Credits a ten-second clip costs — the top band, derived, never typed. */
  clipCost: number;
  /** How many photographs a guest is assumed to take. Owner-tunable. */
  idealPerGuest: number;
}) {
  // Start at "buy nothing". The free grant is the page's lead, so the dial
  // opens on it rather than on a price.
  const [i, setI] = useState(0);
  const [guests, setGuests] = useState(150);

  if (rungs.length === 0) return null;

  const at = Math.min(i, rungs.length - 1);
  const rung = rungs[at]!;
  const bought = rung.bought;
  const total = papicCreditsHeld(bought, freeCredits);

  // The recommendation: the smallest rung that clears "every guest takes about
  // N photographs". Marked on the gauge so the dial has an opinion rather than
  // presenting sixteen equivalent choices.
  const want = guests * idealPerGuest;
  const idealIdx = (() => {
    const hit = rungs.findIndex((r) => papicCreditsHeld(r.bought, freeCredits) >= want);
    return hit < 0 ? rungs.length - 1 : hit;
  })();
  const ideal = rungs[idealIdx]!;
  const onIdeal = at === idealIdx;

  const each = total / guests;
  const nice = each >= 10 ? Math.round(each) : Math.round(each * 10) / 10;
  const pct = rungs.length > 1 ? (at / (rungs.length - 1)) * 100 : 0;
  const idealPct = rungs.length > 1 ? (idealIdx / (rungs.length - 1)) * 100 : 0;

  return (
    <div className="rounded-2xl border border-[var(--m-line)] px-4 py-6 text-center sm:px-6">
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        <button
          type="button"
          aria-label="Fewer credits"
          disabled={at <= 0}
          onClick={() => setI((n) => Math.max(0, n - 1))}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[var(--m-line)] font-mono text-xl leading-none sm:h-12 sm:w-12 text-[var(--m-ink)] transition hover:border-[var(--m-mulberry)] hover:text-[var(--m-mulberry)] disabled:opacity-30 disabled:hover:border-[var(--m-line)] disabled:hover:text-[var(--m-ink)]"
        >
          −
        </button>

        {/*
          ⚠ THE UNIT IS BOUND TO THE NUMBER, ON ONE BASELINE, ON PURPOSE.
          It used to be a bare "50,050" with "credits · ₱11,200" underneath, and
          the owner read the big number as PESOS — reasonably, because on a
          section headed "What it costs" a large lone numeral is a price. Two
          rules come out of that and both must hold:
            1. the count NEVER appears without the word "credits" beside it, and
            2. the peso sign appears EXACTLY ONCE on this card, on the pay row
               below — so the only thing shaped like money IS the money.
        */}
        <div className="min-w-0 flex-1">
          <span
            className={`flex items-baseline justify-center gap-1.5 whitespace-nowrap font-mono font-medium tracking-tight tabular-nums ${
              bought === 0 ? 'text-[var(--m-mulberry)]' : 'text-[var(--m-ink)]'
            }`}
          >
            <span className="text-2xl sm:text-3xl">{count(total)}</span>
            <span className="text-sm font-normal text-[var(--m-slate-2)] sm:text-base">credits</span>
          </span>
          <span className="mt-1 block text-xs text-[var(--m-slate-2)]">
            {bought === 0 ? 'in every celebration' : 'in your celebration'}
          </span>
        </div>

        <button
          type="button"
          aria-label="More credits"
          disabled={at >= rungs.length - 1}
          onClick={() => setI((n) => Math.min(rungs.length - 1, n + 1))}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[var(--m-line)] font-mono text-xl leading-none sm:h-12 sm:w-12 text-[var(--m-ink)] transition hover:border-[var(--m-mulberry)] hover:text-[var(--m-mulberry)] disabled:opacity-30 disabled:hover:border-[var(--m-line)] disabled:hover:text-[var(--m-ink)]"
        >
          +
        </button>
      </div>

      {/*
        THE PAY ROW — the only currency on this card.

        Owner, 2026-08-29: *"we show them the Regular price crossed out and the
        discounted on boarding price to be available."*

        ⚠ THE SAVING IS CONDITIONAL AND THE PAGE SAYS SO. It is the set-up
        price — his own rule, 2026-08-28: *"we give them a 10% discount if they
        purchase now. They can order later, but they will lose the 10%
        discount."* A struck-through price with no condition attached reads as a
        permanent sale, which would be false the moment somebody tops up later.
      */}
      {bought === 0 ? (
        <p className="mt-4 flex items-baseline justify-center gap-2 text-sm">
          <span className="text-[var(--m-slate-2)]">You pay</span>
          <span className="font-mono text-lg font-medium tabular-nums text-[var(--m-ink)]">
            nothing
          </span>
        </p>
      ) : rung.setupPeso !== null ? (
        <>
          <p className="mt-4 flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1 text-sm">
            <span className="text-[var(--m-slate-2)]">You pay</span>
            <s className="font-mono tabular-nums text-[var(--m-slate-2)] decoration-[var(--m-slate-2)]">
              {peso(rung.peso)}
            </s>
            <span className="font-mono text-lg font-medium tabular-nums text-[var(--m-mulberry)]">
              {peso(rung.setupPeso)}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--m-slate-2)]">
            while you are setting your celebration up
          </p>
        </>
      ) : (
        <p className="mt-4 flex items-baseline justify-center gap-2 text-sm">
          <span className="text-[var(--m-slate-2)]">You pay</span>
          <span className="font-mono text-lg font-medium tabular-nums text-[var(--m-ink)]">
            {peso(rung.peso)}
          </span>
        </p>
      )}

      {/* The stacking, said out loud. This is the line the owner corrected. */}
      <p className="mt-2 font-mono text-xs tabular-nums text-[var(--m-slate-2)]">
        {bought === 0 ? (
          <>
            <span className="text-[var(--m-orange-2)]">{count(freeCredits)}</span> free on
            every celebration
          </>
        ) : (
          <>
            {count(bought)} bought &nbsp;+&nbsp;{' '}
            <span className="text-[var(--m-orange-2)]">{count(freeCredits)}</span> free
            &nbsp;=&nbsp; {count(total)}
          </>
        )}
      </p>

      <div className="relative mx-1.5 mt-4 h-[3px] rounded-sm bg-[var(--m-line)]">
        <span
          className="block h-full rounded-sm bg-[var(--m-orange-2)] transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
        <i
          aria-hidden
          className="absolute -top-1 h-[11px] w-[2px] -translate-x-px rounded-sm bg-[var(--m-mulberry)]"
          style={{ left: `${idealPct}%` }}
        />
      </div>

      <p className="mt-3 rounded-xl bg-[rgb(44_42_41/0.04)] px-3 py-2.5 text-left text-sm text-[var(--m-slate-2)]">
        {onIdeal ? (
          <>
            <b className="font-semibold text-[var(--m-ink)]">
              This is the one most celebrations your size want.
            </b>{' '}
            Enough for every one of {count(guests)} guests to take about {idealPerGuest}{' '}
            photographs.
          </>
        ) : (
          <>
            For {count(guests)} guests we would point you at{' '}
            <b className="font-mono font-semibold tabular-nums text-[var(--m-ink)]">
              {count(papicCreditsHeld(ideal.bought, freeCredits))} credits
            </b>
            {ideal.peso === 0 ? (
              ' — free'
            ) : (
              <>
                {' — '}
                <span className="font-mono tabular-nums">
                  {peso(ideal.setupPeso ?? ideal.peso)}
                </span>
                {ideal.setupPeso !== null ? ' while you set up' : ''}
              </>
            )}. That
            is about {idealPerGuest} photographs from every guest.
          </>
        )}
      </p>

      {/*
        THE FEAR THIS ANSWERS, and why it sits INSIDE the dial rather than under
        it. Owner, 2026-08-29: "not enough, you can always upgrade anytime
        during the event if you feel you need to increase more credits for this
        event." Choosing an amount is the one moment on this page where somebody
        can be wrong and know it — so the answer has to be where the choosing
        happens, not in a footnote below the card.

        Every clause is true of the shipped product: a top-up is its own
        purchase, it STACKS on whatever the celebration already holds (the same
        `papicCreditsHeld` rule this card runs on), and it lands during the
        party rather than at the next renewal, because there is no renewal.
      */}
      <p className="mt-3.5 rounded-xl border border-[rgb(138_107_57/0.30)] bg-[rgb(138_107_57/0.07)] px-3 py-2.5 text-left text-sm text-[var(--m-slate-2)]">
        <b className="font-semibold text-[var(--m-ink)]">Not enough? Add more any time.</b>{' '}
        You are never locked into what you pick now — top up in the middle of the party if the
        night is going well, and the new credits land in seconds on top of what you already have.
      </p>

      <div className="mt-4 border-t border-[var(--m-line)] pt-3.5 text-left">
        <ul className="m-0 list-none p-0">
          <Row k="Photographs" v={count(total)} />
          {/* Derived from clipCost — never `total / 8`. A hand-written divisor
              is what shipped a ~2.9× overstatement past a green suite once. */}
          <Row k="Or Snippets" v={count(papicVideosAffordable(total, clipCost))} />
          <Row k="Cameras" v="unlimited" />
          <Row k="The live wall" v="included" />
        </ul>

        <div className="mt-3.5 border-t border-[var(--m-line)] pt-3 text-sm text-[var(--m-slate-2)]">
          <p className="m-0">
            {bought === 0
              ? 'Enough to see exactly how it works, on the day or long before it.'
              : `Spread across the room, that is about ${nice} ${
                  nice === 1 ? 'photograph' : 'photographs'
                } a guest.`}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <Mini
              label="Fewer guests"
              disabled={guests <= GUEST_MIN}
              onClick={() => setGuests((g) => Math.max(GUEST_MIN, g - GUEST_STEP))}
            >
              −
            </Mini>
            <span className="flex-1 font-mono text-sm tabular-nums text-[var(--m-slate-2)]">
              {count(guests)} guests
            </span>
            <Mini
              label="More guests"
              disabled={guests >= GUEST_MAX}
              onClick={() => setGuests((g) => Math.min(GUEST_MAX, g + GUEST_STEP))}
            >
              +
            </Mini>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex items-baseline gap-3 py-1.5 text-sm">
      <span className="flex-1 text-[var(--m-slate-2)]">{k}</span>
      <span className="whitespace-nowrap font-mono text-sm tabular-nums text-[var(--m-ink)]">
        {v}
      </span>
    </li>
  );
}

function Mini({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[var(--m-line)] font-mono text-sm leading-none text-[var(--m-ink)] transition hover:border-[var(--m-mulberry)] hover:text-[var(--m-mulberry)] disabled:opacity-30 disabled:hover:border-[var(--m-line)] disabled:hover:text-[var(--m-ink)]"
    >
      {children}
    </button>
  );
}
