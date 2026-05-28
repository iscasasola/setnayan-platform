import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  deadlineForQuarter,
  listFilingsForVendor,
  periodLabel,
  type Vendor2307FilingRow,
} from '@/lib/bir/filings';
import { centavosToPesoString } from '@/lib/bir/atc-mapper';
import { markFiledForm, unmarkFiledForm } from './actions';

export const metadata = { title: 'Tax documents · Vendor' };
export const dynamic = 'force-dynamic';

type VendorIdentityRow = {
  vendor_profile_id: string;
  business_name: string;
  tin_number: string | null;
  tin_type: 'individual' | 'corporation' | null;
  registered_business_name: string | null;
  registered_address: string | null;
  registered_zip: string | null;
  bir_service_category:
    | 'professional'
    | 'talent'
    | 'service_supplier'
    | null;
};

export default async function VendorTaxDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Resolve the vendor's profile + filings via the admin client — vendor
  // RLS on vendor_2307_filings allows self-read, but the admin client
  // keeps the join consistent with /admin reads.
  const admin = createAdminClient();
  const { data: vendorRows } = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id,business_name,tin_number,tin_type,registered_business_name,registered_address,registered_zip,bir_service_category',
    )
    .eq('user_id', user.id);
  const vendor = (vendorRows ?? [])[0] as VendorIdentityRow | undefined;
  if (!vendor) {
    redirect('/vendor-dashboard');
  }

  const filings = await listFilingsForVendor(admin, vendor.vendor_profile_id);

  // Banner: any pre-deadline filings the vendor hasn't downloaded yet?
  const today = new Date();
  const pending = filings.filter(
    (f) =>
      f.status === 'generated' &&
      deadlineForQuarter(f.tax_year, f.tax_quarter) > today,
  );
  const missedDeadline = filings.filter(
    (f) =>
      (f.status === 'generated' || f.status === 'queued') &&
      deadlineForQuarter(f.tax_year, f.tax_quarter) < today,
  );

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tax documents
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Receipts for the Setnayan software you buy from us — subscription
          blocks (Pro Vendor / Enterprise), token packs, and other in-app
          purchases — show up here as official receipts.
        </p>
        <p className="max-w-prose text-sm text-ink/60">
          Your direct bookings with couples stay on your own books — Setnayan
          doesn&rsquo;t route payments between you and your clients, so we
          can&rsquo;t issue ORs or BIR forms on those transactions. Ask your
          bookkeeper for current-period tax treatment on direct bookings.
        </p>
      </header>

      <article className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <div className="space-y-1">
          <p className="font-medium">Legacy Form 2307 records below</p>
          <p>
            {/* Retired 2026-05-28 V2 cutover: Setnayan-issued Form 2307 for EWT
                on Setnayan-Pay-routed payouts retires. The filings list below
                covers V1 records only — your direct-booking tax filings stay
                with your accountant going forward. */}
            Any 2307 PDFs below cover Setnayan-routed payouts from before our
            payments model changed. New direct bookings settle outside Setnayan,
            so we no longer generate 2307s for them.
          </p>
        </div>
      </article>

      <BirIdentityCard vendor={vendor} />

      {missedDeadline.length > 0 ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Past the filing deadline</p>
              <p>
                {missedDeadline.length} filing
                {missedDeadline.length === 1 ? ' is' : 's are'} past the BIR
                deadline. Download immediately and consult your accountant about
                late-credit options.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {pending.length} new filing
                {pending.length === 1 ? '' : 's'} ready to download
              </p>
              <p>
                We&rsquo;ve generated your most recent 2307. Download the PDF
                and store it with your tax records before the BIR deadline.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {filings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-10 text-center">
          <FileText
            aria-hidden
            className="mx-auto mb-3 h-8 w-8 text-ink/30"
            strokeWidth={1.5}
          />
          <h2 className="mb-1 text-base font-semibold text-ink">
            No legacy 2307 records on file
          </h2>
          <p className="mx-auto max-w-sm text-sm text-ink/60">
            Your direct bookings settle outside Setnayan, so your accountant
            handles current-period EWT and Form 2307. Receipts for Setnayan
            software you buy — subscriptions, token packs — appear in your
            inbox and on your account.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filings.map((f) => (
            <FilingCard key={f.filing_id} filing={f} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BirIdentityCard({ vendor }: { vendor: VendorIdentityRow }) {
  const missing: string[] = [];
  if (!vendor.tin_number) missing.push('TIN');
  if (!vendor.registered_business_name) missing.push('Registered name');
  if (!vendor.registered_address) missing.push('Registered address');
  if (!vendor.tin_type) missing.push('TIN type (individual / corporation)');
  if (!vendor.bir_service_category) missing.push('BIR service category');

  return (
    <div className="mb-6 rounded-xl border border-ink/10 bg-cream p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Your BIR identity</h2>
        <Link
          href="/vendor-dashboard"
          className="text-xs text-terracotta hover:underline"
        >
          Edit profile
        </Link>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Detail
          label="TIN"
          value={vendor.tin_number}
          tone={vendor.tin_number ? 'normal' : 'missing'}
        />
        <Detail
          label="Registered name"
          value={vendor.registered_business_name ?? vendor.business_name}
          tone={
            vendor.registered_business_name
              ? 'normal'
              : vendor.business_name
                ? 'soft-fallback'
                : 'missing'
          }
        />
        <Detail
          label="Registered address"
          value={vendor.registered_address}
          tone={vendor.registered_address ? 'normal' : 'missing'}
        />
        <Detail
          label="ZIP"
          value={vendor.registered_zip}
          tone={vendor.registered_zip ? 'normal' : 'soft-fallback'}
        />
        <Detail
          label="TIN type"
          value={vendor.tin_type}
          tone={vendor.tin_type ? 'normal' : 'missing'}
        />
        <Detail
          label="BIR service category"
          value={vendor.bir_service_category}
          tone={vendor.bir_service_category ? 'normal' : 'soft-fallback'}
        />
      </dl>
      {missing.length > 0 ? (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Missing on your profile:{' '}
          <strong>{missing.join(' · ')}</strong>. We use these fields on the
          official receipts we issue for the Setnayan software you buy. Contact{' '}
          <a className="underline" href="mailto:help@setnayan.com">help@setnayan.com</a>
          {' '}to update — TIN changes require re-verification.
        </p>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | null | undefined;
  tone: 'normal' | 'missing' | 'soft-fallback';
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </dt>
      <dd
        className={
          tone === 'missing'
            ? 'text-sm text-red-700'
            : tone === 'soft-fallback'
              ? 'text-sm text-ink/55'
              : 'text-sm text-ink'
        }
      >
        {value || (tone === 'missing' ? 'Not set' : '—')}
      </dd>
    </div>
  );
}

function FilingCard({ filing }: { filing: Vendor2307FilingRow }) {
  const deadline = deadlineForQuarter(filing.tax_year, filing.tax_quarter);
  const today = new Date();
  const overdue = filing.status !== 'filed_manually' && deadline < today;
  const grossPhp = centavosToPesoString(
    filing.totals?.gross_centavos ?? 0,
  );
  const ewtPhp = centavosToPesoString(filing.totals?.ewt_centavos ?? 0);

  return (
    <li className="rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {periodLabel(filing.tax_year, filing.tax_quarter)}
          </p>
          <p className="font-mono text-[11px] text-ink/55">
            {filing.period_from} → {filing.period_to}
          </p>
          <p className="mt-1 text-xs text-ink/65">
            BIR deadline:{' '}
            <span
              className={
                overdue ? 'font-semibold text-red-700' : 'text-ink/70'
              }
            >
              {deadline.toISOString().slice(0, 10)}
            </span>
          </p>
        </div>
        <StatusPill status={filing.status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Stat label="Gross paid" value={`PHP ${grossPhp}`} />
        <Stat label="EWT withheld" value={`PHP ${ewtPhp}`} />
        <Stat
          label="ATC"
          value={filing.totals?.atc_rows?.[0]?.atc_code ?? '—'}
        />
        <Stat
          label="Rate"
          value={
            filing.totals?.atc_rows?.[0]
              ? `${(filing.totals.atc_rows[0].rate_bps / 100).toFixed(2)}%`
              : '—'
          }
        />
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {filing.pdf_public_url ? (
          <a
            href={filing.pdf_public_url}
            target="_blank"
            rel="noreferrer"
            className="button-secondary inline-flex h-9 items-center gap-2 px-3 text-xs"
          >
            <Download aria-hidden className="h-3.5 w-3.5" />
            Download PDF
          </a>
        ) : (
          <span className="text-xs text-ink/55">
            PDF pending — admin will regenerate.
          </span>
        )}
        {filing.status !== 'filed_manually' ? (
          <form action={markFiledForm}>
            <input type="hidden" name="filing_id" value={filing.filing_id} />
            <button
              type="submit"
              className="button-secondary inline-flex h-9 items-center gap-2 px-3 text-xs"
            >
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
              Mark as filed
            </button>
          </form>
        ) : (
          <form action={unmarkFiledForm}>
            <input type="hidden" name="filing_id" value={filing.filing_id} />
            <button
              type="submit"
              className="text-xs text-ink/55 hover:underline"
            >
              Un-mark as filed
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: Vendor2307FilingRow['status'] }) {
  const map: Record<string, { label: string; tone: string }> = {
    queued: {
      label: 'Queued',
      tone: 'bg-ink/10 text-ink/65',
    },
    generated: {
      label: 'Ready to download',
      tone: 'bg-amber-100 text-amber-900',
    },
    downloaded: {
      label: 'Downloaded',
      tone: 'bg-emerald-100 text-emerald-800',
    },
    filed_manually: {
      label: 'Filed',
      tone: 'bg-emerald-100 text-emerald-900',
    },
    error: {
      label: 'Error — admin notified',
      tone: 'bg-red-100 text-red-900',
    },
  };
  const m = map[status] ?? map.queued ?? {
    label: status,
    tone: 'bg-ink/10 text-ink/65',
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${m.tone}`}
    >
      {m.label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </p>
      <p className="text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
