import Link from 'next/link';
import { redirect } from 'next/navigation';
import { QrCode, Users, ArrowLeft, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { renderUrlQrSvg } from '@/lib/qr';
import {
  buildVendorInviteUrl,
  vendorCoverageCategories,
} from '@/lib/vendor-couple-invite';
import { buildVendorLockUrl } from '@/lib/vendor-locked-qr';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { VENDOR_CATEGORY_LABEL, formatPhp, type VendorCategory } from '@/lib/vendors';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchVendorContracts } from '@/lib/contracts';
import { CopyButton } from '@/app/_components/copy-button';
import { SubmitButton } from '@/app/_components/submit-button';
import { LockedQrGenerator } from './_components/locked-qr-generator';

export const metadata = { title: 'QR Code Generator · Vendor · Setnayan' };

/**
 * QR Code Generator (My Shop). One surface, two modes via a toggle:
 *   • Shortlist QR (default) — stateless slug invite; a scan imports the vendor
 *     onto the couple's shortlist under the picked event-type + service. Free.
 *   • Locked QR — a single-use, per-customer QR that carries the deal (total +
 *     downpayment + schedule + proof); a scan atomically locks the booking,
 *     freezes the plan and records the downpayment (vendor_claim_locked_qr()).
 */
export default async function VendorQrGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{
    et?: string;
    cat?: string;
    mode?: string;
    issued?: string;
    error?: string;
  }>;
}) {
  const search = await searchParams;
  const mode: 'shortlist' | 'locked' = search.mode === 'locked' ? 'locked' : 'shortlist';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const slug = (profile as { business_slug?: string | null }).business_slug ?? null;
  const isPublished = (profile as { is_published?: boolean }).is_published ?? false;
  const canShare = Boolean(slug && isPublished);
  const vendorProfileId = (profile as { vendor_profile_id: string }).vendor_profile_id;

  const { data: profRow } = await supabase
    .from('vendor_profiles')
    .select('services')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const coverage = vendorCoverageCategories(((profRow?.services ?? []) as string[]) ?? []);
  const eventTypes = await getCreatableEventTypes();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <Link
        href="/vendor-dashboard/shop"
        className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.18em] text-ink/50 hover:text-terracotta"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> My Shop
      </Link>

      <header className="mt-4 space-y-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <QrCode className="h-6 w-6 text-terracotta" strokeWidth={1.75} /> QR Code Generator
        </h1>
        {/* Shortlist ↔ Locked toggle */}
        <div
          className="inline-flex rounded-full border border-ink/15 bg-cream p-0.5"
          role="tablist"
          aria-label="QR type"
        >
          <Link
            href="/vendor-dashboard/invite?mode=shortlist"
            role="tab"
            aria-selected={mode === 'shortlist'}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'shortlist' ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'
            }`}
          >
            Shortlist
          </Link>
          <Link
            href="/vendor-dashboard/invite?mode=locked"
            role="tab"
            aria-selected={mode === 'locked'}
            className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'locked' ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'
            }`}
          >
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> Locked
          </Link>
        </div>
        <p className="text-sm text-ink/60">
          {mode === 'locked'
            ? 'Lock in a customer who already paid a downpayment. They scan it once — the booking, payment plan and downpayment land on their plan automatically.'
            : 'Pick the event and service, then show or send this QR. A couple scans it, sets up their free plan, and you land on their shortlist. Free, for you and for them.'}
        </p>
      </header>

      {!canShare ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/20 bg-cream p-6 text-center">
          <Users className="mx-auto h-6 w-6 text-ink/40" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-ink/70">
            Publish your business profile first — your QR is built from your public
            profile.
          </p>
          <Link
            href="/vendor-dashboard/profile"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-medium text-cream hover:bg-ink/90"
          >
            Go to my profile
          </Link>
        </div>
      ) : mode === 'locked' ? (
        <LockedMode
          vendorProfileId={vendorProfileId}
          eventTypes={eventTypes.map((t) => ({ value: t.key, label: t.label }))}
          coverage={coverage.map((c) => ({ value: c, label: VENDOR_CATEGORY_LABEL[c] ?? c }))}
          issued={search.issued ?? null}
          error={search.error ?? null}
          supabase={supabase}
        />
      ) : (
        <ShortlistMode
          slug={slug!}
          coverage={coverage}
          eventTypes={eventTypes}
          rawEt={search.et}
          rawCat={search.cat}
        />
      )}
    </div>
  );
}

// ── Locked mode ─────────────────────────────────────────────────────────────
async function LockedMode({
  vendorProfileId,
  eventTypes,
  coverage,
  issued,
  error,
  supabase,
}: {
  vendorProfileId: string;
  eventTypes: { value: string; label: string }[];
  coverage: { value: string; label: string }[];
  issued: string | null;
  error: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  // Just-issued token → render its single-use QR.
  if (issued) {
    const { data: tok } = await supabase
      .from('vendor_locked_qr_tokens')
      .select('token, event_type, category, service_description, event_date, total_php, initial_paid_php, status')
      .eq('token', issued)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (tok) {
      const lockUrl = buildVendorLockUrl(tok.token as string);
      const qrSvg = await renderUrlQrSvg(lockUrl, 220);
      return (
        <div className="mt-6 rounded-3xl border border-ink/10 bg-cream p-6">
          <div className="flex justify-center">
            <div
              className="rounded-2xl bg-white p-4 shadow-sm [&_svg]:h-[220px] [&_svg]:w-[220px]"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
          <p className="mt-4 text-center text-sm text-ink/70">
            Single-use lock ·{' '}
            {VENDOR_CATEGORY_LABEL[tok.category as VendorCategory] ?? tok.category}
            {tok.total_php ? ` · ${formatPhp(Number(tok.total_php))}` : ''}
            {tok.initial_paid_php
              ? ` · ${formatPhp(Number(tok.initial_paid_php))} paid`
              : ''}
          </p>
          {tok.event_date ? (
            <p className="mt-1 text-center text-xs text-ink/55">
              Wedding date ·{' '}
              {new Date(`${tok.event_date as string}T00:00:00`).toLocaleDateString(
                'en-PH',
                { year: 'numeric', month: 'long', day: 'numeric' },
              )}
            </p>
          ) : null}
          {tok.service_description ? (
            <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
                What the couple availed
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/75">
                {tok.service_description as string}
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs text-ink/75">
              {lockUrl}
            </code>
            <CopyButton value={lockUrl} label="Copy link" />
          </div>
          <p className="mt-4 text-xs text-ink/50">
            Give this to that one customer. It works once — after they claim it,
            the QR is spent.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link
              href="/vendor-dashboard/invite?mode=locked"
              className="inline-block text-sm font-medium text-terracotta hover:underline"
            >
              Create another Locked QR
            </Link>
            <Link
              href="/vendor-dashboard/locked-qr"
              className="inline-block text-sm font-medium text-ink/60 hover:underline"
            >
              View all issued →
            </Link>
          </div>
        </div>
      );
    }
  }

  // DB-driven leaf service list (owner 2026-07): the vendor's own vendor_services
  // offerings, with a coverage-category fallback for vendors with none published.
  const activeServices = (
    await fetchVendorServices(supabase, vendorProfileId).catch(() => [])
  ).filter((s) => s.is_active);
  const serviceOptions = activeServices.length
    ? activeServices.map((s) => ({
        value: s.vendor_service_id,
        label: s.title ?? VENDOR_CATEGORY_LABEL[s.category as VendorCategory] ?? s.category,
      }))
    : coverage;

  // The vendor's saved contracts, offered as templates to attach to this deal
  // (cancelled ones excluded).
  const contractOptions = (await fetchVendorContracts(supabase, vendorProfileId))
    .filter((c) => c.status !== 'cancelled')
    .map((c) => ({ value: c.contract_id, label: c.title }));

  return (
    <>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {error === 'category'
            ? 'Pick at least one service you actually offer.'
            : error === 'total'
              ? 'Set a total value greater than ₱0.'
              : error === 'downpayment'
                ? 'Record the downpayment you received.'
                : error === 'overpaid'
              ? 'The downpayment can’t be more than the total value.'
              : error === 'proof'
                ? 'Upload the payment proof before generating the QR.'
                : error === 'contract'
                  ? 'Pick one of your saved contracts to attach.'
                  : error === 'description'
                    ? 'Describe what the couple availed.'
                    : error === 'event_date'
                      ? 'Set the agreed event date.'
                      : 'Could not create the Locked QR. Please try again.'}
        </p>
      ) : null}
      <LockedQrGenerator
        eventTypes={eventTypes}
        services={serviceOptions}
        contracts={contractOptions}
      />
      <Link
        href="/vendor-dashboard/locked-qr"
        className="mt-4 inline-block text-sm font-medium text-terracotta hover:underline"
      >
        View your issued Locked QRs →
      </Link>
    </>
  );
}

// ── Shortlist mode (unchanged behavior) ─────────────────────────────────────
async function ShortlistMode({
  slug,
  coverage,
  eventTypes,
  rawEt,
  rawCat,
}: {
  slug: string;
  coverage: VendorCategory[];
  eventTypes: { key: string; label: string }[];
  rawEt?: string;
  rawCat?: string;
}) {
  const selectedCat =
    rawCat && coverage.includes(rawCat as VendorCategory) ? (rawCat as VendorCategory) : null;
  const selectedEt = rawEt && eventTypes.some((t) => t.key === rawEt) ? rawEt : null;
  const selectedEtLabel = eventTypes.find((t) => t.key === selectedEt)?.label ?? null;
  const inviteUrl = buildVendorInviteUrl(slug, { eventType: selectedEt, category: selectedCat });
  const qrSvg = await renderUrlQrSvg(inviteUrl, 220);

  return (
    <>
      <form method="GET" className="mt-6 space-y-4 rounded-2xl border border-ink/10 bg-white/60 p-5">
        <input type="hidden" name="mode" value="shortlist" />
        <div className="space-y-1.5">
          <label htmlFor="et" className="block text-sm font-medium text-ink/80">
            Pick an event
          </label>
          <select id="et" name="et" defaultValue={selectedEt ?? ''} className="input-field w-full">
            <option value="">Any event type</option>
            {eventTypes.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
          <p className="text-xs text-ink/50">
            We use this to set up the couple&apos;s event when they scan.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="cat" className="block text-sm font-medium text-ink/80">
            Pick a service
          </label>
          <select id="cat" name="cat" defaultValue={selectedCat ?? ''} className="input-field w-full">
            <option value="">All my services</option>
            {coverage.map((c) => (
              <option key={c} value={c}>{VENDOR_CATEGORY_LABEL[c] ?? c}</option>
            ))}
          </select>
          <p className="text-xs text-ink/50">
            The category you&apos;re shortlisted under on their plan.
          </p>
        </div>

        <SubmitButton
          pendingLabel="Updating…"
          className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          Generate QR
        </SubmitButton>
      </form>

      <div className="mt-6 rounded-3xl border border-ink/10 bg-cream p-6">
        <div className="flex justify-center">
          <div
            className="rounded-2xl bg-white p-4 shadow-sm [&_svg]:h-[220px] [&_svg]:w-[220px]"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>

        {(selectedEtLabel || selectedCat) && (
          <p className="mt-4 text-center text-sm text-ink/70">
            Scans add you{selectedCat ? ` as ${VENDOR_CATEGORY_LABEL[selectedCat] ?? selectedCat}` : ''}
            {selectedEtLabel ? ` to the couple's ${selectedEtLabel.toLowerCase()} plan` : ' to the couple’s plan'}.
          </p>
        )}

        <div className="mt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
            Your Shortlist link
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs text-ink/75">
              {inviteUrl}
            </code>
            <CopyButton value={inviteUrl} label="Copy link" />
          </div>
        </div>

        <ol className="mt-5 space-y-2 text-sm text-ink/65">
          <li>1. Couple scans the QR (or opens your link).</li>
          <li>2. They sign up free and pick or create their event.</li>
          <li>3. You appear on their shortlist — chat + reviews unlock from there.</li>
        </ol>
      </div>
    </>
  );
}
