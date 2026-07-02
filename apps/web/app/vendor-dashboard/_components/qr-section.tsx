import Link from 'next/link';
import { Download } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { renderUrlQrSvg } from '@/lib/qr';
import {
  buildVendorInviteUrl,
  vendorCoverageCategories,
} from '@/lib/vendor-couple-invite';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchVendorContracts } from '@/lib/contracts';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { CopyButton } from '@/app/_components/copy-button';
import { SubmitButton } from '@/app/_components/submit-button';
import { LockedQrGenerator } from '@/app/vendor-dashboard/invite/_components/locked-qr-generator';

import { QrCard } from './qr-card';

/**
 * VendorQrSection — the vendor's QR row (Shortlist ↔ Locked), self-contained.
 *
 * Relocated 2026-07-02 (owner) from My Shop to the top of My Customers, right
 * above the customers table. Everything it needs — event types, the service
 * picker, contracts, and the rendered QR itself — is fetched here off the
 * caller's `vendorProfileId`, so the host page only passes identity + the raw
 * `et`/`cat` scope params from the URL. Fail-soft throughout (owner rule: a QR
 * query hiccup must never take down the page it lives on).
 *
 * The "Update QR" form is a plain GET back to the current page; pass `month`
 * (the calendar's `?m=`) so scoping the QR doesn't reset the month view.
 */
export async function VendorQrSection({
  vendorProfileId,
  slug,
  profileServices,
  rawEt,
  rawCat,
  month,
}: {
  vendorProfileId: string;
  slug: string | null;
  profileServices: string[];
  rawEt?: string;
  rawCat?: string;
  month?: string;
}) {
  const supabase = await createClient();

  // Locked-QR service picker = the vendor's own leaf offerings (DB-driven), with
  // a coverage-category fallback for vendors who haven't published services yet.
  const coverage = vendorCoverageCategories(profileServices);
  const eventTypes = await getCreatableEventTypes().catch(() => []);
  const activeServices = (
    await fetchVendorServices(supabase, vendorProfileId).catch(() => [])
  ).filter((s) => s.is_active);
  const serviceOptions = activeServices.length
    ? activeServices.map((s) => ({
        value: s.vendor_service_id,
        label:
          s.title ?? VENDOR_CATEGORY_LABEL[s.category as VendorCategory] ?? s.category,
      }))
    : coverage.map((c) => ({ value: c as string, label: VENDOR_CATEGORY_LABEL[c] ?? c }));
  const contractOptions = (
    await fetchVendorContracts(supabase, vendorProfileId).catch(() => [])
  )
    .filter((c) => c.status !== 'cancelled')
    .map((c) => ({ value: c.contract_id, label: c.title }));

  const selectedCat =
    rawCat && coverage.includes(rawCat as VendorCategory)
      ? (rawCat as VendorCategory)
      : null;
  const selectedEt = rawEt && eventTypes.some((t) => t.key === rawEt) ? rawEt : null;

  let shortlistBody: React.ReactNode;
  let lockedBody: React.ReactNode;
  if (slug) {
    const inviteUrl = buildVendorInviteUrl(slug, {
      eventType: selectedEt,
      category: selectedCat,
    });
    const qrSvg = await renderUrlQrSvg(inviteUrl, 200);
    shortlistBody = (
      <ShortlistBody
        inviteUrl={inviteUrl}
        qrSvg={qrSvg}
        eventTypes={eventTypes}
        coverage={coverage}
        selectedEt={selectedEt}
        selectedCat={selectedCat}
        month={month}
      />
    );
    lockedBody = (
      <LockedBody
        eventTypes={eventTypes.map((t) => ({ value: t.key, label: t.label }))}
        services={serviceOptions}
        contracts={contractOptions}
      />
    );
  } else {
    const publishPrompt = (
      <div className="text-sm text-ink/70">
        Publish your business profile first — your QR is built from your public
        page.{' '}
        <Link
          href="/vendor-dashboard/profile"
          className="font-medium text-terracotta hover:underline"
        >
          Set up my page
        </Link>
      </div>
    );
    shortlistBody = publishPrompt;
    lockedBody = publishPrompt;
  }

  return <QrCard shortlist={shortlistBody} locked={lockedBody} />;
}

/* ─── QR bodies ─────────────────────────────────────────────────────────── */
function ShortlistBody({
  inviteUrl,
  qrSvg,
  eventTypes,
  coverage,
  selectedEt,
  selectedCat,
  month,
}: {
  inviteUrl: string;
  qrSvg: string;
  eventTypes: { key: string; label: string }[];
  coverage: VendorCategory[];
  selectedEt: string | null;
  selectedCat: VendorCategory | null;
  month?: string;
}) {
  const qrDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <div className="shrink-0 text-center">
        <div
          className="rounded-2xl border bg-white p-3 [&_svg]:h-[160px] [&_svg]:w-[160px]"
          style={{ borderColor: 'var(--m-line)' }}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-1 text-[11px] text-ink/45">Reusable · scan anytime</p>
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <p className="text-sm text-ink/70">
          Couples scan to save your shop to their shortlist — same code every
          time.
        </p>

        <form method="GET" className="grid gap-2 sm:grid-cols-2" aria-label="Scope the shortlist QR">
          {/* Keep the calendar's month view when scoping the QR (both share this URL). */}
          {month ? <input type="hidden" name="m" value={month} /> : null}
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Event</span>
            <select name="et" defaultValue={selectedEt ?? ''} className="input-field w-full">
              <option value="">Any event type</option>
              {eventTypes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Service</span>
            <select name="cat" defaultValue={selectedCat ?? ''} className="input-field w-full">
              <option value="">All my services</option>
              {coverage.map((c) => (
                <option key={c} value={c}>
                  {VENDOR_CATEGORY_LABEL[c] ?? c}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="button-secondary" pendingLabel="Updating…">
              Update QR
            </SubmitButton>
          </div>
        </form>

        <div className="flex items-center gap-2">
          <code
            className="min-w-0 flex-1 truncate rounded-lg border bg-white px-3 py-2 text-xs"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            {inviteUrl}
          </code>
          <CopyButton value={inviteUrl} label="Copy link" />
        </div>

        <a
          href={qrDataUri}
          download="setnayan-shortlist-qr.svg"
          className="button-secondary inline-flex items-center gap-2"
        >
          <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Download QR
        </a>
      </div>
    </div>
  );
}

function LockedBody({
  eventTypes,
  services,
  contracts,
}: {
  eventTypes: { value: string; label: string }[];
  services: { value: string; label: string }[];
  contracts: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/70">
        Lock one customer to a plan and downpayment. Scanning freezes the deal
        onto their event.
      </p>
      <LockedQrGenerator eventTypes={eventTypes} services={services} contracts={contracts} />
      <Link
        href="/vendor-dashboard/locked-qr"
        className="inline-block text-sm font-medium text-terracotta hover:underline"
      >
        View your issued Locked QRs →
      </Link>
    </div>
  );
}
