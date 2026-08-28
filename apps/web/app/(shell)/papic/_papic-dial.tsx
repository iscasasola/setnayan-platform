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
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Fewer credits"
          disabled={at <= 0}
          onClick={() => setI((n) => Math.max(0, n - 1))}
          className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-[var(--m-line)] font-mono text-xl leading-none text-[var(--m-ink)] transition hover:border-[var(--m-mulberry)] hover:text-[var(--m-mulberry)] disabled:opacity-30 disabled:hover:border-[var(--m-line)] disabled:hover:text-[var(--m-ink)]"
        >
          −
        </button>

        <div className="min-w-0 flex-1">
          <span
            className={`block whitespace-nowrap font-mono text-3xl font-medium tracking-tight tabular-nums ${
              bought === 0 ? 'text-[var(--m-mulberry)]' : 'text-[var(--m-ink)]'
            }`}
          >
            {count(total)}
          </span>
          <span className="mt-0.5 block font-mono text-sm tabular-nums text-[var(--m-ink)]/60">
            credits{bought === 0 ? '' : ` · ${peso(rung.peso)}`}
          </span>
        </div>

        <button
          type="button"
          aria-label="More credits"
          disabled={at >= rungs.length - 1}
          onClick={() => setI((n) => Math.min(rungs.length - 1, n + 1))}
          className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-[var(--m-line)] font-mono text-xl leading-none text-[var(--m-ink)] transition hover:border-[var(--m-mulberry)] hover:text-[var(--m-mulberry)] disabled:opacity-30 disabled:hover:border-[var(--m-line)] disabled:hover:text-[var(--m-ink)]"
        >
          +
        </button>
      </div>

      {/* The stacking, said out loud. This is the line the owner corrected. */}
      <p className="mt-3.5 font-mono text-xs tabular-nums text-[var(--m-ink)]/60">
        {bought === 0 ? (
          <>
            <span className="text-[var(--m-orange-2)]">{count(freeCredits)}</span> free · nothing
            to pay
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

      <p className="mt-3 rounded-xl bg-[var(--m-ink)]/[0.035] px-3 py-2.5 text-left text-sm text-[var(--m-ink)]/70">
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
            {ideal.peso === 0 ? ' — free' : <> — <span className="font-mono tabular-nums">{peso(ideal.peso)}</span></>}. That
            is about {idealPerGuest} photographs from every guest.
          </>
        )}
      </p>

      <div className="mt-4 border-t border-[var(--m-line)] pt-3.5 text-left">
        <ul className="m-0 list-none p-0">
          <Row k="Photographs" v={count(total)} />
          {/* Derived from clipCost — never `total / 8`. A hand-written divisor
              is what shipped a ~2.9× overstatement past a green suite once. */}
          <Row k="Or ten-second videos" v={count(papicVideosAffordable(total, clipCost))} />
          <Row k="Cameras" v="unlimited" />
          <Row k="The live wall" v="included" />
        </ul>

        <div className="mt-3.5 border-t border-[var(--m-line)] pt-3 text-sm text-[var(--m-ink)]/70">
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
            <span className="flex-1 font-mono text-sm tabular-nums text-[var(--m-ink)]/70">
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
      <span className="flex-1 text-[var(--m-ink)]/70">{k}</span>
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
