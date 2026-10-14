import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { renderUrlQrSvg } from '@/lib/qr';
import { buildVendorInviteUrl, vendorCoverageCategories } from '@/lib/vendor-couple-invite';
import { buildVendorLockUrl } from '@/lib/vendor-locked-qr';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { formatPhp } from '@/lib/orders';
import { fetchVendorServices } from '@/lib/vendor-services';
import { fetchVendorContracts } from '@/lib/contracts';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { rangeWords } from '@/lib/vendor-dates';
import { manilaTodayIso } from '@/lib/vendor-cashflow';
import { LockedQrGenerator } from './_components/locked-qr-generator';
import { QrCodes, type IssuedRow, type QrPick } from './_components/qr-codes';

export const metadata = { title: 'QR codes · Supplier' };
export const dynamic = 'force-dynamic';

/**
 * QR CODES — the shop's two codes on ONE page (S-PR3; plan § 2 "`/invite` + `/locked-qr` — Merge: one 'QR codes'
 * (Shortlist · Booked — one dropdown), ledger inside"; prototype frames 10 · 40; kind 24 QR card).
 *
 *   • Shortlist · free — stateless slug invite; a scan imports the shop onto the couple's shortlist under the picked
 *     event type + service.
 *   • Booked · one-use — the shipped Locked QR: a single-use code that carries the deal (total + first payment +
 *     schedule + proof); a scan locks the booking, freezes the plan and records the first payment
 *     (`vendor_claim_locked_qr()`). Its ledger — every code issued, claimed / pending / void — is the Issued fold
 *     (it was `/locked-qr`, which now forwards here with the fold open).
 *
 * Reached from Customers › Dates (the QR codes row); back goes there.
 */
const BOOKED_ERRORS: Record<string, string> = {
  category: 'Pick at least one service you actually offer.',
  total: 'Set a total value greater than ₱0.',
  downpayment: 'Record the first payment you received.',
  overpaid: 'The first payment can’t be more than the total value.',
  proof: 'Upload the payment proof before making the code.',
  contract: 'Pick one of your saved contracts to attach.',
  description: 'Describe what the couple availed.',
  event_date: 'Set the agreed event date.',
  date_unavailable:
    'That date is already booked or blocked on your calendar — you can’t lock a second booking on it. Free it up first, or use the waitlist.',
};

type TokenRow = {
  token: string;
  public_id: string;
  category: string;
  total_php: number | string | null;
  initial_paid_php: number | string | null;
  status: 'pending' | 'claimed' | 'void';
  created_at: string;
  claimed_at: string | null;
};

const DATES_HREF = '/vendor-dashboard/customers?seg=dates';
const QR_HREF = '/vendor-dashboard/invite';

export default async function VendorQrCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ et?: string; cat?: string; mode?: string; issued?: string; error?: string; ledger?: string }>;
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
  // ── A DEAD END, REMOVED 2026-08-09 ─────────────────────────────────────────
  // This used to be `Boolean(slug && is_published)`, and the refusal it rendered
  // read "Publish your business profile first". THERE IS NO SUCH BUTTON: the
  // only `name="is_published"` control in the entire app is on the ADMIN vendor
  // edit page, and the one vendor-side action that ever wrote the column
  // (`saveVendorProfile`) had no caller from the My Shop inline-edit rewrite
  // until it was deleted outright, later the same day as this fix — it wrote the
  // column from an absent checkbox, so any form wired to it would have
  // UNPUBLISHED the shop (`lib/vendor-publish-guard.test.ts` now forbids the
  // shape). Approving a shop doesn't set it either — /admin/verify writes
  // public_visibility + verification_state and never touches this column. So the
  // screen asked the vendor to press something that does not exist for them, and
  // the owner's own fully-verified shop sits at is_published = false today and
  // would have hit exactly this wall.
  //
  // The twin of this QR on My Customers gates on `slug` ALONE and has all along
  // — same generator, same output, one door open and its twin bolted. `slug` is
  // the honest requirement: the QR encodes the shop's public address, and that
  // address is minted by a database trigger the moment a shop is named, so any
  // shop that finished /open-shop has one.
  //
  // Owner rule this restores (2026-08-09): bringing in the customers you already
  // have is FREE and works BEFORE approval. Gating it on an admin-only flag made
  // it wait for approval, which is the opposite.
  const canShare = Boolean(slug);
  const vendorProfileId = (profile as { vendor_profile_id: string }).vendor_profile_id;
  const today = manilaTodayIso();
  // The shop's coverage words ride on the profile already read — no second read of the same row.
  const profileServices = ((profile as { services?: string[] | null }).services ?? []) as string[];
  const kindLabel = await cardKindLabeller();
  const modeOptions: QrPick[] = [
    { key: 'shortlist', label: 'Shortlist · free', href: `${QR_HREF}?mode=shortlist` },
    { key: 'locked', label: 'Booked · one-use', href: `${QR_HREF}?mode=locked` },
  ];

  if (!canShare) {
    return <QrCodes mode={mode} backHref={DATES_HREF} modeOptions={modeOptions} canShare={false} setupHref="/vendor-dashboard/shop" shortlist={null} booked={null} />;
  }

  if (mode === 'shortlist') {
    const eventTypes = await getCreatableEventTypes();
    const coverage = vendorCoverageCategories(profileServices);
    const selectedCat = search.cat && coverage.includes(search.cat as VendorCategory) ? (search.cat as VendorCategory) : null;
    const selectedEt = search.et && eventTypes.some((t) => t.key === search.et) ? search.et : null;
    const url = buildVendorInviteUrl(slug!, { eventType: selectedEt, category: selectedCat });
    const svg = await renderUrlQrSvg(url, 220).catch(() => null);
    const href = (et: string | null, cat: string | null) => {
      const q = new URLSearchParams({ mode: 'shortlist' });
      if (et) q.set('et', et);
      if (cat) q.set('cat', cat);
      return `${QR_HREF}?${q.toString()}`;
    };
    const etLabel = eventTypes.find((t) => t.key === selectedEt)?.label ?? null;
    return (
      <QrCodes
        mode="shortlist"
        backHref={DATES_HREF}
        modeOptions={modeOptions}
        canShare
        setupHref="/vendor-dashboard/shop"
        shortlist={{
          url,
          svg,
          shopName: (profile as { business_name?: string | null }).business_name?.trim() || 'Your shop',
          eventPick: {
            value: selectedEt ?? 'any',
            options: [{ key: 'any', label: 'Any event', href: href(null, selectedCat) }, ...eventTypes.map((t) => ({ key: t.key, label: t.label, href: href(t.key, selectedCat) }))],
          },
          servicePick: {
            value: selectedCat ?? 'all',
            options: [{ key: 'all', label: 'All my services', href: href(selectedEt, null) }, ...coverage.map((c) => ({ key: c, label: kindLabel(c), href: href(selectedEt, c) }))],
          },
          scope: `${selectedCat ? ` as ${kindLabel(selectedCat)}` : ''}${etLabel ? ` on their ${etLabel.toLowerCase()} plan` : ''}`,
        }}
        booked={null}
      />
    );
  }

  // ── BOOKED · ONE-USE ──────────────────────────────────────────────────────
  const [ledgerRead, issuedRead] = await Promise.all([
    supabase
      .from('vendor_locked_qr_tokens')
      .select('token, public_id, category, total_php, initial_paid_php, status, created_at, claimed_at')
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: false }),
    search.issued
      ? supabase
          .from('vendor_locked_qr_tokens')
          .select('token, category, total_php, initial_paid_php, status, claimed_at')
          .eq('token', search.issued)
          .eq('vendor_profile_id', vendorProfileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  // ⚠ EVERY CODE THIS SHOP HAS ISSUED, each one a customer who already paid a first payment. Refused, the Issued fold
  // ⚠ says so — never "none", which reads as "issue a second one for the same booking".
  if (ledgerRead.error) logQueryError('VendorQrCodesPage.ledger', ledgerRead.error, { vendorProfileId }, 'graceful_degrade');
  if (issuedRead.error) logQueryError('VendorQrCodesPage.issued', issuedRead.error, { vendorProfileId }, 'graceful_degrade');
  const ledgerMeasured = !ledgerRead.error && ledgerRead.data !== null;
  const day = (iso: string | null) => (iso ? rangeWords(iso.slice(0, 10), iso.slice(0, 10), today) : '—');
  const ledger: IssuedRow[] | null = ledgerMeasured
    ? ((ledgerRead.data ?? []) as TokenRow[]).map((t) => {
        const total = t.total_php != null ? Number(t.total_php) : null;
        return {
          token: t.token,
          title: kindLabel(t.category),
          line: [
            total != null ? formatPhp(total) : 'No total',
            `${formatPhp(Number(t.initial_paid_php ?? 0))} paid`,
            t.status === 'claimed' ? `claimed ${day(t.claimed_at)}` : `issued ${day(t.created_at)}`,
          ].join(' · '),
          status: t.status,
          showHref: t.status === 'pending' ? `${QR_HREF}?mode=locked&issued=${t.token}` : null,
        };
      })
    : null;

  const tok = issuedRead.data as { token: string; category: string; total_php: number | string | null; initial_paid_php: number | string | null; status: TokenRow['status']; claimed_at: string | null } | null;
  let issued = null as null | { url: string; svg: string | null; title: string; line: string; used: boolean; stamp?: string };
  if (tok) {
    const url = buildVendorLockUrl(tok.token);
    issued = {
      url,
      svg: await renderUrlQrSvg(url, 220).catch(() => null),
      title: `${kindLabel(tok.category)}${tok.total_php ? ` · ${formatPhp(Number(tok.total_php))}` : ''}`,
      line: `${tok.initial_paid_php ? `${formatPhp(Number(tok.initial_paid_php))} paid · ` : ''}one use — give it to that one customer`,
      used: tok.status !== 'pending',
      stamp: tok.status === 'claimed' ? `Used · ${day(tok.claimed_at)}` : tok.status === 'void' ? 'Void' : undefined,
    };
  }

  // The deal form's choices: the shop's own live services (a coverage fallback when none are published) + contracts.
  let generator: ReactNode = null;
  if (!issued) {
    const [eventTypes, services, contracts] = await Promise.all([
      getCreatableEventTypes(),
      fetchVendorServices(supabase, vendorProfileId).catch(() => []),
      fetchVendorContracts(supabase, vendorProfileId).catch(() => []),
    ]);
    const coverage = vendorCoverageCategories(profileServices);
    const live = services.filter((s) => s.is_active);
    generator = (
      <LockedQrGenerator
        eventTypes={eventTypes.map((t) => ({ value: t.key, label: t.label }))}
        services={
          live.length
            ? live.map((s) => ({ value: s.vendor_service_id, label: s.title ?? kindLabel(s.category) }))
            : coverage.map((c) => ({ value: c as string, label: VENDOR_CATEGORY_LABEL[c] ?? kindLabel(c as string) }))
        }
        contracts={contracts.filter((c) => c.status !== 'cancelled').map((c) => ({ value: c.contract_id, label: c.title }))}
      />
    );
  }

  return (
    <QrCodes
      mode="locked"
      backHref={DATES_HREF}
      modeOptions={modeOptions}
      canShare
      setupHref="/vendor-dashboard/shop"
      shortlist={null}
      booked={{
        issued,
        error: search.error ? (BOOKED_ERRORS[search.error] ?? 'Could not make the code. Please try again.') : null,
        generator,
        ledger,
        ledgerOpen: search.ledger === '1',
        newHref: `${QR_HREF}?mode=locked`,
      }}
    />
  );
}
