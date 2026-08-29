import { Smartphone, Trash2, Wallet } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { BackButton } from '@/app/_components/back-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import {
  channelHeadroom,
  headroomMessage,
  monthStartISO,
  PAY_CHANNEL_LABEL,
} from '@/lib/payment-channels';
import { formatPhp } from '@/lib/orders';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { Field } from '@/app/_components/forms/field';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { QrUploadForm } from '../_components/qr-upload-form';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { removeMerchantQr, savePaymentInstruments } from '../actions';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Payment methods · Admin' };

type PaymentMethodRow = {
  method_code: string;
  display_name: string;
  gateway_fee_pct: number;
  setnayan_pay_pct: number;
  // Minimum convenience-fee floor in centavos. Added by migration
  // 20260608000000 per CLAUDE.md decision-log 2026-05-17 ninth row to
  // ensure sub-₱1,000 bookings still clear Setnayan's per-transaction
  // operating cost. Nullable in the read shape only because pre-migration
  // envs would return NULL; post-migration every row carries 5000 (₱50)
  // by default. We coalesce in the cell render so a NULL doesn't break
  // the table layout.
  min_fee_centavos: number | null;
  is_active: boolean;
  display_order: number;
  effective_at: string;
  updated_at: string;
};

type Props = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    qr_uploaded?: string;
    qr_removed?: string;
  }>;
};

/**
 * Canonical home for V2 payment instruments + retired Setnayan Pay history.
 *
 * 2026-05-29 restructure (per owner directive "shouldn't this be at payment
 * methods?"): merchant payment configuration (BDO + GCash account info + QR
 * codes) lives here instead of `/admin/settings`. Reasoning:
 *
 * 1. Couples reference these rails when transferring for an order — the
 *    fields are payment configuration, not business identity.
 * 2. Conceptually, the page name "Payment methods" already promises these
 *    fields. Hiding them on the parent settings page was a discoverability
 *    bug owner caught during pre-pilot review.
 * 3. Single source-of-truth means QR upload + account info edits flow
 *    through one surface, reducing the chance of admin editing the BDO
 *    number on one page while uploading the BDO QR on another.
 *
 * Below the active V2 form, the legacy `setnayan_pay_methods` table renders
 * as a read-only historical audit (retired 2026-05-28 V2 cutover per
 * CLAUDE.md V1→V2 cutover decision-log rows).
 */
export default async function PaymentMethodsAdminPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const admin = createAdminClient();
  const settings = await fetchPlatformSettings(admin);

  // Setnayan inflow per rail, in TWO windows — the meter needs both.
  //
  //   • sinceMonthStart — for CAP mode, matching how the bank accounts for a
  //     monthly limit. (The previous rolling-30-day window disagreed with
  //     GCash's own calendar-month reckoning by up to 30 days.)
  //   • sinceAsOf       — for OWNER-BALANCE mode: only orders recorded AFTER
  //     the owner read their real balance, since earlier ones are already
  //     inside the figure they typed.
  //
  // Counts 'matched' only — that is what approvePayment writes; there is NO
  // 'approved' value in the payment_status enum, and querying one would return
  // zero rows forever behind a reassuring empty meter. A 'pending' row is
  // money we have not confirmed arrived.
  //
  // Fail-soft: a read error must never take the settings form down — the admin
  // may be opening this page precisely BECAUSE payments are misbehaving.
  //
  // ⚠ BUT "the meter simply reads low" WAS THE WRONG TRADE, and it is corrected
  // here. Headroom is cap MINUS inflow, so a falsely-zero inflow does not read
  // low — it reads HIGH, telling the owner a rail can still receive money it
  // cannot. Transfers past a full account FAIL rather than queue, and this
  // page's own copy already states the principle: "a working-looking button on
  // a full account is worse than an honest pause." An unmeasured inflow now
  // refuses to claim headroom at all; the form still renders either way.
  const now = new Date();
  const monthStart = monthStartISO(now);
  const asOfFloor = [settings.gcash_available_as_of, settings.bdo_available_as_of]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .sort()[0];
  const sinceMonthStart = { gcash: 0, bdo: 0 };
  const sinceAsOf = { gcash: 0, bdo: 0 };
  let inflowMeasured = true;
  try {
    // One read covering both windows — the earlier of (month start, oldest
    // override) — then bucket in memory rather than issuing two queries.
    const floor =
      asOfFloor && asOfFloor.slice(0, 10) < monthStart ? asOfFloor.slice(0, 10) : monthStart;
    const { data: inflow, error: inflowError } = await admin
      .from('payments')
      .select('channel, amount_php, paid_at, created_at')
      .eq('status', 'matched')
      .gte('paid_at', floor);
    if (inflowError || inflow === null) inflowMeasured = false;
    for (const row of (inflow ?? []) as {
      channel: string;
      amount_php: number;
      paid_at: string;
      created_at: string;
    }[]) {
      const rail = row.channel === 'gcash' ? 'gcash' : row.channel === 'bdo' ? 'bdo' : null;
      if (!rail) continue;
      const amount = Number(row.amount_php) || 0;
      if (row.paid_at >= monthStart) sinceMonthStart[rail] += amount;
      const asOf = rail === 'gcash' ? settings.gcash_available_as_of : settings.bdo_available_as_of;
      // created_at, not paid_at: paid_at is a DATE the couple asserts, so a
      // same-day order would compare equal to the override instant and get
      // dropped. created_at is when WE recorded it, which is the honest
      // "after the owner looked" test.
      if (asOf && row.created_at > asOf) sinceAsOf[rail] += amount;
    }
  } catch {
    // The THROW path is the same claim as the refused-read path: nothing was
    // counted. It must not resolve to zero either.
    inflowMeasured = false;
  }
  const { data, error } = await admin
    .from('setnayan_pay_methods')
    .select(
      'method_code,display_name,gateway_fee_pct,setnayan_pay_pct,min_fee_centavos,is_active,display_order,effective_at,updated_at',
    )
    .order('display_order', { ascending: true });

  // Full error → Vercel Functions log + Sentry (with call_site pivot) per
  // the canonical pattern in lib/supabase/error-detect.ts. Brand-voice copy
  // surfaces to the admin per [[feedback_setnayan_no_dev_text_post_launch]]
  // — pre-pilot audit cleanup 2026-05-30.
  if (error) {
    logQueryError('AdminPaymentMethodsPage (setnayan_pay_methods)', error);
  }

  /**
   * ⚠ THIS SURFACE ALREADY GOT THE REFUSED READ RIGHT, AND THE CONVERSION MUST
   * NOT WEAKEN IT. It branched on `error` FIRST, so the `?? []` below it was
   * unreachable and never became a lie — one of only two admin surfaces where
   * that held. `ConsoleTable` resolves in the same order (error beats empty, via
   * the shared resolver), so the hand-rolled branch is replaced by the archetype
   * rather than simply deleted, and `null` now carries the distinction to the
   * render instead of the branch carrying it here.
   */
  const rows = data as PaymentMethodRow[] | null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <BackButton href="/admin/settings" label="Back to settings" />

      {/* The page starts at its content — the Back to settings link above is
          untouched, because on a phone it is the only way up a level.
          ⚖ The sentence survives: an edit here changes the account number a
          couple is told to transfer money to, on order pages, receipts and
          confirmation emails, immediately. */}
      <PageMasthead title="Payment methods" />
      <div className="mb-6">
        <p className="text-sm text-ink/70">
          BDO and GCash account details + QR codes the app shows to couples on
          order detail pages so they can transfer. Edits propagate everywhere
          immediately — order pages, receipts, and confirmation emails read
          from the same row.
        </p>
      </div>

      {search.error ? (
        <FormFlash tone="error">
          {decodeURIComponent(search.error)}
        </FormFlash>
      ) : null}
      {search.saved ? (
        <FormFlash tone="success">
          Payment details saved. Live changes show on every order detail page.
        </FormFlash>
      ) : null}
      {search.qr_uploaded ? (
        <FormFlash tone="success">
          QR code uploaded. It now shows on order detail pages for couples.
        </FormFlash>
      ) : null}
      {search.qr_removed ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/80"
        >
          QR code removed.
        </p>
      ) : null}

      <form action={savePaymentInstruments} className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              BDO bank transfer
            </h2>
          </div>
          <Field label="Account name" htmlFor="bdo_account_name">
            <input
              id="bdo_account_name"
              name="bdo_account_name"
              defaultValue={settings.bdo_account_name ?? ''}
              className="input-field"
            />
          </Field>
          <Field label="Account number" htmlFor="bdo_account_number">
            <input
              id="bdo_account_number"
              name="bdo_account_number"
              defaultValue={settings.bdo_account_number ?? ''}
              placeholder="000-000-000-000"
              className="input-field font-mono"
            />
          </Field>
          <ChannelSwitch
            kind="bdo"
            enabled={settings.bdo_enabled}
            capPhp={settings.bdo_monthly_cap_php}
            availablePhp={settings.bdo_available_php}
            availableAsOf={settings.bdo_available_as_of}
            inflowSinceAsOfPhp={sinceAsOf.bdo}
            inflowThisMonthPhp={sinceMonthStart.bdo}
            inflowMeasured={inflowMeasured}
            now={now}
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              GCash
            </h2>
          </div>
          <Field label="Account name" htmlFor="gcash_account_name">
            <input
              id="gcash_account_name"
              name="gcash_account_name"
              defaultValue={settings.gcash_account_name ?? ''}
              className="input-field"
            />
          </Field>
          <Field label="GCash number" htmlFor="gcash_number">
            <input
              id="gcash_number"
              name="gcash_number"
              defaultValue={settings.gcash_number ?? ''}
              placeholder="+63 917 …"
              className="input-field font-mono"
            />
          </Field>
          <ChannelSwitch
            kind="gcash"
            enabled={settings.gcash_enabled}
            capPhp={settings.gcash_monthly_cap_php}
            availablePhp={settings.gcash_available_php}
            availableAsOf={settings.gcash_available_as_of}
            inflowSinceAsOfPhp={sinceAsOf.gcash}
            inflowThisMonthPhp={sinceMonthStart.gcash}
            inflowMeasured={inflowMeasured}
            now={now}
          />
        </section>

        <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
            Last updated{' '}
            {new Date(settings.updated_at).toLocaleString()}
          </p>
          <SubmitButton
            className="button-primary inline-flex items-center gap-2"
            pendingLabel="Saving…"
          >
            Save payment details
          </SubmitButton>
        </div>
      </form>

      <div className="mt-10 space-y-6 border-t border-ink/10 pt-8">
        <header className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Merchant QR codes
          </h2>
          <p className="text-sm text-ink/60">
            Upload a photo or screenshot of your merchant QR code (PNG, JPEG,
            WebP, GIF, or HEIC, ≤ 6 MB). We&rsquo;ll auto-detect the QR and crop
            it to a 512×512 square before saving so it renders clean on every
            couple&rsquo;s order detail page.
          </p>
          <p className="rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900">
            <span className="font-semibold">
              Upload the plain receiving QR &mdash; the one with NO amount on
              it.
            </span>{' '}
            Setnayan writes each order&rsquo;s exact amount into the code
            itself, down to the centavo, so the payer never types a figure. If
            you use the QR your wallet app generates <em>with</em> an amount
            baked in, that app applies its own minimum (GCash asks for
            &#8369;100) and every order would be charged that one frozen
            amount. Our own smallest item sells for &#8369;70, so an
            amount-baked QR would break it.
          </p>
        </header>

        <QrUploadBlock
          kind="bdo"
          label="BDO QR code"
          currentUrl={settings.bdo_qr_url}
        />
        <QrUploadBlock
          kind="gcash"
          label="GCash QR code"
          currentUrl={settings.gcash_qr_url}
        />
      </div>

      <div className="mt-12 space-y-3 border-t border-ink/10 pt-8">
        <header className="space-y-1">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Historical · Legacy Setnayan Pay methods
          </h2>
          <p className="text-sm text-ink/60">
            Read-only configuration that ran during the V1 launch period —
            gateway fee, Setnayan Pay platform fee, and minimum-floor per rail.
          </p>
          <p className="rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900">
            <span className="font-semibold">Retired 2026-05-28 V2 cutover —
            read-only historical view.</span> Setnayan Pay is no longer the
            checkout rail. Setnayan is now a software publisher — customer SKUs
            sell at sticker price with no convenience fee, and vendor bookings
            settle directly off-platform with 0% commission. The rows below stay
            for audit only; new V2 orders don&apos;t consult this table.
          </p>
        </header>

        <ConsoleTable
          rows={rows}
          readPermitted
          readError={error}
          reads="the retired Setnayan Pay rates"
          label="Legacy Setnayan Pay methods"
          minWidth="46rem"
          note="Read-only history. Setnayan Pay is not the checkout rail any more, so there is deliberately nothing to press — these rows are kept so an old order's fee can still be explained."
          rowKey={(m) => m.method_code}
          empty={{
            Icon: Wallet,
            title: 'No historical Setnayan Pay rows',
            blurb:
              'V2 never writes to this table, so an empty list is the expected state on a fresh environment — not a sign anything is missing.',
          }}
          columns={[
            {
              header: 'Method',
              cell: (m) => (
                <>
                  <div className="font-medium text-ink">{m.display_name}</div>
                  <div className="font-mono text-[11px] text-ink/70">{m.method_code}</div>
                </>
              ),
            },
            {
              header: 'Gateway fee',
              align: 'right',
              mono: true,
              hideBelow: 'md',
              cell: (m) => `${(Number(m.gateway_fee_pct) * 100).toFixed(2)}%`,
            },
            {
              header: 'Setnayan Pay',
              align: 'right',
              mono: true,
              hideBelow: 'md',
              cell: (m) => `${(Number(m.setnayan_pay_pct) * 100).toFixed(2)}%`,
            },
            {
              header: 'Min fee',
              align: 'right',
              mono: true,
              hideBelow: 'lg',
              // Coalesce a NULL (pre-migration env) to the canonical ₱50 floor
              // for display. Post-migration every row carries 5000 by default.
              cell: (m) => `₱${Math.round((m.min_fee_centavos ?? 5000) / 100).toLocaleString('en-PH')}`,
            },
            {
              header: 'Total',
              align: 'right',
              mono: true,
              cell: (m) => (
                <span className="font-semibold">
                  {(Number(m.gateway_fee_pct) * 100 + Number(m.setnayan_pay_pct) * 100).toFixed(2)}%
                </span>
              ),
            },
            {
              header: 'Status',
              cell: (m) =>
                m.is_active ? (
                  <span className="inline-flex items-center rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-800">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink/70">
                    Inactive
                  </span>
                ),
            },
          ]}
        />

        <p className="mt-4 text-sm text-ink/70">
        These are the old payment rails. Nothing new goes through them &mdash; they are
        kept so past records stay readable.
      </p>
      </div>
    </div>
  );
}

function QrUploadBlock({
  kind,
  label,
  currentUrl,
}: {
  kind: 'bdo' | 'gcash';
  label: string;
  currentUrl: string | null;
}) {
  return (
    <section className="space-y-3 sn-tile p-5">
      <h3 className="text-sm font-semibold text-ink">{label}</h3>

      {currentUrl ? (
        <div className="flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={`${label} preview`}
            className="h-40 w-40 rounded-md border border-ink/10 bg-white/70 object-contain"
          />
          <div className="flex-1 space-y-2 text-sm text-ink/65">
            <p>Currently shown to couples on order detail pages.</p>
            <form action={removeMerchantQr}>
              <input type="hidden" name="kind" value={kind} />
              <SubmitButton
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-danger-700 disabled:cursor-not-allowed disabled:opacity-60"
                pendingLabel="Removing…"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Remove
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-ink/15 bg-white/50 p-3 text-xs text-ink/55">
          No {label} uploaded yet. Couples will see only account name +
          number on order detail pages.
        </p>
      )}

      <QrUploadForm kind={kind} replace={!!currentUrl} />
    </section>
  );
}

/**
 * Per-rail kill switch + available-balance meter.
 *
 * Setnayan receives on PERSONAL accounts (owner 2026-08-01: no business
 * account yet). A personal GCash wallet has a monthly RECEIVING limit —
 * ₱500,000 — and past it incoming transfers **fail rather than queue**, with
 * no warning inside GCash's own flow.
 *
 * Two modes, and the difference is the point:
 *
 *   • Leave the balance blank and the meter measures Setnayan orders against
 *     the monthly cap. That is OPTIMISTIC: the bank counts the owner's
 *     personal transfers too, and we cannot see them.
 *   • Type the real remaining headroom out of the bank app and the meter
 *     counts down from THAT, which accounts for everything — up to the moment
 *     it was read. Re-reading and updating keeps it honest.
 *
 * The monthly reset is derived, not scheduled: an override entered in a
 * previous calendar month is ignored and the cap applies again. No cron.
 */
function ChannelSwitch({
  kind,
  enabled,
  capPhp,
  availablePhp,
  availableAsOf,
  inflowSinceAsOfPhp,
  inflowThisMonthPhp,
  inflowMeasured,
  now,
}: {
  kind: 'gcash' | 'bdo';
  enabled: boolean;
  capPhp: number | null;
  availablePhp: number | null;
  availableAsOf: string | null;
  inflowSinceAsOfPhp: number;
  inflowThisMonthPhp: number;
  /** False when the inflow read did not complete — then NO headroom is claimed. */
  inflowMeasured: boolean;
  now: Date;
}) {
  const label = PAY_CHANNEL_LABEL[kind];
  const measuredHeadroom = channelHeadroom({
    capPhp,
    availablePhp,
    availableAsOf,
    inflowSinceAsOfPhp,
    inflowThisMonthPhp,
    now,
  });
  // Unmeasured inflow ⇒ no headroom claim at all. `null` is the shape this
  // component already renders as "we are not telling you a number".
  const headroom = inflowMeasured ? measuredHeadroom : null;
  const tone =
    headroom == null
      ? 'border-ink/10 bg-cream'
      : headroom.band === 'over' || headroom.band === 'critical'
        ? 'border-warn-300/70 bg-warn-50'
        : headroom.band === 'warn'
          ? 'border-warn-300/40 bg-warn-50/60'
          : 'border-ink/10 bg-cream';

  return (
    <div className={`space-y-3 rounded-xl border p-4 ${tone}`}>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name={`${kind}_enabled`}
          defaultChecked={enabled}
          className="mt-0.5 h-4 w-4 accent-[var(--sn-success,green)]"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">
            Accept {label} payments
          </span>
          <span className="block text-[12px] leading-relaxed text-ink/60">
            Uncheck to stop offering {label} at checkout — do this the moment
            the account reaches its monthly limit, because transfers past it{' '}
            <strong>fail</strong> instead of queuing. Turning both rails off
            pauses payments entirely, which is deliberate: a working-looking
            button on a full account is worse than an honest pause.
          </span>
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={`${label} available balance now (₱)`}
          htmlFor={`${kind}_available_php`}
        >
          <input
            id={`${kind}_available_php`}
            name={`${kind}_available_php`}
            defaultValue={availablePhp != null ? String(availablePhp) : ''}
            inputMode="decimal"
            placeholder="read it from the app"
            className="input-field font-mono"
          />
        </Field>
        <Field label={`${label} monthly limit (₱)`} htmlFor={`${kind}_monthly_cap_php`}>
          <input
            id={`${kind}_monthly_cap_php`}
            name={`${kind}_monthly_cap_php`}
            defaultValue={capPhp != null ? String(capPhp) : ''}
            inputMode="decimal"
            placeholder={kind === 'gcash' ? '500000' : 'leave blank if none'}
            className="input-field font-mono"
          />
        </Field>
      </div>

      <p className="text-[11px] leading-relaxed text-ink/55">
        Open {label}, read how much it can still receive this month, and type it
        on the left. We count Setnayan orders down from that figure — so it
        stays right even though your personal transfers are invisible to us.
        Leave it blank to measure against the monthly limit instead, which
        always reads higher than the truth. It resets to the limit on the 1st.
      </p>

      {!inflowMeasured ? (
        <p
          role="alert"
          className="rounded-md border border-warn-300/60 bg-warn-50 px-3 py-2 text-[12px] leading-relaxed text-warn-900"
        >
          <strong>We could not read this month&rsquo;s {label} inflow</strong>, so
          no remaining-capacity figure is shown for it. This is NOT a reading of
          zero received — a zero here would make the account look emptier, and so
          more able to receive, than it may be. Check the {label} app directly
          before turning this rail back on or accepting a large transfer.
        </p>
      ) : null}

      {headroom ? (
        <div className="space-y-1.5">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-ink/10"
            role="img"
            aria-label={`${Math.round(headroom.pct)} percent used`}
          >
            <div
              className={`h-full rounded-full ${
                headroom.band === 'over' || headroom.band === 'critical'
                  ? 'bg-[var(--sn-warning,orange)]'
                  : 'bg-[var(--sn-success,green)]'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, Math.round(headroom.pct)))}%` }}
            />
          </div>
          <p className="text-[12px] leading-relaxed text-ink/70">
            {headroomMessage(headroom, label)}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {formatPhp(headroom.remainingPhp)} left of {formatPhp(headroom.startingPhp)}
            {headroom.source === 'owner_balance' && availableAsOf
              ? ` · your reading ${new Date(availableAsOf).toLocaleDateString()}`
              : ' · from the monthly limit'}
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-ink/55">
          Enter a balance or a monthly limit above to see how much room is left.
        </p>
      )}
    </div>
  );
}
