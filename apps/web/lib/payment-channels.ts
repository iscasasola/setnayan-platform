/**
 * lib/payment-channels.ts — which manual payment rails are open, and how close
 * each is to its monthly receiving cap.
 *
 * Setnayan receives on PERSONAL GCash and BDO accounts (owner 2026-08-01: no
 * business account yet). A personal GCash wallet has a monthly RECEIVING limit
 * — ₱500,000 at the time of writing — and past it incoming transfers **fail
 * rather than queue**. GCash gives no warning inside the payment flow, so
 * without a meter the first signal is a couple reporting a bounced transfer.
 *
 * Two pieces, both pure so they can be unit-tested rather than eyeballed in
 * JSX:
 *   • channel availability  — what checkout may offer, and what the server
 *     will accept. Never trust the client's choice; `resolveChannel` is the
 *     shared decision both sides run.
 *   • cap usage             — the rolling-30-day figure behind the admin meter.
 */

export type PayChannel = 'gcash' | 'bdo';

export const PAY_CHANNELS: readonly PayChannel[] = ['gcash', 'bdo'] as const;

export const PAY_CHANNEL_LABEL: Record<PayChannel, string> = {
  gcash: 'GCash',
  bdo: 'BDO',
};

export function isPayChannel(v: unknown): v is PayChannel {
  return v === 'gcash' || v === 'bdo';
}

/** The subset of platform_settings this module needs. */
export type ChannelSettings = {
  gcash_enabled?: boolean | null;
  bdo_enabled?: boolean | null;
  gcash_number?: string | null;
  bdo_account_number?: string | null;
};

/**
 * Rails a couple may actually pay through.
 *
 * A channel is open only when the owner has left it ON **and** its account
 * details exist — an enabled channel with no account number would render a
 * payment panel with nothing to pay to.
 *
 * `undefined`/`null` on the flag reads as ENABLED, so a pre-migration database
 * behaves exactly as it did before this shipped. That direction matters: the
 * failure mode of guessing wrong here is a checkout with no payment options,
 * which is worse than one extra option.
 */
export function openChannels(settings: ChannelSettings): PayChannel[] {
  const open: PayChannel[] = [];
  if (settings.gcash_enabled !== false && settings.gcash_number?.trim()) {
    open.push('gcash');
  }
  if (settings.bdo_enabled !== false && settings.bdo_account_number?.trim()) {
    open.push('bdo');
  }
  return open;
}

/**
 * The channel to actually use, given what was requested.
 *
 * Returns null when NOTHING is open — a real state the owner can reach by
 * switching both rails off after both accounts hit their caps. We deliberately
 * do NOT force one back on: paying into a capped account fails at the bank, so
 * "payments are paused" is honest where a working-looking button is a lie.
 *
 * Both the checkout UI and the submit action call this, so a client that
 * posts a disabled channel is refused rather than obeyed.
 */
export function resolveChannel(
  requested: unknown,
  settings: ChannelSettings,
): PayChannel | null {
  const open = openChannels(settings);
  if (open.length === 0) return null;
  if (isPayChannel(requested) && open.includes(requested)) return requested;
  return open[0] ?? null;
}

export type CapBand = 'ok' | 'warn' | 'critical' | 'over';

/**
 * The month boundary is MANILA's, not the server's.
 *
 * Vercel runs in UTC, which is 8 hours behind Philippine time. Using the
 * server's own calendar would mean that for the first 8 hours of every month —
 * roughly midnight to 8am PHT on the 1st — Manila says September while the
 * server still says August.
 *
 * That window is not harmless. A balance the owner entered at 2am on the 1st
 * would be stamped as the PREVIOUS month, go stale hours later when UTC caught
 * up, and silently drop the meter back to cap mode — which reads HIGHER than
 * the truth. Failing toward "you have more room than you do" is the one
 * direction that costs a bounced transfer.
 *
 * `en-CA` is used purely because it formats as YYYY-MM-DD, which sorts and
 * slices correctly; the locale is not user-facing.
 */
const PH_TIME_ZONE = 'Asia/Manila';

const PH_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: PH_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `d` as a Manila-local calendar date, `YYYY-MM-DD`. */
export function phDateISO(d: Date): string {
  return PH_DATE_FMT.format(d);
}

/** Same calendar month in Manila? Drives the monthly reset. */
export function inSameCalendarMonth(a: Date, b: Date): boolean {
  return phDateISO(a).slice(0, 7) === phDateISO(b).slice(0, 7);
}

/** First day of `now`'s Manila calendar month, as `YYYY-MM-DD`. */
export function monthStartISO(now: Date): string {
  return `${phDateISO(now).slice(0, 7)}-01`;
}

export type HeadroomSource = 'owner_balance' | 'cap';

export type ChannelHeadroom = {
  /** Pesos this account can still receive before the bank starts refusing. */
  remainingPhp: number;
  /** What the remaining figure was measured against. */
  startingPhp: number;
  /** Setnayan inflow deducted from `startingPhp`. */
  deductedPhp: number;
  /**
   * 'owner_balance' — the owner typed a real balance THIS month, so the number
   *                   accounts for their personal transfers up to that moment.
   * 'cap'           — no usable override; measured against the monthly ceiling
   *                   and therefore OPTIMISTIC, since personal transfers are
   *                   invisible to us.
   */
  source: HeadroomSource;
  /** 0–100+, share of `startingPhp` consumed. Not clamped. */
  pct: number;
  band: CapBand;
};

/**
 * How much room is left on this rail.
 *
 * Two modes, and the difference matters:
 *
 *   • OWNER BALANCE — the owner opened GCash, read the real remaining
 *     headroom and typed it in. Everything received before that instant is
 *     already baked into the number, so we deduct only Setnayan payments
 *     recorded AFTER `availableAsOf`. Deducting from the month start instead
 *     would double-count every order the owner's own reading already included.
 *
 *   • CAP — no override for this month. We measure Setnayan inflow since the
 *     month began against the ceiling. This is the optimistic mode: the bank
 *     counts personal transfers too and we cannot see them, so the true
 *     remaining figure is always LOWER than this says.
 *
 * The monthly reset is derived, never scheduled: an override from last month
 * simply fails `inSameCalendarMonth` and the cap takes over. No cron to fail
 * silently at midnight on the 1st.
 *
 * Returns null when there is nothing to measure against — "unknown" must not
 * render as "fine", and a 0%-used meter would say exactly that.
 */
export function channelHeadroom(args: {
  capPhp: number | null | undefined;
  availablePhp: number | null | undefined;
  availableAsOf: string | Date | null | undefined;
  /** Setnayan inflow since `availableAsOf`. */
  inflowSinceAsOfPhp: number;
  /** Setnayan inflow since the start of `now`'s calendar month. */
  inflowThisMonthPhp: number;
  now: Date;
}): ChannelHeadroom | null {
  const asOf =
    args.availableAsOf == null
      ? null
      : args.availableAsOf instanceof Date
        ? args.availableAsOf
        : new Date(args.availableAsOf);
  const asOfUsable =
    asOf != null &&
    !Number.isNaN(asOf.getTime()) &&
    inSameCalendarMonth(asOf, args.now) &&
    args.availablePhp != null &&
    Number.isFinite(args.availablePhp) &&
    args.availablePhp >= 0;

  const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

  let startingPhp: number;
  let deductedPhp: number;
  let source: HeadroomSource;

  if (asOfUsable) {
    startingPhp = Number(args.availablePhp);
    deductedPhp = nonNegative(args.inflowSinceAsOfPhp);
    source = 'owner_balance';
  } else {
    if (args.capPhp == null || !Number.isFinite(args.capPhp) || args.capPhp <= 0) {
      return null;
    }
    startingPhp = Number(args.capPhp);
    deductedPhp = nonNegative(args.inflowThisMonthPhp);
    source = 'cap';
  }

  // A zero starting balance is legitimate — the owner may have typed 0 because
  // the wallet is full. Guard the division rather than the state.
  const pct = startingPhp > 0 ? (deductedPhp / startingPhp) * 100 : 100;
  const band: CapBand =
    pct >= 100 ? 'over' : pct >= 90 ? 'critical' : pct >= 75 ? 'warn' : 'ok';

  return {
    remainingPhp: startingPhp - deductedPhp,
    startingPhp,
    deductedPhp,
    source,
    pct,
    band,
  };
}

/**
 * What the admin meter says.
 *
 * ⚠ The wording turns on `source`, and that is the whole point. Measured
 * against the CAP the figure is a FLOOR — the bank counts the owner's personal
 * transfers and we cannot see them — so the copy must say so or the number
 * will be trusted right up until a transfer bounces. Measured against a
 * balance the owner typed THIS month, it is trustworthy up to that reading,
 * and the copy says that instead.
 */
export function headroomMessage(h: ChannelHeadroom, channelLabel: string): string {
  const peso = (n: number) =>
    `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (h.source === 'cap') {
    const tail =
      'Measured against the monthly cap and Setnayan orders only — your personal transfers count toward the same limit, so the real remaining figure is LOWER. Update the available balance for an accurate number.';
    if (h.band === 'over' || h.band === 'critical') {
      return `${channelLabel}: about ${peso(h.remainingPhp)} left. ${tail}`;
    }
    return `${channelLabel}: about ${peso(h.remainingPhp)} left. ${tail}`;
  }

  const asOfNote = `counting ${peso(h.deductedPhp)} of Setnayan orders since you last checked`;
  switch (h.band) {
    case 'over':
      return `${channelLabel} has no room left — ${asOfNote}. Transfers are likely being refused. Switch this rail off.`;
    case 'critical':
      return `${channelLabel}: ${peso(h.remainingPhp)} left, ${asOfNote}. One more order could exhaust it.`;
    default:
      return `${channelLabel}: ${peso(h.remainingPhp)} left, ${asOfNote}. Re-check the app and update this to stay accurate.`;
  }
}
