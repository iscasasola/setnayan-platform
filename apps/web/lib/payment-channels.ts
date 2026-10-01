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
 *
 * ── THE RAILS ARE A LIST NOW (owner, 2026-10-01) ─────────────────────────────
 * *"Changing or Adding Payment Options in the future like our bank account as
 * a couple or add a mari bank or uno bank, is possible?"* It is. Setnayan's
 * receiving accounts live in `platform_settings.receiving_accounts` (migration
 * `…_receiving_accounts_are_a_list`): the admin adds, edits, re-orders and
 * removes them, and checkout shows them in that order. The two fixed rails the
 * list replaced keep their ids — `'gcash'` and `'bdo'` — so every
 * `payments.channel` already written, and the monthly-cap meter keyed on those
 * two, still reads.
 *
 * 🔑 STILL ONE RULE. Every question this module answered about two rails it
 * answers about the list, through the same functions — `openChannels`,
 * `isChannelOpen`, `resolveChannel`, `openRailDetails`. A surface asks here,
 * never the list directly and never the old columns.
 */

/** A rail is one of Setnayan's receiving accounts, named by its id. */
export type PayChannel = string;

/**
 * The two rails the list replaced, in the order checkout always showed them.
 * They are also the ONLY ids with a monthly-cap meter (the cap columns exist
 * for these two alone).
 */
export const PAY_CHANNELS = ['gcash', 'bdo'] as const;

/** Bank (transfer to an account) or e-wallet (send to a number). */
export type AccountKind = 'bank' | 'ewallet';

export type ReceivingAccount = {
  /** Stable id — `payments.channel` stores it. 'gcash' / 'bdo' for the two migrated rails. */
  id: PayChannel;
  kind: AccountKind;
  /** What the payer reads: "GCash", "BDO", "Maribank", "UNO". */
  label: string;
  accountName: string | null;
  number: string | null;
  /** The uploaded static QR image (carries no amount). */
  qrUrl: string | null;
  /** Its decoded QR Ph payload, re-minted per order with the amount (lib/emv-qr.ts). */
  qrPayload: string | null;
  /** The kill switch. Off = offered nowhere, its number printed nowhere. */
  enabled: boolean;
};

/** An open rail as a "Pay with" picker needs it: the id to post, the label to show. */
export type OpenRail = { id: PayChannel; label: string };

const ACCOUNT_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Shaped like an account id. Whether it is OPEN is `isChannelOpen`'s question. */
export function isPayChannel(v: unknown): v is PayChannel {
  return typeof v === 'string' && ACCOUNT_ID_RE.test(v);
}

/** The subset of platform_settings this module needs. */
export type ChannelSettings = {
  /** The list (jsonb). Absent, empty or unreadable ⇒ the legacy columns below. */
  receiving_accounts?: unknown;
  gcash_enabled?: boolean | null;
  bdo_enabled?: boolean | null;
  gcash_number?: string | null;
  bdo_account_number?: string | null;
  gcash_account_name?: string | null;
  bdo_account_name?: string | null;
  // 🔑 A QR IS SOMETHING TO PAY TO. These were missing, and their absence is
  // why three payment surfaces could not use this function: they show a rail
  // that has a QR and no typed number, so delegating here would have hidden a
  // payable rail. Widening the ONE rule is the fix; a second "is it open?"
  // helper alongside it would be the disease this module exists to prevent.
  gcash_qr_url?: string | null;
  bdo_qr_url?: string | null;
  gcash_qr_payload?: string | null;
  bdo_qr_payload?: string | null;
};

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, max) : null;
}

/**
 * Read the stored list. A malformed entry is DROPPED, never guessed at: one
 * without a usable id or label cannot be posted back or shown, and a duplicate
 * id would make two accounts answer to one `payments.channel`.
 */
export function parseReceivingAccounts(raw: unknown): ReceivingAccount[] {
  if (!Array.isArray(raw)) return [];
  const out: ReceivingAccount[] = [];
  const seen = new Set<string>();
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const label = text(r.label, 40);
    if (!ACCOUNT_ID_RE.test(id) || !label || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      kind: r.kind === 'bank' ? 'bank' : 'ewallet',
      label,
      accountName: text(r.account_name, 120),
      number: text(r.number, 64),
      qrUrl: text(r.qr_url, 2048),
      qrPayload: text(r.qr_payload, 2048),
      // Only an explicit `false` closes an account — the same fail-open
      // direction the two legacy switches have always had.
      enabled: r.enabled !== false,
    });
  }
  return out;
}

/** The list back into its stored (snake_case) shape. */
export function serializeReceivingAccounts(
  list: readonly ReceivingAccount[],
): Array<Record<string, string | boolean | null>> {
  return list.map((a) => ({
    id: a.id,
    kind: a.kind,
    label: a.label,
    account_name: a.accountName,
    number: a.number,
    qr_url: a.qrUrl,
    qr_payload: a.qrPayload,
    enabled: a.enabled,
  }));
}

/**
 * The two fixed rails, as a list — exactly what checkout showed before the
 * list existed.
 *
 * 🔑 THE FALLBACK THE OWNER ASKED FOR: checkout keeps working when the list is
 * empty and never says "no way to pay" because of it. A database the
 * migration has not reached, a refused read of the new column, or an empty
 * list all land here and pay exactly as they did on 2026-09-30.
 */
export function legacyReceivingAccounts(s: ChannelSettings): ReceivingAccount[] {
  return [
    {
      id: 'gcash',
      kind: 'ewallet',
      label: 'GCash',
      accountName: text(s.gcash_account_name, 120),
      number: text(s.gcash_number, 64),
      qrUrl: text(s.gcash_qr_url, 2048),
      qrPayload: text(s.gcash_qr_payload, 2048),
      enabled: s.gcash_enabled !== false,
    },
    {
      id: 'bdo',
      kind: 'bank',
      label: 'BDO',
      accountName: text(s.bdo_account_name, 120),
      number: text(s.bdo_account_number, 64),
      qrUrl: text(s.bdo_qr_url, 2048),
      qrPayload: text(s.bdo_qr_payload, 2048),
      enabled: s.bdo_enabled !== false,
    },
  ];
}

/** Is the stored list in charge, or are we on the legacy fallback? */
export function usesAccountList(s: ChannelSettings): boolean {
  return parseReceivingAccounts(s.receiving_accounts).length > 0;
}

/** Every receiving account, in the order the admin set — or the legacy two. */
export function receivingAccounts(s: ChannelSettings): ReceivingAccount[] {
  const list = parseReceivingAccounts(s.receiving_accounts);
  return list.length > 0 ? list : legacyReceivingAccounts(s);
}

/** Something to pay to — a number or a QR. */
function payableAccount(a: ReceivingAccount): boolean {
  return Boolean(a.number?.trim() || a.qrUrl?.trim());
}

/**
 * The accounts a payer may be shown, in the admin's order.
 *
 * Open = switched ON **and** something to pay to. An enabled account with no
 * number and no QR would render a payment panel with nothing to pay to.
 */
export function openAccounts(s: ChannelSettings): ReceivingAccount[] {
  return receivingAccounts(s).filter((a) => a.enabled && payableAccount(a));
}

/**
 * Rails a payer may actually pay through, by id, in the admin's order.
 *
 * `undefined`/`null` on a legacy flag reads as ENABLED, so a pre-migration
 * database behaves exactly as it did before this shipped. That direction
 * matters: the failure mode of guessing wrong here is a checkout with no
 * payment options, which is worse than one extra option.
 */
export function openChannels(settings: ChannelSettings): PayChannel[] {
  return openAccounts(settings).map((a) => a.id);
}

/** The open rails as a "Pay with" picker needs them. */
export function openRailOptions(settings: ChannelSettings): OpenRail[] {
  return openAccounts(settings).map((a) => ({ id: a.id, label: a.label }));
}

/** What to call a rail. An id no longer in the list says its id. */
export function channelLabel(settings: ChannelSettings, id: string | null | undefined): string {
  if (!id) return '—';
  const hit = receivingAccounts(settings).find((a) => a.id === id);
  if (hit) return hit.label;
  return id === 'gcash' ? 'GCash' : id === 'bdo' ? 'BDO' : id;
}

/**
 * Is ONE rail open? The same decision as `openChannels`, asked per rail,
 * because a payment page renders each panel independently.
 *
 * ⚠ Exists so a render site never re-spells the rule. Every `settings.X_number
 * || settings.X_qr_url` in a template is a second copy of this function that
 * has silently dropped the switch — which is exactly what three pages were
 * doing when this was written.
 */
export function isChannelOpen(
  settings: ChannelSettings,
  channel: PayChannel,
): boolean {
  return openChannels(settings).includes(channel);
}

/**
 * The channel to actually use, given what was requested.
 *
 * Returns null when NOTHING is open — a real state the owner can reach by
 * switching every account off after each hit its cap. We deliberately do NOT
 * force one back on: paying into a capped account fails at the bank, so
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

/**
 * What a buyer is told when every rail is closed. ONE sentence for every
 * surface — couple checkout, every supplier buy button, the /pay page — so the
 * owner switching a rail off reads the same wherever somebody meets it.
 */
export const PAYMENTS_PAUSED_MESSAGE =
  'Payments are paused right now while we switch receiving accounts. Please try again shortly — nothing has been charged.';

/** Account details a panel may PRINT: open accounts only, in the admin's order. */
export type OpenRailDetails = {
  accounts: Array<{
    id: PayChannel;
    label: string;
    kind: AccountKind;
    accountName: string | null;
    number: string | null;
  }>;
  /** The rails that are open — the same list `openRailOptions` returns, so a
   *  panel's "Pay with" choice and the numbers it prints cannot disagree. */
  open: OpenRail[];
};

/**
 * The account names and numbers a page may put on screen — only for rails
 * that are open.
 *
 * ⚠ Exists because two supplier panels (the branch "How to pay" box and the
 * Custom-plan configurator) copied `settings.bdo_account_number` and
 * `settings.gcash_number` straight into props. Printing a number IS offering
 * the rail, so the switch has to be asked at the moment the number is picked
 * up, not later by whoever renders it.
 */
export function openRailDetails(settings: ChannelSettings): OpenRailDetails {
  const open = openAccounts(settings);
  return {
    accounts: open.map((a) => ({
      id: a.id,
      label: a.label,
      kind: a.kind,
      accountName: a.accountName,
      number: a.number,
    })),
    open: open.map((a) => ({ id: a.id, label: a.label })),
  };
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
