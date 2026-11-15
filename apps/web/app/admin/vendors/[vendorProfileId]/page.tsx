import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { Layers, Pencil, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { ActionButton } from '@/components/action-button';
import {
  RecordBack,
  RecordFacts,
  RecordFold,
  RecordFolds,
  RecordHead,
  RecordNote,
  RecordSection,
} from '@/app/admin/_components/record-kit';
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
 * 📇 THE SHOP RECORD (owner 14 Nov 2026, "Yes, queue the builds" — the approved 13 Nov drawing
 * `Setnayan-specs/prototypes/admin_pub/people.html`, screen `shop`). The head, the facts, the demo-shop switch, then
 * one fold each: Verification · Plan · Services · Money · Team. Every "Open record" door for a shop (a Work request
 * card, a search row, the Accounts list) lands HERE — `/admin/vendors/<vendor_profile_id or S89V-…>`; `#cards`
 * still lands on the cards (the Services fold opens with the page).
 *
 * Read-only on purpose: every change lives on the page that already owns it
 * (Plan, Team, Verify, Payouts, Edit for an unclaimed shop). This page links
 * there; it does not grow a second copy of any of those forms. (The drawing folds
 * Plan and Team INTO this page; /plan and /team are being edited by open PRs, so
 * their forms move here — and their addresses redirect — once those land.)
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
  // 🕗 F-A-09 (admin walk 13 Nov 2026): Manila time, never the server's UTC day.
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
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

  const runBy: ReactNode =
    ownerId && !ownerRead?.error ? (
      <Link href={`/admin/users/${ownerId}`} className="font-semibold text-mulberry underline-offset-2 hover:underline">
        {ownerLabel} ›
      </Link>
    ) : (
      ownerLabel
    );
  const planSummary = `${TIER_LABEL[tier]} · ${
    shop.tier_expires_at ? `until ${fmtDate(shop.tier_expires_at as string)}` : 'no end date'
  }`;
  const liveCards = (cards ?? []).filter((c) => c.status === 'live').length;
  const downCards = (cards ?? []).filter((c) => c.status === 'taken_down').length;
  const servicesSummary =
    cards === null
      ? COULD_NOT_LOAD
      : `${formatCount(cards.length)} cards · ${formatCount(liveCards)} live${downCards > 0 ? ` · ${formatCount(downCards)} taken down` : ''}`;
  const payoutSummary =
    payouts === null ? COULD_NOT_LOAD : payouts.length === 0 ? 'no payouts' : `${formatCount(payouts.length)} newest payouts`;

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <RecordBack href="/admin/accounts?tab=vendors" label="All suppliers" />
      {/* The record's name IS the content here, so the masthead carries it. */}
      <PageMasthead titleNode={name} />
      <RecordHead
        small={`Shop${ownerId ? '' : ' · unclaimed'} · ${shop.public_id as string}${slug ? ` · /v/${slug}` : ''}`}
        name={name}
        badges={
          <>
            <Badge tone={verification === 'verified' ? 'ok' : 'quiet'}>{VERIFICATION_STATE_LABEL[verification]}</Badge>
            <Badge tone={shopIsLive ? 'ok' : 'quiet'}>{shopIsLive ? 'Shows in search' : 'Not in search'}</Badge>
          </>
        }
      />

      <RecordFacts
        label="Shop"
        items={[
          ['Run by', runBy],
          ['City', (shop.location_city as string | null) || '—'],
          // One definition of live (lib/vendor-visibility.ts): `is_published` is a dead column nothing in the
          // approval flow sets.
          ['Shows in search', shopIsLive ? 'Yes' : 'No'],
          ['Joined', fmtDate(shop.created_at as string | null)],
        ]}
      />
      {!ownerId ? (
        <div className="mt-2">
          <ActionButton tone="brand" icon={<Pencil aria-hidden strokeWidth={1.9} />} label="Edit this unclaimed shop" href={`/admin/vendors/${shopId}/edit`} />
        </div>
      ) : null}
      {/* 🧪 Sample shop (owner, 6 Nov 2026) — one switch, saves in place; writes `is_demo`. */}
      <div className="mt-3">
        <SampleShopSwitch shopId={shopId} initial={shop.is_demo === true} />
      </div>

      <RecordFolds>
        <RecordFold title="Verification" anchor="verification" summary={`${VERIFICATION_STATE_LABEL[verification]} · ${applicationCell}`}>
          <RecordFacts
            items={[
              ['State', VERIFICATION_STATE_LABEL[verification]],
              ['Latest application', applicationCell],
            ]}
          />
          <div className="mt-3">
            <ActionButton tone="brand" icon={<ShieldCheck aria-hidden strokeWidth={1.9} />} label="Verification queue" href="/admin/verify" />
          </div>
        </RecordFold>

        <RecordFold title="Plan" anchor="plan" summary={planSummary}>
          <RecordFacts
            items={[
              ['Tier', TIER_LABEL[tier]],
              ['Subscription ends', shop.tier_expires_at ? fmtDate(shop.tier_expires_at as string) : 'No end date'],
            ]}
          />
          <RecordNote>Tier, end date, founding supplier and SKU comps are set on the plan page.</RecordNote>
          <div className="mt-3">
            <ActionButton tone="brand" icon={<Layers aria-hidden strokeWidth={1.9} />} label="Change plan" href={`/admin/vendors/${shopId}/plan`} />
          </div>
        </RecordFold>

        <RecordFold title="Services" anchor="services" defaultOpen summary={servicesSummary}>
          {cardResult ? (
            <p role="status" className="mb-2 rounded-lg bg-success-100 p-3 text-sm text-success-900">
              {cardResult}
            </p>
          ) : null}
          {cardError ? (
            <p role="alert" className="mb-2 rounded-lg bg-danger-100 p-3 text-sm text-danger-900">
              {cardError}
            </p>
          ) : null}
          <ServiceCardsSection shopId={shopId} cards={cards} cap={CARD_CAP} />
        </RecordFold>

        <RecordFold title="Money" anchor="money" summary={payoutSummary}>
          <RecordSection
            label="Payouts"
            right={
              <Link
                href={`/admin/payouts?filter=all&vendor=${shopId}`}
                className="font-semibold text-mulberry underline-offset-2 hover:underline"
              >
                All their payouts ›
              </Link>
            }
          >
            <ConsoleTable
              rows={payouts}
              readPermitted
              readError={payoutRead.error}
              reads="this supplier's payouts"
              cap={PAYOUT_CAP}
              label="Newest payouts to this supplier"
              minWidth="18rem"
              rowKey={(p) => p.payout_id}
              empty={{
                Icon: Wallet,
                title: 'No payouts yet',
                // F-A-09: apply-then-pay — couples pay suppliers directly; only a legacy booking ever paid through Setnayan.
                blurb: 'Couples pay suppliers directly, so nothing is paid out here. Only an older booking paid through Setnayan would show.',
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
          </RecordSection>
        </RecordFold>

        <RecordFold title="Team" anchor="team" summary={teamCell}>
          <RecordFacts items={[['People on the team', teamCell]]} />
          <RecordNote>Read-only — admin governance stays with the store&rsquo;s own admins.</RecordNote>
          <div className="mt-3">
            <ActionButton tone="neutral" icon={<Users aria-hidden strokeWidth={1.9} />} label="See team" href={`/admin/vendors/${shopId}/team`} />
          </div>
        </RecordFold>
      </RecordFolds>
    </main>
  );
}
