import { Banknote, PauseCircle, PlayCircle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { actionButtonClass } from '@/components/action-button-class';
import { Badge } from '@/app/_components/badge';
import {
  TemplateEmpty,
  TemplateFail,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { RecordBack, RecordFacts, RecordHead, RecordSection } from '@/app/admin/_components/record-kit';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import {
  BIR_WITHHOLDING_BPS,
  PAYOUT_STAGE_LABEL,
  formatCentavosPhp,
  type PayoutStage,
} from '@/lib/payouts';
import { markPayoutPaidAction, holdPayoutAction } from './actions';
// Lives in payments/actions.ts beside the other money reversals, not in
// payouts/actions.ts — which is part of why nothing ever imported it.
import { releasePayoutHoldAction } from '@/app/admin/payments/actions';
import { PAYOUT_FILTERS, parsePayoutFilter as parseFilter, payoutsHref as makeHref, type PayoutFilterKey as FilterKey } from './payouts-filters';
import { MarkPaidRows, ReasonRow } from './payout-form-rows';

import { requireAdmin } from '@/lib/admin/require-admin';
import { PageMasthead } from '@/app/_components/page-masthead';
export const metadata = { title: 'Payouts · Admin' };

/*
  📐 ADMIN CLEAN PORT (owner 19 Nov 2026, "ok" on the drawing "Money screens: now and proposed",
  artifact 6sKA8ofRh49LRdGFgJqLkk; DECISION_LOG 2026-11-19). Reposition only — the same reads, filters, actions and
  words, on the design template (`booking-fees/page.tsx` is the model): the pinned row "To approve · Payouts ▾" names
  the page, so there is no page title; the one description sits behind the ⓘ beside "Payouts"; the three tiles are
  one numbers frame; the four filters live behind the Show & filter round on the thumb row (`payouts-show-sort.tsx`);
  each payout is ONE row, and a tap opens it (`?open=<payout_id>`) with every field and both forms.
*/

type Props = {
  searchParams: Promise<{
    filter?: string;
    vendor?: string;
    from?: string;
    to?: string;
    open?: string;
    flash?: string;
    error?: string;
  }>;
};

type PayoutRow = {
  payout_id: string;
  public_id: string;
  order_id: string;
  vendor_profile_id: string;
  payout_stage: PayoutStage | null;
  stage: string;
  stage_pct: number;
  amount_centavos: number;
  gross_centavos: number | null;
  gateway_fee_centavos: number;
  bir_withholding_centavos: number;
  disbursement_fee_centavos: number;
  vendor_net_centavos: number | null;
  scheduled_at: string | null;
  dispute_window_ends_at: string | null;
  paid_at: string | null;
  released_at: string | null;
  on_hold: boolean;
  hold_reason: string | null;
  payout_method: string | null;
  payment_method: string | null;
  payout_reference: string | null;
  created_at: string;
  order: {
    public_id: string;
    reference_code: string;
    description: string;
    event_id: string | null;
  } | null;
  vendor: {
    business_name: string | null;
    public_id: string;
    public_visibility: string | null;
  } | null;
};

/* F-A-10 (admin walk, round 2): the old escrow stage filters ("Immediate (verified)" · "Stage 1 · at confirmation" …)
   are gone. Setnayan does not hold the couple's money; a row from an older booking still shows its own stage on its
   card, which is all an admin needs to read it. */

export default async function AdminPayoutsPage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const filter = parseFilter(search.filter);
  const vendor = search.vendor?.trim() ?? '';
  const from = search.from?.trim() ?? '';
  const to = search.to?.trim() ?? '';

  const admin = createAdminClient();

  let query = admin
    .from('vendor_payouts')
    .select(
      `payout_id, public_id, order_id, vendor_profile_id, payout_stage,
       stage, stage_pct, amount_centavos, gross_centavos, gateway_fee_centavos,
       bir_withholding_centavos, disbursement_fee_centavos, vendor_net_centavos,
       scheduled_at, dispute_window_ends_at, paid_at, released_at, on_hold,
       hold_reason, payout_method, payment_method, payout_reference, created_at,
       order:orders!vendor_payouts_order_id_fkey(public_id, reference_code, description, event_id),
       vendor:vendor_profiles!vendor_payouts_vendor_profile_id_fkey(business_name, public_id, public_visibility)`,
    )
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(200);

  if (filter === 'pending') {
    query = query.is('paid_at', null).eq('on_hold', false);
  } else if (filter === 'paid') {
    query = query.not('paid_at', 'is', null);
  } else if (filter === 'on_hold') {
    query = query.eq('on_hold', true);
  }
  // The supplier box takes a NAME as well as an ID: nobody keeps a UUID in their
  // head. A name is resolved to the matching shops first; an ID passes straight
  // through. 🔑 A name that matches nothing is "no supplier named …", which is
  // not the same as "that supplier has no payouts" — and a lookup that failed is
  // neither, so each is said separately below.
  let supplierNote: string | null = null;
  let supplierLookupFailed = false;
  if (vendor) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendor)) {
      query = query.eq('vendor_profile_id', vendor);
    } else {
      const { data: named, error: namedErr } = await admin
        .from('vendor_profiles')
        .select('vendor_profile_id')
        .ilike('business_name', `%${vendor.replace(/[%_,()]/g, ' ').trim()}%`)
        .limit(50);
      if (namedErr) {
        logQueryError('AdminPayoutsPage (supplier name lookup)', namedErr);
        supplierLookupFailed = true;
      } else if (!named || named.length === 0) {
        supplierNote = `No supplier is named “${vendor}”.`;
        query = query.eq('vendor_profile_id', '00000000-0000-0000-0000-000000000000');
      } else {
        query = query.in(
          'vendor_profile_id',
          named.map((n) => n.vendor_profile_id as string),
        );
      }
    }
  }
  if (from) query = query.gte('scheduled_at', from);
  if (to) query = query.lte('scheduled_at', to);

  const { data, error: payoutsError } = supplierLookupFailed
    ? { data: null, error: { message: 'supplier lookup failed' } }
    : await query;
  const error = payoutsError;
  if (error) {
    logQueryError('AdminPayoutsPage (vendor_payouts)', error);
  }
  const rows = (data ?? []) as unknown as PayoutRow[];

  // Aggregate KPIs across the *current* filter selection.
  const pendingTotal = rows
    .filter((r) => !r.paid_at && !r.on_hold)
    .reduce((acc, r) => acc + (r.vendor_net_centavos ?? r.amount_centavos), 0);
  const paidTotal = rows
    .filter((r) => !!r.paid_at)
    .reduce((acc, r) => acc + (r.vendor_net_centavos ?? r.amount_centavos), 0);
  const onHoldTotal = rows
    .filter((r) => r.on_hold)
    .reduce((acc, r) => acc + (r.vendor_net_centavos ?? r.amount_centavos), 0);


  const back = makeHref({ filter, vendor, from, to });
  const opened = search.open ? rows.find((r) => r.payout_id === search.open) ?? null : null;
  const filterLabel = PAYOUT_FILTERS.find((t) => t.key === filter)?.label ?? 'Pending';
  const count = (n: number) => `${n} payout(s)`;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6" data-payouts="">
      <PageMasthead title="Payouts" />
      <FlashBanner flash={search.flash} error={search.error} />

      {opened ? (
        <OpenedPayout row={opened} back={back} />
      ) : (
        <>
          <TemplateSection
            label="Payouts"
            first
            data="payouts"
            tip={
              /* 🧾 ONE DESCRIPTION (F-A-10): couples pay suppliers directly (apply-then-pay), so Setnayan makes no new payouts. */
              <span data-payouts-what="">
                Couples pay their suppliers directly, so Setnayan makes no new payouts. This is the record of payouts from older
                bookings that were paid through Setnayan.
              </span>
            }
          >
            <dl className="sn-frame my-2.5 grid grid-cols-3 gap-1 px-2 py-3 text-center" data-payouts-totals="">
              <PayoutNum
                label="Pending (filtered)"
                value={error ? '—' : formatCentavosPhp(pendingTotal)}
                help={error ? 'couldn’t read' : count(rows.filter((r) => !r.paid_at && !r.on_hold).length)}
              />
              <PayoutNum
                label="Paid (filtered)"
                value={error ? '—' : formatCentavosPhp(paidTotal)}
                help={error ? 'couldn’t read' : count(rows.filter((r) => !!r.paid_at).length)}
              />
              <PayoutNum
                label="On hold (filtered)"
                value={error ? '—' : formatCentavosPhp(onHoldTotal)}
                help={error ? 'couldn’t read' : count(rows.filter((r) => r.on_hold).length)}
              />
            </dl>
          </TemplateSection>

          <TemplateSection
            label={filterLabel}
            right={error ? undefined : `${rows.length} ${rows.length === 1 ? 'payout' : 'payouts'}`}
            data="payouts-list"
          >
            {error ? (
              <TemplateFail retryHref={back} data="payouts">
                Payouts couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment.
              </TemplateFail>
            ) : null}

            {error ? null : rows.length === 0 ? (
              <TemplateEmpty data="payouts">
                {supplierNote ?? 'No payouts match this filter.'} Only an older booking paid through Setnayan has a payout.
                New bookings are paid to the supplier directly.
              </TemplateEmpty>
            ) : (
              <TemplateRows label="Payouts">
                {rows.map((row) => (
                  <PayoutRowLine key={row.payout_id} row={row} href={makeHref({ filter, vendor, from, to, open: row.payout_id })} />
                ))}
              </TemplateRows>
            )}
          </TemplateSection>
        </>
      )}
    </div>
  );
}

/** One figure of the numbers frame — the shape of `TemplateNums`' cell, with the count under its label. */
function PayoutNum({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="grid min-h-11 content-center gap-0.5">
      <dt className="order-2 text-[12px] leading-snug text-[color:var(--m-slate-2)]">
        {label}
        <span className="block">{help}</span>
      </dt>
      <dd className="order-1 text-[20px] font-bold leading-none tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function stageOf(row: PayoutRow): PayoutStage {
  return (row.payout_stage ?? legacyStageToPayoutStage(row.stage)) as PayoutStage;
}

function StateBadge({ row }: { row: PayoutRow }) {
  if (row.paid_at) return <Badge tone="ok">Paid</Badge>;
  if (row.on_hold) return <Badge tone="no">On hold</Badge>;
  return <Badge tone="wait">Scheduled</Badge>;
}

/** ONE row per payout: who · how much, when · which payout, and its state. A tap opens it. */
function PayoutRowLine({ row, href }: { row: PayoutRow; href: string }) {
  const net = formatCentavosPhp(row.vendor_net_centavos ?? row.amount_centavos);
  const when = row.paid_at ? `Paid ${formatTimestamp(row.paid_at)}` : `Scheduled ${formatTimestamp(row.scheduled_at) ?? '—'}`;
  return (
    <TemplateRow
      data={row.payout_id}
      href={href}
      edge={row.on_hold ? 'late' : row.paid_at ? undefined : 'due'}
      title={`${row.vendor?.business_name ?? '(unknown supplier)'} · ${net}`}
      line={`${when} · Payout ${row.public_id}`}
      right={<StateBadge row={row} />}
    />
  );
}

/** A tapped payout, on its own: everything the old card carried, and its forms. */
function OpenedPayout({ row, back }: { row: PayoutRow; back: string }) {
  const isPaid = !!row.paid_at;
  const isHeld = !!row.on_hold;
  return (
    <div data-payout-open={row.payout_id}>
      <RecordBack href={back} label="Payouts" />
      <RecordHead
        small={`Order ${row.order?.reference_code ?? row.order?.public_id ?? '—'} · Payout ${row.public_id}`}
        name={`${row.vendor?.business_name ?? '(unknown supplier)'} · ${formatCentavosPhp(row.vendor_net_centavos ?? row.amount_centavos)}`}
        line={row.order?.description ?? '—'}
        badges={
          <>
            <StateBadge row={row} />
            {PAYOUT_STAGE_LABEL[stageOf(row)] ? <Badge tone="quiet">{PAYOUT_STAGE_LABEL[stageOf(row)]}</Badge> : null}
            <Badge tone="quiet">Stage {row.stage_pct}% of net</Badge>
            {row.vendor?.public_visibility ? <Badge tone="quiet">{row.vendor.public_visibility}</Badge> : null}
          </>
        }
      />

      <div className={`${ADMIN_FRAME} px-4`}>
        <RecordFacts
          label="Payout"
          items={[
            ['Scheduled', formatTimestamp(row.scheduled_at) ?? '—'],
            ['Paid at', formatTimestamp(row.paid_at) ?? '—'],
            ['Dispute window', formatTimestamp(row.dispute_window_ends_at) ?? '—'],
            ['Rail', row.payment_method ?? row.payout_method ?? '—'],
            ['Gross', formatCentavosPhp(row.gross_centavos)],
            ['Gateway', formatCentavosPhp(row.gateway_fee_centavos)],
            [`BIR ${BIR_WITHHOLDING_BPS / 100}%`, formatCentavosPhp(row.bir_withholding_centavos)],
            ['Disburse fee', `${formatCentavosPhp(row.disbursement_fee_centavos)} · Absorbed`],
          ]}
        />
      </div>

      {row.hold_reason ? (
        <p className="mt-3 text-[14px]" style={{ color: 'rgb(var(--color-danger))' }}>
          <span className="font-semibold">On hold:</span> {row.hold_reason}
        </p>
      ) : null}

      {!isPaid ? (
        <>
          <RecordSection label="Mark paid">
            <ConfirmForm
              action={markPayoutPaidAction}
              title="Mark this payout as paid?"
              confirmLabel="Mark paid"
              destructive={false}
              message="This records the supplier's payout as sent (rail + reference) and emails them a payment confirmation. Do this only after the money has actually left your account."
              className={`${ADMIN_FRAME} block px-4 pb-3`}
            >
              <input type="hidden" name="payout_id" value={row.payout_id} />
              <MarkPaidRows defaultRail={row.payout_method ?? 'maya'} />
              <SubmitButton className={actionButtonClass('brand', { main: true, extra: 'mt-2 w-full justify-center' })}>
                <Banknote aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                Mark paid
              </SubmitButton>
            </ConfirmForm>
          </RecordSection>

          {!isHeld ? (
            <RecordSection label="Place on hold">
              <ConfirmForm
                action={holdPayoutAction}
                title="Place this payout on hold?"
                confirmLabel="Place on hold"
                message="This freezes the supplier's pending payout. There's no automatic release in V1 — it stays held until you lift it manually."
                className={`${ADMIN_FRAME} block px-4 pb-3`}
              >
                <input type="hidden" name="payout_id" value={row.payout_id} />
                <ReasonRow name="Hold reason" placeholder="Hold reason" required />
                <SubmitButton className={actionButtonClass('neutral', { extra: 'mt-2 w-full justify-center' })}>
                  <PauseCircle aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                  Place on hold
                </SubmitButton>
              </ConfirmForm>
            </RecordSection>
          ) : (
            /* 🚨 THE WAY BACK. Holding was fully wired and releasing was not:
             * `releasePayoutHoldAction` existed, was audit-logged, and NO PAGE
             * IMPORTED IT — so a payout could be frozen, listed under the "On
             * hold" filter, and never lifted. This branch rendered `null`.
             *
             * 🔑 The hold confirmation PROMISES this control in so many words —
             * "it stays held until you lift it manually" — which is what made
             * the absence invisible: the screen said the lever existed.
             * A forward primitive with no inverse, and a promise the product
             * could not keep. */
            <RecordSection label="Release hold">
              <ConfirmForm
                action={releasePayoutHoldAction}
                title="Release this hold?"
                confirmLabel="Release hold"
                message="The payout goes back to its normal schedule and the supplier can be paid again. The release is recorded against your account."
                className={`${ADMIN_FRAME} block px-4 pb-3`}
              >
                <input type="hidden" name="payout_id" value={row.payout_id} />
                <ReasonRow name="Why release? (optional)" placeholder="Why release? (optional)" />
                <SubmitButton className={actionButtonClass('neutral', { extra: 'mt-2 w-full justify-center' })}>
                  <PlayCircle aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                  Release hold
                </SubmitButton>
              </ConfirmForm>
            </RecordSection>
          )}
        </>
      ) : null}
    </div>
  );
}

function FlashBanner({ flash, error }: { flash?: string; error?: string }) {
  if (!flash && !error) return null;
  return (
    <div className="mb-4 space-y-2">
      {flash ? (
        <p className="rounded-md border border-success-300/50 bg-success-50 px-4 py-3 text-sm text-success-900">
          {decodeURIComponent(flash)}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(error)}
        </p>
      ) : null}
    </div>
  );
}

function legacyStageToPayoutStage(legacy: string): PayoutStage {
  switch (legacy) {
    case 'immediate':
      return 'immediate_full';
    case 'reservation':
      return 'stage_1_confirm';
    case 'pre_event':
      return 'stage_2_event_start';
    case 'post_event':
      return 'stage_3_event_end';
    default:
      return 'immediate_full';
  }
}

function formatTimestamp(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // A8·A-23: Manila time, as Subscriptions and Payment options print it — the server runs in UTC.
  return d.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
