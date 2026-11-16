import Link from 'next/link';

import { PageMasthead } from '@/app/_components/page-masthead';
import {
  TemplateNums,
  TemplateRow,
  TemplateRows,
  TemplateSection,
} from '@/app/_components/template-rows';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBadgeRewardLedger, readRewardNames } from '@/lib/badge-rewards.server';
import { fetchBadgeUpgradeLedger } from '@/lib/badge-upgrades.server';
import { formatCount } from '@/lib/format-number';
import { BadgeRewardsLedger } from '../../gifts/_components/badge-rewards-ledger';
import { BadgeUpgradesLedger } from '../../gifts/_components/badge-upgrades-ledger';
import { SpotlightAwardsSurface } from '../../studio/_surfaces/spotlight-awards-surface';
import { readBadgeRewardFacts } from '@/lib/badge-rewards.server';
import { notYetPaid, rewardsOwed } from '@/lib/badge-rewards';
import { readShopBadgeFacts } from '@/lib/shop-badges.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { badgePage } from '@/app/vendor-dashboard/shop/_components/badges/badge-page-model';
import { NOT_YET_BUILT, type BadgeLedgerView } from './not-yet-built';

/**
 * 🏅 ADMIN › MONEY › OFFERS & GIFTS › BADGES & SEALS — slice 1 (controller 15 Nov 2026; owner OK'd the build that night).
 *
 * ➕ CARRIED FROM #7827 BY THE ADMIN REORG (controller 17 Nov: "Bring its page in as a Money view in the merged
 * layout … wire each shop's tiers and progress through the #7807 adapter instead of 'Not yet built'"). A view of
 * /admin/offers (`?view=badges`, its own sections on `?show=`), so it is not a route of its own; /admin/badges,
 * /admin/spotlight-awards and the Studio's Spotlight tab forward here. The Shops section now reads ONE picked shop's
 * five badges through the adapter (`badgePage`, #7807) and the rewards it has earned and not been given
 * (`rewardsOwed` → `notYetPaid`). Still read-only: no hold, no lock — that slice waits on an owner decision.
 *
 * Contract: `Setnayan-specs/prototypes/admin_badge_ledger_2026-11-15/admin_badge_ledger_2026-11-15_fable.html`
 * (5bac5f14). Rulings: DECISION_LOG dd7d05f1 · 3cbf12c1 · 4b8cc3a3 · 50566f42 · 3077c9b3 · 7fbff0cd · 11d044c0.
 *
 * ─── WHAT THIS SLICE SHOWS, AND WHAT IT HONESTLY DOES NOT ─────────────────
 * One page, three sections (2026 seals · Shops · Rewards), as drawn. What is real on `main` today is drawn from its
 * real reads: every badge reward ever given (`fetchBadgeRewardLedger`, the same read Gifts & comps shows), the badge
 * upgrades, and the monthly Spotlight Awards — which FOLD INTO THIS PAGE (dd7d05f1 (4)); their old addresses
 * (`/admin/spotlight-awards`, the Studio tab) now light this page.
 *
 * Everything that waits on an engine still being built beside this page — the seal list and its 18 Dec lock (J2),
 * each shop's tiers (J0 #7753, read through the one adapter #7807), the card medals (J3), the reward queue and its
 * holds — is a row that SAYS it is not yet built (`./not-yet-built.ts`, one list). Never a sample shop, never a guessed
 * rank, never a ₱0. When a piece lands, its row in that list is replaced by the real read.
 *
 * ⛔ No server action is added: this slice writes nothing. The Spotlight surface keeps its own existing doors.
 */
type Props = {
  search: Record<string, string | string[] | undefined>;
};

const HREF = '/admin/offers?view=badges';

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const VIEWS: ReadonlyArray<{ key: BadgeLedgerView; label: string }> = [
  { key: 'seals', label: '2026 seals' },
  { key: 'shops', label: 'Shops' },
  { key: 'rewards', label: 'Rewards' },
];

export async function BadgesView({ search }: Props) {
  await requireAdmin();
  const viewParam = first(search.show);
  const view: BadgeLedgerView = viewParam === 'shops' || viewParam === 'rewards' ? viewParam : 'seals';

  const admin = createAdminClient();
  const [rewards, rewardNames, upgrades] = await Promise.all([
    fetchBadgeRewardLedger(admin),
    readRewardNames(admin),
    fetchBadgeUpgradeLedger(admin),
  ]);
  const rewardsError = rewards ? null : { message: 'the badge rewards read was refused' };
  const upgradesError = upgrades ? null : { message: 'the badge upgrades read was refused' };

  // "Paid this year": rewards given since 1 January (Manila), not taken back. A refused read is "—", never 0.
  const yearStart = `${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 4)}-01-01`;
  const paidThisYear = rewards ? rewards.filter((r) => r.grantedAt >= yearStart && !r.revokedAt).length : null;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-10 pt-1 sm:px-6" data-admin-badges={view}>
      <PageMasthead title="Badges & seals" />

      <TemplateNums
        items={[
          { label: `Owed now · ${NOT_YET_BUILT.queue.short}`, value: '—', tone: 'warn' },
          paidThisYear === null
            ? { label: 'Paid this year · couldn’t read', value: '—', tone: 'warn' }
            : { label: 'Paid this year', value: formatCount(paidThisYear) },
          { label: `Held · ${NOT_YET_BUILT.holds.short}`, value: '—', tone: 'warn' },
        ]}
      />

      {/* ≤3 sections → one segmented control (T2). */}
      <nav aria-label="Badges and seals" className="sn-seg mt-1" data-badges-view="">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === 'seals' ? HREF : `${HREF}&show=${v.key}`}
            aria-current={view === v.key ? 'page' : undefined}
            className="sn-seg-item"
            prefetch={false}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === 'seals' ? (
        <>
          <TemplateSection
            label="2026 seals"
            first
            tip="Counted launch → 17 Dec (the first year), the list locks 17 Dec, the seals are given 18 Dec. A held Top 10 place goes to the next in line — ten always means ten."
            data="badges-seals"
          >
            <TemplateRows label="2026 seals">
              {NOT_YET_BUILT.seals.map((s) => (
                <TemplateRow key={s.key} title={s.title} line={s.line} right={<NotYetBuilt />} data={`badges-seal-${s.key}`} />
              ))}
              <TemplateRow
                title="Lock the list"
                line={NOT_YET_BUILT.lock.line}
                right={<NotYetBuilt />}
                data="badges-seal-lock"
              />
            </TemplateRows>
          </TemplateSection>

          <TemplateSection
            label="Monthly Spotlight Awards"
            tip="Folded into this page (owner, 15 Nov). Their homepage switch moves to the seal rows once the seals are built; until then it stays here."
            data="badges-spotlight"
          >
            <SpotlightAwardsSurface ok={first(search.ok)} error={first(search.error)} />
          </TemplateSection>
        </>
      ) : view === 'shops' ? (
        <TemplateSection
          label="Shops"
          first
          tip="Each shop's five badges (Completed bookings · Five-star reviews · Gifts given · Trusted by · Invites, Bronze → Black Diamond, for life), its seals and its card medals (last 30 days)."
          data="badges-shops"
        >
          <ShopBadges shopId={first(search.shop)} />
          <TemplateRows label="Not yet built">
            {NOT_YET_BUILT.shops.map((s) => (
              <TemplateRow key={s.key} title={s.title} line={s.line} right={<NotYetBuilt />} data={`badges-shops-${s.key}`} />
            ))}
          </TemplateRows>
        </TemplateSection>
      ) : (
        <>
          <TemplateSection
            label="Owed & held"
            first
            tip="A hold only delays a reward — a tier still pays once, ever. There is no Cancel for a tier reward."
            data="badges-owed"
          >
            <TemplateRows label="Owed and held">
              <TemplateRow title="Rewards owed" line={NOT_YET_BUILT.queue.line} right={<NotYetBuilt />} data="badges-owed-queue" />
              <TemplateRow title="Holds" line={NOT_YET_BUILT.holds.line} right={<NotYetBuilt />} data="badges-owed-holds" />
            </TemplateRows>
          </TemplateSection>
          <TemplateSection
            label="Paid"
            tip="Every reward a badge gave, newest first. Rewards from retired ladders stay where they are: they never pay again and count toward no new tier."
            data="badges-paid"
          >
            <BadgeRewardsLedger rows={rewards} readError={rewardsError} names={rewardNames} />
            <BadgeUpgradesLedger rows={upgrades} readError={upgradesError} />
          </TemplateSection>
        </>
      )}
    </div>
  );
}

/** The one mark for a piece whose engine has not landed — never a sample, never a zero. */
function NotYetBuilt() {
  return (
    <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[12px] font-semibold text-[color:var(--m-slate-2)]">
      Not yet built
    </span>
  );
}

/**
 * One shop's five badges, read through the #7807 adapter (`badgePage`) from the counts the badge engine itself reads
 * (`readBadgeRewardFacts`, #7753) — the same numbers the shop's own badge page shows. Plus what it has earned and not
 * yet been given (`rewardsOwed` → `notYetPaid`). A refused read is a line that says so, never a 0 or "none".
 * Pick a shop: the list is the real shops (demo shops excluded), so no shop is ever a sample from the drawing.
 */
async function ShopBadges({ shopId }: { shopId: string | undefined }) {
  const admin = createAdminClient();
  const { list, error } = await readBadgeShopList(admin);
  const picked = shopId ? list.find((s) => s.vendor_profile_id === shopId) : undefined;

  let cards: ReturnType<typeof badgePage> | null = null;
  let owed: string[] | null = null;
  if (picked) {
    const facts = await readBadgeRewardFacts(admin, picked.vendor_profile_id, readShopBadgeFacts(admin, picked.vendor_profile_id));
    cards = badgePage({
      completed_bookings: facts.completedBookings ?? null,
      five_star_reviews: facts.fiveStarReviews ?? null,
      gifts_given: facts.giftPoints ?? null,
      trusted_by: facts.trustedBy ?? null,
      invites: facts.invites ?? null,
    });
    const given = await admin.from('shop_badge_rewards').select('reward_key').eq('vendor_profile_id', picked.vendor_profile_id);
    if (given.error) logQueryError('BadgesView.given', given.error, {}, 'graceful_degrade');
    else owed = notYetPaid(rewardsOwed(facts), ((given.data ?? []) as Array<{ reward_key: string }>).map((r) => r.reward_key)).map((o) => o.note);
  }

  return (
    <>
      <TemplateRows label="Pick a shop">
        {error ? (
          <TemplateRow title="Shops" line="Couldn’t read the shop list just now — not the same as none." right={<span>—</span>} data="badges-shops-unread" />
        ) : (
          <TemplateRow
            title={picked ? (picked.business_name ?? 'This shop') : 'Pick a shop'}
            line={picked ? 'Its five badges, from the counts its own badge page reads.' : `${formatCount(list.length)} shops · demo shops not counted`}
            right={picked ? <Link href={`${HREF}&show=shops`} className="text-[13px] underline">All shops</Link> : null}
            data="badges-shop-pick"
          />
        )}
        {!picked && !error
          ? list.map((sh) => (
              // A shop trace opens on tap (admin drawing v10).
              <TemplateRow
                key={sh.vendor_profile_id}
                title={sh.business_name ?? 'Unnamed shop'}
                href={badgeTraceHref(sh.vendor_profile_id)}
                line="Its five badges and what it has earned"
                data={`badges-shop-row-${sh.vendor_profile_id}`}
              />
            ))
          : null}
      </TemplateRows>
      {cards ? (
        <TemplateRows label="Five badges">
          {cards.map((c) => (
            <TemplateRow
              key={c.key}
              title={c.name}
              line={c.state === 'earned' ? `${c.line}${c.next ? ` · next: ${c.next}` : ' · the top tier'}` : c.line}
              right={c.state === 'unread' ? <span>—</span> : c.state === 'locked' ? <span className="text-[12px]">Not yet</span> : null}
              data={`badges-shop-${c.key}`}
            />
          ))}
          <TemplateRow
            title="Earned, not yet given"
            line={owed === null ? 'Couldn’t read what was given — not the same as none.' : owed.length === 0 ? 'Every reward it earned has been given.' : owed.join(' · ')}
            right={owed === null ? <span>—</span> : <span className="font-mono tabular-nums">{formatCount(owed.length)}</span>}
            data="badges-shop-owed"
          />
        </TemplateRows>
      ) : null}
    </>
  );
}

/** The shops the badge list shows — real shops only (demo shops excluded). Also the Focus ask's rows. */
export async function readBadgeShopList(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('is_demo', false)
    .order('business_name', { ascending: true })
    .limit(300);
  if (error) logQueryError('BadgesView.shops', error, {}, 'graceful_degrade');
  return { list: (data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>, error };
}

/** Where one shop's trace opens. */
export function badgeTraceHref(vendorProfileId: string): string {
  return `${HREF}&show=shops&shop=${encodeURIComponent(vendorProfileId)}`;
}
