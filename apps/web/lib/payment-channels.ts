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

export type CapUsage = {
  receivedPhp: number;
  capPhp: number;
  /** 0–100+, not clamped — being 130% over is worth seeing. */
  pct: number;
  band: CapBand;
};

/**
 * Where this account sits against its monthly cap.
 *
 * Bands are deliberately conservative: 'critical' starts at 90%, not 99%,
 * because a single ₱27,999 order can cross the remaining 10% of a ₱500,000
 * cap in one step. A meter that only turns red once you are already over is
 * a report, not a warning.
 *
 * Returns null when no cap is configured — "unknown" must not render as
 * "fine", and a 0% meter would say fine.
 */
export function capUsage(
  receivedPhp: number,
  capPhp: number | null | undefined,
): CapUsage | null {
  if (capPhp == null || !Number.isFinite(capPhp) || capPhp <= 0) return null;
  const received = Number.isFinite(receivedPhp) && receivedPhp > 0 ? receivedPhp : 0;
  const pct = (received / capPhp) * 100;
  const band: CapBand =
    pct >= 100 ? 'over' : pct >= 90 ? 'critical' : pct >= 75 ? 'warn' : 'ok';
  return { receivedPhp: received, capPhp, pct, band };
}

/**
 * What the admin meter says.
 *
 * ⚠ The wording is careful on purpose. We can only count money that came
 * through a Setnayan order, but the CAP applies to everything the account
 * receives — including the owner's personal transfers. So our figure is a
 * FLOOR, never the true total, and the copy must never imply otherwise or it
 * will be trusted right up until a payment bounces.
 */
export function capMessage(usage: CapUsage, channelLabel: string): string {
  const pct = Math.round(usage.pct);
  switch (usage.band) {
    case 'over':
      return `${channelLabel} is at ${pct}% of its monthly cap from Setnayan orders alone. Incoming transfers may already be failing — switch this rail off.`;
    case 'critical':
      return `${channelLabel} is at ${pct}% of its monthly cap from Setnayan orders alone, and personal transfers count too. One more order could cross it.`;
    case 'warn':
      return `${channelLabel} is at ${pct}% of its monthly cap from Setnayan orders alone. Personal transfers count toward the same limit.`;
    case 'ok':
      return `${channelLabel} is at ${pct}% of its monthly cap from Setnayan orders. Personal transfers count toward the same limit, so the real figure is higher.`;
  }
}
