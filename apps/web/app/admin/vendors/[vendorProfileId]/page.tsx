import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { ArrowLeft, Wallet } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { requireAdmin } from '@/lib/admin/require-admin';
import { logAdminDataAccess } from '@/lib/admin-data-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isShopLive } from '@/lib/vendor-visibility';
import { formatCount } from '@/lib/format-number';
import { formatCentavosPhp, formatPhpRounded } from '@/lib/php';
import { PAYOUT_STAGE_LABEL, type PayoutStage } from '@/lib/payouts';
import { TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';
import { VERIFICATION_STATE_LABEL, parseVerificationState } from '@/lib/vendor-verification';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { displayServiceLabel } from '@/lib/vendors';
import { cardAnchorId } from '@/lib/service-card-view-model';
import { cardStatusOf } from '@/lib/service-card-moderation';
import { ServiceCardsSection, type AdminServiceCard } from './_components/service-cards-section';
import { SampleShopSwitch } from './_components/sample-shop-switch';

export const metadata = { title: 'Supplier · Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * ONE admin page per supplier — /admin/vendors/<vendor_profile_id or S89V-…>.
 *
 * Built 2026-10-01 (admin audit 2026-09-30 row 26 · §3.4). Integrity watch and
 * Repost watch said "Open vendor →" and sent you to /edit, which bounces every
 * CLAIMED shop to the unfiltered list — the shop you were looking at was lost,
 * and there was no page for a claimed supplier at all, only its /plan and
 * /team. This is that page: who runs it, its plan, its team, whether it is
 * checked, what it has been paid, and whether it is a demo shop.
 *
 * 🔑 EVERY READ BINDS ITS ERROR AND RENDERS "Couldn't load" — never `0`, never
 * "none", never a blank. A refused read and a quiet shop look identical as
 * data, and only one of them is true. Held by
 * lib/admin-supplier-page-is-honest.test.ts.
 *
 * Read-only on purpose: every change lives on the page that already owns it
 * (Plan, Team, Verify, Payouts, Edit for an unclaimed shop). This page links
 * there; it does not grow a second copy of any of those forms.
 *
 * ONE EXCEPTION, because no other page owns it (admin minimum for the 7 Nov
 * 2026 supplier registration): "Service cards" (#cards) lists every card of the
 * shop and carries the only take-down / put-back / remove-photo controls in the
 * console (./card-actions.ts).
 */

const PAYOUT_CAP = 10;
const CARD_CAP = 50;

const PUBLIC_ID_RE = /^S89V-[0-9A-Za-z]{10}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COULD_NOT_LOAD = "Couldn't load";

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

type Props = {
  params: Promise<{ vendorProfileId: string }>;
  searchParams?: Promise<{ card?: string; card_error?: string }>;
};

/** What the last card action did — the result line above "Service cards". */
const CARD_RESULT: Readonly<Record<string, string>> = {
  'taken-down': 'Card taken down. Couples can no longer see it, and the supplier has been told why.',
  'back-live': 'Card put back. It is live again, and the supplier has been told.',
  'back-draft': 'Take-down lifted. The card was not live before, so it is back as a draft.',
  'back-draft-gate':
    'Take-down lifted, but the card could not go live again (it is missing a cover, a price or what is included). It is a draft; the supplier has been told.',
  'photo-removed': 'Photo removed from the card. The supplier has been told why.',
};

type CardRow = {
  vendor_service_id: string;
  public_id: string | null;
  title: string | null;
  category: string | null;
  pricing_basis: string | null;
  starting_price_php: number | null;
  per_pax_price_php: number | null;
  is_active: boolean | null;
  taken_down_at: string | null;
  taken_down_reason: string | null;
  primary_photo_r2_key: string | null;
  showcase_photo_r2_keys: string[] | null;
};

function cardPrice(c: CardRow): string {
  if (c.pricing_basis === 'per_pax' && c.per_pax_price_php) return `${formatPhpRounded(c.per_pax_price_php)} per guest`;
  if (c.starting_price_php) return `From ${formatPhpRounded(c.starting_price_php)}`;
  return 'No price yet';
}

type PayoutRow = {
  payout_id: string;
  public_id: string | null;
  payout_stage: PayoutStage | null;
  vendor_net_centavos: number | null;
  amount_centavos: number | null;
  scheduled_at: string | null;
  paid_at: string | null;
  on_hold: boolean | null;
};

export default async function AdminSupplierPage({ params, searchParams }: Props) {
  const { userId: adminUserId } = await requireAdmin();
  const { vendorProfileId: rawId } = await params;
  const sp = (await searchParams) ?? {};
  const cardResult = sp.card ? (CARD_RESULT[sp.card] ?? null) : null;
  const cardError = sp.card_error?.slice(0, 300) ?? null;
  const id = decodeURIComponent(rawId).trim();
  const byPublicId = PUBLIC_ID_RE.test(id);
  if (!byPublicId && !UUID_RE.test(id)) notFound();

  const admin = createAdminClient();

  // ── the shop itself ─────────────────────────────────────────────────────
  const shopRead = await admin
    .from('vendor_profiles')
    .select(
      'vendor_profile_id, public_id, user_id, business_name, business_slug, location_city, public_visibility, verification_state, tier_state, tier_expires_at, is_demo, created_at',
    )
    .eq(byPublicId ? 'public_id' : 'vendor_profile_id', id)
    .maybeSingle();
  if (shopRead.error) {
    logQueryError('admin/vendors/[vendorProfileId]:shop', shopRead.error);
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <PageMasthead title="Supplier" />
        <p role="alert" className="rounded-lg bg-mulberry/10 p-4 text-sm text-mulberry">
          {COULD_NOT_LOAD} this supplier — the database refused the read. This is not the same as the
          supplier not existing.
        </p>
      </main>
    );
  }
  const shop = shopRead.data;
  if (!shop) notFound();
  const shopId = shop.vendor_profile_id as string;
  const ownerId = (shop.user_id as string | null) ?? null;

  // ── who runs it ─────────────────────────────────────────────────────────
  const ownerRead = ownerId
    ? await admin.from('users').select('user_id, display_name, email').eq('user_id', ownerId).maybeSingle()
    : null;
  if (ownerRead?.error) logQueryError('admin/vendors/[vendorProfileId]:owner', ownerRead.error);
  const ownerLabel = !ownerId
    ? 'Not claimed yet'
    : ownerRead?.error
      ? COULD_NOT_LOAD
      : ((ownerRead?.data?.display_name as string | null)?.trim() ||
        (ownerRead?.data?.email as string | null) ||
        'Account without a name');

  // ── team size (head-only; its error decides its own cell) ───────────────
  const teamRead = await admin
    .from('vendor_team_members')
    .select('vendor_team_member_id', { count: 'exact', head: true })
    .eq('vendor_profile_id', shopId);
  if (teamRead.error) logQueryError('admin/vendors/[vendorProfileId]:team', teamRead.error);
  const teamCell =
    teamRead.error || teamRead.count === null
      ? COULD_NOT_LOAD
      : `${formatCount(teamRead.count)} ${teamRead.count === 1 ? 'person' : 'people'}`;

  // ── latest verification application ─────────────────────────────────────
  const appRead = await admin
    .from('vendor_verification_applications')
    .select('status, submitted_at, decided_at')
    .eq('vendor_profile_id', shopId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (appRead.error) logQueryError('admin/vendors/[vendorProfileId]:verification', appRead.error);
  const applicationCell = appRead.error
    ? COULD_NOT_LOAD
    : appRead.data
      ? `${String(appRead.data.status).replace(/_/g, ' ')} · sent ${fmtDate(appRead.data.submitted_at as string | null)}`
      : 'No documents sent yet';

  // ── payouts (the newest few; the full list lives on Payouts) ────────────
  const payoutRead = await admin
    .from('vendor_payouts')
    .select('payout_id, public_id, payout_stage, vendor_net_centavos, amount_centavos, scheduled_at, paid_at, on_hold')
    .eq('vendor_profile_id', shopId)
    .order('created_at', { ascending: false })
    .limit(PAYOUT_CAP);
  if (payoutRead.error) logQueryError('admin/vendors/[vendorProfileId]:payouts', payoutRead.error);
  const payouts = payoutRead.error ? null : ((payoutRead.data ?? []) as PayoutRow[]);

  // ── service cards (every one — live, draft or taken down) ───────────────
  const cardRead = await admin
    .from('vendor_services')
    .select(
      'vendor_service_id, public_id, title, category, pricing_basis, starting_price_php, per_pax_price_php, is_active, taken_down_at, taken_down_reason, primary_photo_r2_key, showcase_photo_r2_keys',
    )
    .eq('vendor_profile_id', shopId)
    .order('created_at', { ascending: true })
    .limit(CARD_CAP);
  if (cardRead.error) logQueryError('admin/vendors/[vendorProfileId]:cards', cardRead.error);
  const shopIsLive = isShopLive(shop);
  const slug = (shop.business_slug as string | null) ?? null;
  const cards: AdminServiceCard[] | null = cardRead.error
    ? null
    : await Promise.all(
        ((cardRead.data ?? []) as CardRow[]).map(async (c) => {
          const status = cardStatusOf(c);
          const coverKey = c.primary_photo_r2_key?.trim() || null;
          const showcaseKeys = (c.showcase_photo_r2_keys ?? []).filter((k) => k && k.trim());
          const [coverUrl, ...showcaseUrls] = await Promise.all(
            [coverKey, ...showcaseKeys].map((k) => (k ? displayUrlForStoredAsset(k).catch(() => null) : null)),
          );
          return {
            id: c.vendor_service_id,
            publicId: c.public_id,
            title: c.title?.trim() || 'Card without a name',
            kind: c.category ? displayServiceLabel(c.category) : 'No category',
            price: cardPrice(c),
            status,
            takenDownReason: c.taken_down_reason,
            cover: coverKey ? { key: coverKey, url: coverUrl ?? null } : null,
            showcase: showcaseKeys.map((key, i) => ({ key, url: showcaseUrls[i] ?? null })),
            publicHref:
              status === 'live' && shopIsLive && slug
                ? `/v/${slug}${c.public_id ? `?service=${encodeURIComponent(c.public_id)}` : ''}#${cardAnchorId(c.public_id, c.vendor_service_id)}`
                : null,
          };
        }),
      );

  // RA 10173 who-viewed-whom — the owner's account shows this page was opened.
  after(async () => {
    if (!ownerId) return;
    await logAdminDataAccess(admin, {
      adminUserId,
      accessedUserId: ownerId,
      surface: 'admin_supplier_page',
      context: { vendor_profile_id: shopId },
    });
  });

  const tier = asVendorTier(shop.tier_state as string | null);
  const verification = parseVerificationState(shop.verification_state);
  const name = (shop.business_name as string | null)?.trim() || 'Supplier without a name';

  const facts: Array<{ label: string; value: ReactNode }> = [
    {
      label: 'Run by',
      value: ownerId && !ownerRead?.error ? (
        <Link href={`/admin/users/${ownerId}`} className="underline underline-offset-2 hover:text-ink">
          {ownerLabel}
        </Link>
      ) : (
        ownerLabel
      ),
    },
    { label: 'City', value: (shop.location_city as string | null) || '—' },
    // One definition of live (lib/vendor-visibility.ts): `is_published` is a
    // dead column nothing in the approval flow sets.
    { label: 'Shows in search', value: shopIsLive ? 'Yes' : 'No' },
    // "Demo shop" is no longer a read-only fact here: it is the "Sample shop" switch under this list.
    { label: 'Joined', value: fmtDate(shop.created_at as string | null) },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <Link
        href="/admin/accounts?tab=vendors"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        All suppliers
      </Link>

      {/* The record's name IS the content here, so the masthead carries it. */}
      <PageMasthead titleNode={name} />
      <div className="space-y-1">
        <p className="font-serif text-2xl text-ink">{name}</p>
        <p className="font-mono text-[11px] text-ink/55">{shop.public_id as string}</p>
      </div>

      <section className="sn-tile p-5">
        <h2 className="mb-3 text-sm font-medium text-ink">Shop</h2>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-ink/55">{f.label}</dt>
              <dd className="text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
        {/* 🧪 Sample shop (owner, 6 Nov 2026) — one switch, saves in place; writes `is_demo`. */}
        <div className="mt-4">
          <SampleShopSwitch shopId={shopId} initial={shop.is_demo === true} />
        </div>
        {!ownerId ? (
          <Link
            href={`/admin/vendors/${shopId}/edit`}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-ink/5 px-4 text-sm font-medium text-ink hover:bg-ink/10"
          >
            Edit this unclaimed shop
          </Link>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sn-tile p-5">
          <h2 className="text-xs text-ink/55">Plan</h2>
          <p className="mt-1 text-base font-medium text-ink">{TIER_LABEL[tier]}</p>
          <p className="text-xs text-ink/55">
            {shop.tier_expires_at ? `Until ${fmtDate(shop.tier_expires_at as string)}` : 'No end date'}
          </p>
          <Link
            href={`/admin/vendors/${shopId}/plan`}
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-ink underline underline-offset-2"
          >
            Change plan
          </Link>
        </div>
        <div className="sn-tile p-5">
          <h2 className="text-xs text-ink/55">Team</h2>
          <p className="mt-1 text-base font-medium text-ink">{teamCell}</p>
          <Link
            href={`/admin/vendors/${shopId}/team`}
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-ink underline underline-offset-2"
          >
            See team
          </Link>
        </div>
        <div className="sn-tile p-5">
          <h2 className="text-xs text-ink/55">Verification</h2>
          <p className="mt-1 text-base font-medium text-ink">{VERIFICATION_STATE_LABEL[verification]}</p>
          <p className="text-xs text-ink/55">{applicationCell}</p>
          <Link
            href="/admin/verify"
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-ink underline underline-offset-2"
          >
            Verification queue
          </Link>
        </div>
      </section>

      {cardResult ? (
        <p role="status" className="rounded-lg bg-success-100 p-3 text-sm text-success-900">
          {cardResult}
        </p>
      ) : null}
      {cardError ? (
        <p role="alert" className="rounded-lg bg-danger-100 p-3 text-sm text-danger-900">
          {cardError}
        </p>
      ) : null}
      <ServiceCardsSection shopId={shopId} cards={cards} cap={CARD_CAP} />

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-ink">Payouts</h2>
          <Link
            href={`/admin/payouts?filter=all&vendor=${shopId}`}
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink underline underline-offset-2"
          >
            All their payouts
          </Link>
        </div>
        <ConsoleTable
          rows={payouts}
          readPermitted
          readError={payoutRead.error}
          reads="this supplier's payouts"
          cap={PAYOUT_CAP}
          label="Newest payouts to this supplier"
          minWidth="32rem"
          rowKey={(p) => p.payout_id}
          empty={{
            Icon: Wallet,
            title: 'No payouts yet',
            blurb: 'A payout appears here once a customer pays this supplier through Setnayan.',
          }}
          columns={[
            {
              header: 'Payout',
              mono: true,
              cell: (p) => p.public_id ?? '—',
            },
            {
              header: 'Stage',
              hideBelow: 'md',
              cell: (p) => (p.payout_stage ? PAYOUT_STAGE_LABEL[p.payout_stage] : '—'),
            },
            {
              header: 'Amount',
              align: 'right',
              cell: (p) => formatCentavosPhp(p.vendor_net_centavos ?? p.amount_centavos),
            },
            {
              header: 'Status',
              cell: (p) =>
                p.paid_at ? `Paid ${fmtDate(p.paid_at)}` : p.on_hold ? 'On hold' : `Due ${fmtDate(p.scheduled_at)}`,
            },
          ]}
        />
      </section>
    </main>
  );
}
