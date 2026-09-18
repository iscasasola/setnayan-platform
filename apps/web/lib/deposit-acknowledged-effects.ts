/**
 * WHAT HAPPENED WHEN A SUPPLIER ACKNOWLEDGED A DEPOSIT — the pure judge.
 *
 * The moment a supplier says "the deposit reached me" owns two effects
 * (owner 2026-07-27, ruling 5 of 5): the booking fee is collected and the
 * supplier's schedule is reserved. `lib/deposit-acknowledged-effects.server.ts`
 * performs them and hands the result here; this file decides whether that
 * result is fine or needs a human, and writes the one sentence that says so.
 *
 * 🔑 WHY A JUDGE EXISTS AT ALL. On 2026-09-18 the platform's first real
 * booking reached acknowledge (13:51:44Z) and `booking_fee_ledger` stayed at
 * 0 rows. Nothing was logged, because nothing had run: the supplier confirmed
 * from the payment card, whose RPC stamps the acknowledgement inside SQL, and
 * the fee + pool lived only in the OTHER door (`vendorAcknowledgeDeposit`).
 * Before that, the only skip that was ever reported was `not_contracted`; every
 * other `{status:'skipped', reason}` was returned and thrown away. A silent
 * ₱0 is indistinguishable from a waived fee, and a waived fee is the owner's
 * first-five-free rule working. **Every outcome of this moment is recorded,
 * and every outcome that is not the expected one is recorded as a problem
 * with its reason in the sentence.**
 *
 * PURE: no I/O, no `server-only`, so `deposit-acknowledged-effects.test.ts`
 * can exercise every branch. The server half must not re-derive any of this.
 */

/** Which surface the supplier pressed, or the render-time catch-up. */
export type DepositEffectsDoor = 'clients_card' | 'payment_card' | 'catch_up';

/** The fee collector's answer, as this judge needs it (`CollectBookingFeeResult`
 *  is declared in a `server-only` module, so the shape is restated structurally
 *  rather than imported — `status` is the discriminant, the rest is context). */
export type DepositEffectsFee = {
  status: string;
  reason?: string;
  chargeId?: string;
  orderId?: string;
  amountPhp?: number;
  bookingOrdinal?: number;
};

/** The schedule-pool acquire's answer, same treatment (`PoolAcquireResult`). */
export type DepositEffectsPool = {
  status: string;
  message?: string;
  poolLabel?: string | null;
};

export type DepositEffectsOutcome = {
  door: DepositEffectsDoor;
  eventVendorId: string;
  /** NULL when the booking row could not be read at all. */
  eventId: string | null;
  /** Whether `deposit_acknowledged_at` was set on the row when we looked. */
  acknowledged: boolean;
  /** The money row (`resolveFeeAnchorRowId`); NULL means "bill nothing". */
  anchorId: string | null;
  /** `isBookingFeeEnabled()` at the time — a `null` fee is fine when this is off. */
  feeEnabled: boolean;
  fee: DepositEffectsFee | null;
  pool: DepositEffectsPool | null;
  /** The message of anything that threw mid-way, else NULL. */
  thrown: string | null;
};

export type DepositEffectsVerdict = {
  level: 'ok' | 'attention';
  /** One line, carrying every reason, for the log and for Sentry. */
  summary: string;
};

/**
 * The fee outcomes that mean "the money question is settled for this booking":
 * a real bill was minted, or the owner's rules say there is nothing to bill
 * (first five free · ₱0 fee) or the bill already exists.
 */
export const FEE_SETTLED_STATUSES: ReadonlySet<string> = new Set([
  'ordered',
  'free',
  'zero_fee',
  'order_exists',
]);

/**
 * The pool outcomes that mean "the schedule question is settled": the date is
 * held, or this booking has no date / no pools to hold — both ordinary.
 */
export const POOL_SETTLED_STATUSES: ReadonlySet<string> = new Set(['ok', 'no_date', 'no_pools']);

function feeWord(fee: DepositEffectsFee | null, feeEnabled: boolean): string {
  if (!feeEnabled) return 'off';
  if (!fee) return 'not-attempted';
  return fee.reason ? `${fee.status}:${fee.reason}` : fee.status;
}

function poolWord(pool: DepositEffectsPool | null): string {
  if (!pool) return 'not-attempted';
  return pool.poolLabel ? `${pool.status}(${pool.poolLabel})` : pool.status;
}

/**
 * Judge one outcome. `attention` whenever the moment did not do what the
 * ruling says it does, and the summary names WHY — never "skipped" alone.
 */
export function judgeDepositEffects(o: DepositEffectsOutcome): DepositEffectsVerdict {
  const problems: string[] = [];

  if (o.thrown) problems.push(`threw: ${o.thrown}`);

  if (!o.eventId) {
    problems.push('booking row not found');
  } else if (!o.acknowledged) {
    problems.push('called before the acknowledgement landed');
  } else if (!o.anchorId) {
    problems.push(
      'no money row resolved (archived booking or orphaned cascade line) — billed nothing, held nothing',
    );
  } else {
    if (o.feeEnabled) {
      if (!o.fee) {
        problems.push('fee never attempted');
      } else if (o.fee.status === 'skipped') {
        problems.push(`fee skipped: ${o.fee.reason ?? 'no reason given'}`);
      } else if (o.fee.status === 'no_payer') {
        problems.push(
          `fee charge ${o.fee.chargeId ?? '?'} has no payer (unclaimed supplier profile) — ops must resolve`,
        );
      } else if (o.fee.status === 'disabled') {
        problems.push('fee collector reported disabled while the flag is on');
      } else if (!FEE_SETTLED_STATUSES.has(o.fee.status)) {
        problems.push(`fee returned an unknown status: ${o.fee.status}`);
      }
    }

    if (!o.pool) {
      problems.push('schedule pool never attempted');
    } else if (!POOL_SETTLED_STATUSES.has(o.pool.status)) {
      const where = o.pool.poolLabel ? ` (${o.pool.poolLabel})` : '';
      const why = o.pool.message ? `: ${o.pool.message}` : '';
      problems.push(`schedule pool ${o.pool.status}${where}${why}`);
    }
  }

  const head =
    `[deposit-acknowledged-effects] door=${o.door} event_vendor=${o.eventVendorId} ` +
    `event=${o.eventId ?? 'unknown'} anchor=${o.anchorId ?? 'none'} ` +
    `fee=${feeWord(o.fee, o.feeEnabled)} pool=${poolWord(o.pool)}`;

  if (problems.length === 0) return { level: 'ok', summary: `${head} — OK` };
  return { level: 'attention', summary: `${head} — ATTENTION: ${problems.join('; ')}` };
}
