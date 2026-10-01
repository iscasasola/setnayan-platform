import { ArrowDown, ArrowUp, Plus, Trash2, Wallet } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { BackButton } from '@/app/_components/back-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettingsMeasured } from '@/lib/platform-settings';
import {
  channelHeadroom,
  headroomMessage,
  monthStartISO,
  PAY_CHANNELS,
  receivingAccounts,
  type ReceivingAccount,
} from '@/lib/payment-channels';
import { parseTlv } from '@/lib/emv-qr';
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
    notice?: string;
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
  // 🔒 MEASURED, NOT FALLBACK (2026-09-30). A refused read seeds every input
  // below with blanks; one Save would then write those blanks over the real
  // BDO / GCash details every order page reads. `settingsReadFailed` says so
  // and disables Save.
  const {
    settings,
    readFailed: settingsReadFailed,
    accountsReadFailed,
  } = await fetchPlatformSettingsMeasured(admin);

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
    if (inflowError || inflow === null) {
      logQueryError('admin/settings/payment-methods: matched inflow', inflowError);
      inflowMeasured = false;
    }
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

  // Setnayan's receiving accounts, in the order customers see them. A refused
  // read of the LIST turns every list control off: each one rewrites the whole
  // array, and a write built on the fall-back two would replace the real list.
  const accounts = receivingAccounts(settings);
  const listLocked = settingsReadFailed || accountsReadFailed;
  const cappedRails = PAY_CHANNELS.filter((id) => accounts.some((a) => a.id === id));
  const notice = typeof search.notice === 'string' ? search.notice.slice(0, 400) : '';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <BackButton href="/admin/settings" label="Back to settings" />

      {/* The page starts at its content — the Back to settings link above is
          untouched, because on a phone it is the only way up a level.
          ⚖ The sentence survives: an edit here changes the account a customer
          is told to send money to, on checkout, order pages, receipts and
          confirmation emails. */}
      <PageMasthead title="Payment methods" />
      <div className="mb-6">
        <p className="text-sm text-ink/70">
          Where customers send money. They see these accounts at checkout, in
          this order.
        </p>
      </div>

      {search.error ? (
        <FormFlash tone="error">
          {decodeURIComponent(search.error)}
        </FormFlash>
      ) : null}
      {notice ? <FormFlash tone="success">{notice}</FormFlash> : null}
      {search.saved ? (
        <FormFlash tone="success">
          Saved. Checkout shows the change straight away.
        </FormFlash>
      ) : null}
      {search.qr_uploaded ? (
        <FormFlash tone="success">
          QR code uploaded. It now shows at checkout.
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

      {listLocked ? (
        <FormFlash tone="error">
          Couldn&rsquo;t load the saved accounts — refresh to try again.
          Changes are off until they load, so nothing can overwrite the real
          ones.
        </FormFlash>
      ) : null}

      {/* ── THE LIST (owner 2026-10-01) ───────────────────────────────────── */}
      <section className="space-y-4" aria-labelledby="our-accounts">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          <h2
            id="our-accounts"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
          >
            Our accounts
          </h2>
        </div>
        <p className="text-xs text-ink/60">
          A new account, or a new name, number or QR, goes live when a second
          admin approves it. Turning an account off, re-ordering and renaming
          the label save straight away.
        </p>
        {accounts.map((a, i) => (
          <AccountCard
            key={a.id}
            account={a}
            first={i === 0}
            last={i === accounts.length - 1}
            only={accounts.length === 1}
            locked={listLocked}
          />
        ))}
      </section>

      {/* ── ADD ONE ──────────────────────────────────────────────────────── */}
      <section className="mt-6 space-y-3 sn-tile p-5" aria-labelledby="add-account">
        <h3 id="add-account" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Add an account
        </h3>
        <form action={savePaymentInstruments} className="space-y-3">
          <input type="hidden" name="intent" value="account_save" />
          <AccountFields />
          <SubmitButton
            className="button-primary inline-flex items-center gap-2"
            pendingLabel="Adding…"
            disabled={listLocked}
          >
            Add account
          </SubmitButton>
          <p className="text-[11px] text-ink/50">
            Customers see it once a second admin approves it. Add its QR after.
          </p>
        </form>
      </section>

      {/* ── MONTHLY LIMITS (GCash + BDO only — their columns predate the list) ── */}
      {cappedRails.length > 0 ? (
        <form action={savePaymentInstruments} className="mt-10 space-y-4 border-t border-ink/10 pt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Monthly limits
          </h2>
          {cappedRails.map((id) => (
            <ChannelSwitch
              key={id}
              kind={id}
              label={accounts.find((a) => a.id === id)?.label ?? id}
              capPhp={id === 'gcash' ? settings.gcash_monthly_cap_php : settings.bdo_monthly_cap_php}
              availablePhp={id === 'gcash' ? settings.gcash_available_php : settings.bdo_available_php}
              availableAsOf={id === 'gcash' ? settings.gcash_available_as_of : settings.bdo_available_as_of}
              inflowSinceAsOfPhp={sinceAsOf[id]}
              inflowThisMonthPhp={sinceMonthStart[id]}
              inflowMeasured={inflowMeasured}
              now={now}
            />
          ))}
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
              Last updated {new Date(settings.updated_at).toLocaleString()}
            </p>
            <SubmitButton
              className="button-primary inline-flex items-center gap-2"
              pendingLabel="Saving…"
              disabled={settingsReadFailed}
            >
              Save limits
            </SubmitButton>
          </div>
        </form>
      ) : null}

      <div className="mt-10 space-y-2 border-t border-ink/10 pt-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          About QR codes
        </h2>
        <p className="text-sm text-ink/60">
          Upload a photo or screenshot of the account&rsquo;s receiving QR
          (PNG, JPEG, WebP, GIF, or HEIC, ≤ 6 MB). We find the code, crop it
          square, and read it so each order&rsquo;s amount can be written into
          it.
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
            sell at sticker price with no convenience fee, and supplier bookings
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

/** What the QR itself says it pays: the merchant name (EMV tag 59). */
function qrMerchantName(payload: string | null): string | null {
  if (!payload) return null;
  try {
    return parseTlv(payload).find((f) => f.id === '59')?.value.trim() || null;
  } catch {
    return null;
  }
}

const SMALL_BUTTON =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * One receiving account: its details, its switch, its place in the order and
 * its QR. Every control is its OWN form, side by side — never nested — and
 * each posts one intent to `savePaymentInstruments`.
 */
function AccountCard({
  account,
  first,
  last,
  only,
  locked,
}: {
  account: ReceivingAccount;
  first: boolean;
  last: boolean;
  only: boolean;
  locked: boolean;
}) {
  const qrSays = qrMerchantName(account.qrPayload);
  return (
    <section
      className={`space-y-4 sn-tile p-5 ${account.enabled ? '' : 'opacity-75'}`}
      aria-label={account.label}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          {account.label}{' '}
          <span className="font-normal text-ink/55">
            · {account.kind === 'bank' ? 'Bank' : 'E-wallet'}
            {account.enabled ? '' : ' · Off'}
          </span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <form action={savePaymentInstruments}>
            <input type="hidden" name="intent" value="account_toggle" />
            <input type="hidden" name="account_id" value={account.id} />
            <input type="hidden" name="enabled" value={account.enabled ? '0' : '1'} />
            <SubmitButton className={SMALL_BUTTON} pendingLabel="Saving…" disabled={locked}>
              {account.enabled ? 'Turn off' : 'Turn on'}
            </SubmitButton>
          </form>
          {!first ? (
            <form action={savePaymentInstruments}>
              <input type="hidden" name="intent" value="account_move" />
              <input type="hidden" name="account_id" value={account.id} />
              <input type="hidden" name="direction" value="up" />
              <SubmitButton className={SMALL_BUTTON} pendingLabel="Moving…" disabled={locked}>
                <ArrowUp aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="sr-only">Move {account.label} up</span>
              </SubmitButton>
            </form>
          ) : null}
          {!last ? (
            <form action={savePaymentInstruments}>
              <input type="hidden" name="intent" value="account_move" />
              <input type="hidden" name="account_id" value={account.id} />
              <input type="hidden" name="direction" value="down" />
              <SubmitButton className={SMALL_BUTTON} pendingLabel="Moving…" disabled={locked}>
                <ArrowDown aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="sr-only">Move {account.label} down</span>
              </SubmitButton>
            </form>
          ) : null}
          {!only ? (
            <form action={savePaymentInstruments}>
              <input type="hidden" name="intent" value="account_remove" />
              <input type="hidden" name="account_id" value={account.id} />
              <SubmitButton
                className={`${SMALL_BUTTON} hover:text-danger-700`}
                pendingLabel="Removing…"
                disabled={locked}
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Remove
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <form action={savePaymentInstruments} className="space-y-3">
        <input type="hidden" name="intent" value="account_save" />
        <input type="hidden" name="account_id" value={account.id} />
        <AccountFields account={account} />
        <SubmitButton
          className="button-primary inline-flex items-center gap-2"
          pendingLabel="Saving…"
          disabled={locked}
        >
          Save {account.label}
        </SubmitButton>
      </form>

      <div className="space-y-3 border-t border-ink/10 pt-4">
        <h4 className="text-xs font-semibold text-ink/70">QR code</h4>
        {account.qrUrl ? (
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={account.qrUrl}
              alt={`${account.label} QR code`}
              className="h-40 w-40 rounded-md border border-ink/10 bg-white/70 object-contain"
            />
            <div className="flex-1 space-y-2 text-sm text-ink/65">
              {qrSays ? (
                <p>
                  QR says: <strong className="text-ink">{qrSays}</strong>
                </p>
              ) : (
                <p>
                  We couldn&rsquo;t read this code, so customers see the picture
                  as it is, without the order amount.
                </p>
              )}
              <form action={removeMerchantQr}>
                <input type="hidden" name="kind" value={account.id} />
                <SubmitButton
                  className={`${SMALL_BUTTON} hover:text-danger-700`}
                  pendingLabel="Removing…"
                  disabled={locked}
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Remove QR
                </SubmitButton>
              </form>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-ink/15 bg-white/50 p-3 text-xs text-ink/55">
            No QR yet. Customers see the account name and number only.
          </p>
        )}
        <QrUploadForm kind={account.id} replace={!!account.qrUrl} />
      </div>
    </section>
  );
}

/** Label · Bank or e-wallet · account name · number. Blank for a new account. */
function AccountFields({ account }: { account?: ReceivingAccount }) {
  const key = account?.id ?? 'new';
  return (
    <>
      <Field label="Name customers see" htmlFor={`label-${key}`}>
        <input
          id={`label-${key}`}
          name="label"
          required
          maxLength={40}
          defaultValue={account?.label ?? ''}
          placeholder="Maribank"
          className="input-field"
        />
      </Field>
      <fieldset className="flex flex-wrap gap-4 text-sm text-ink">
        <legend className="sr-only">Type of account</legend>
        <label className="inline-flex min-h-[44px] items-center gap-2">
          <input
            type="radio"
            name="kind"
            value="bank"
            defaultChecked={account?.kind === 'bank'}
          />
          Bank
        </label>
        <label className="inline-flex min-h-[44px] items-center gap-2">
          <input
            type="radio"
            name="kind"
            value="ewallet"
            defaultChecked={account ? account.kind === 'ewallet' : true}
          />
          E-wallet
        </label>
      </fieldset>
      <Field label="Account name" htmlFor={`account_name-${key}`}>
        <input
          id={`account_name-${key}`}
          name="account_name"
          maxLength={120}
          defaultValue={account?.accountName ?? ''}
          className="input-field"
        />
      </Field>
      <Field label="Account number" htmlFor={`number-${key}`}>
        <input
          id={`number-${key}`}
          name="number"
          maxLength={64}
          defaultValue={account?.number ?? ''}
          placeholder="000-000-000-000"
          className="input-field font-mono"
        />
      </Field>
    </>
  );
}

/**
 * Available-balance meter for the two accounts that have one (GCash, BDO).
 * The kill switch moved onto each account card in the list.
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
  label,
  capPhp,
  availablePhp,
  availableAsOf,
  inflowSinceAsOfPhp,
  inflowThisMonthPhp,
  inflowMeasured,
  now,
}: {
  kind: (typeof PAY_CHANNELS)[number];
  /** The account's name in the list ("GCash"). */
  label: string;
  capPhp: number | null;
  availablePhp: number | null;
  availableAsOf: string | null;
  inflowSinceAsOfPhp: number;
  inflowThisMonthPhp: number;
  /** False when the inflow read did not complete — then NO headroom is claimed. */
  inflowMeasured: boolean;
  now: Date;
}) {
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
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="text-[12px] leading-relaxed text-ink/60">
        Turn {label} off above the moment it reaches its monthly limit &mdash;
        transfers past it <strong>fail</strong> instead of queuing.
      </p>

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
