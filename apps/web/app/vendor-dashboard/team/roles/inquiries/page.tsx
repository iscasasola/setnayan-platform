import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRightLeft, RotateCcw } from 'lucide-react';
import { BackButton } from '@/app/_components/back-button';
import { InfoTip } from '@/app/_components/info-tip';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { enrichTeamWithUsers, readTeamManagerContext, fetchVendorRoleNames, fetchVendorTeam } from '@/lib/vendor-team';
import { TeamUnread } from '../../_components/team-unread';
import { resolveVendorStanding } from '@/lib/vendor-role';
import { roleNameOf } from '@/lib/vendor-duties';
import { eventTypeLabel } from '@/lib/demand-radar';
import { blockWords, cutChoices, fairSplit, shareWords, MAX_ACCOUNT_MANAGERS_PER_CARD, type SplitBlock } from '@/lib/inquiry-split';
import { splitCountsFor } from '@/lib/inquiry-routing.server';
import { initialsOf } from '@/lib/team-initials';
import { ShopNotice } from '../../../_components/kit';
import { RoleLock } from '../../../_components/role-lock';
import { SupplierSubmit } from '../../../_components/supplier-submit';
import { StayForm } from '@/app/_components/stay-form';
import { setVendorRoleNames } from '../../actions';

/**
 * /vendor-dashboard/team/roles/inquiries — WHO GETS NEW INQUIRIES (supplier roles d–h, the #8013 drawing (e)).
 *
 * Each new inquiry goes to ONE Account Manager: by branch, then the card it came in on (only the people who cover it),
 * then event type, then last name — the same rule `lib/inquiry-routing.ts` routes by, cut from the same counts
 * (`splitCountsFor`). A card nobody covers goes to the Branch Manager, else the Shop Manager (controller row 2).
 * A Shop or Branch Manager adjusts a cut between two people; an adjusted split stays until reset — and when someone
 * joins or leaves it no longer fits, so the fair split runs and the screen says "Reset to fair split?".
 * Who may open it: whoever runs the team; anyone else sees the 🔒, never a blank page.
 */
export const metadata = { title: 'Who gets new inquiries · Roles · Supplier' };

type Search = { branch?: string; adjust?: string; type?: string; saved?: string; error?: string };
type Row = { key: string; initials: string; who: string; block: string; share: string | null };

const ROUTE = '/vendor-dashboard/team/roles/inquiries';

export default async function WhoGetsInquiriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const [ctx, standing] = await Promise.all([readTeamManagerContext(supabase, user.id), resolveVendorStanding(supabase, user.id)]);
  if (ctx === 'unread') {
    return (
      <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-3 sm:px-6" data-team-inquiries="unread">
        <BackButton route={ROUTE} className="mb-0" />
        <h1 className="sn-h1 pt-3">Who gets new inquiries</h1>
        <div className="mt-4">
          <TeamUnread retryHref={ROUTE} />
        </div>
      </section>
    );
  }
  if (!ctx) {
    return (
      <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-3 sm:px-6" data-team-inquiries="locked">
        <BackButton route={ROUTE} className="mb-0" />
        <h1 className="sn-h1 pt-3">Who gets new inquiries</h1>
        <RoleLock duty={standing?.duty ?? null} capability="team" className="mt-4" />
      </section>
    );
  }

  const admin = createAdminClient();
  const shopId = ctx.vendorProfileId;
  const [names, team, branchesRead, cardsRead, cutsRead, settingRead] = await Promise.all([
    fetchVendorRoleNames(supabase, shopId),
    fetchVendorTeam(admin, shopId),
    admin.from('vendor_branches').select('branch_id, branch_label').eq('parent_vendor_profile_id', shopId).is('cancelled_at', null),
    admin.from('vendor_services').select('vendor_service_id, title, branch_id, is_active').eq('vendor_profile_id', shopId).order('created_at', { ascending: true }),
    admin.from('vendor_inquiry_split_cuts').select('vendor_service_id, branch_id, event_type, vendor_team_member_id, from_prefix, to_prefix').eq('vendor_profile_id', shopId),
    admin.from('platform_settings').select('inquiry_split_own_enough').eq('id', 1).maybeSingle(),
  ]);
  // The cover is read for THIS shop's cards only.
  const shopCardIds = ((cardsRead.data ?? []) as { vendor_service_id: string }[]).map((c) => c.vendor_service_id);
  const coverRead = shopCardIds.length
    ? await admin.from('vendor_service_agents').select('vendor_team_member_id, vendor_service_id').in('vendor_service_id', shopCardIds)
    : { data: [], error: null };
  const readFailed = branchesRead.error || cardsRead.error || coverRead.error || cutsRead.error;
  const people = await enrichTeamWithUsers(admin, team);
  const nameOf = (id: string) => people.find((p) => p.vendor_team_member_id === id)?.display_name?.trim() || 'Team member';

  const branches = ((branchesRead.data ?? []) as { branch_id: string; branch_label: string | null }[]).map((b) => ({ key: b.branch_id, label: b.branch_label?.trim() || 'Branch' }));
  const locations = [{ key: 'main', label: 'Main' }, ...branches];
  // A Branch Manager sees their own branch only.
  const ownKey = ctx.duty === 'branch_manager' ? (ctx.branchId ?? 'main') : null;
  const shown = ownKey ? locations.filter((l) => l.key === ownKey) : locations;
  const branchKey = shown.some((l) => l.key === search.branch) ? search.branch! : (shown[0]?.key ?? 'main');
  const branchId = branchKey === 'main' ? null : branchKey;

  const active = team.filter((m) => !m.deactivated_at);
  const onBranch = (m: { branch_id: string | null }) => (m.branch_id ?? null) === branchId;
  const ams = active.filter((m) => m.duty === 'account_manager' && onBranch(m)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const branchManager = active.filter((m) => m.duty === 'branch_manager' && onBranch(m)).sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null;
  const shopManager = active.filter((m) => m.duty === 'shop_manager').sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null;
  const cover = (coverRead.data ?? []) as { vendor_team_member_id: string; vendor_service_id: string }[];
  const cuts = (cutsRead.data ?? []) as { vendor_service_id: string; branch_id: string | null; event_type: string | null; vendor_team_member_id: string; from_prefix: string; to_prefix: string | null }[];
  const ownEnough = (settingRead.data as { inquiry_split_own_enough: number | null } | null)?.inquiry_split_own_enough ?? null;
  const cards = ((cardsRead.data ?? []) as { vendor_service_id: string; title: string | null; branch_id: string | null; is_active: boolean }[]).filter(
    (c) => c.is_active && (c.branch_id ?? null) === branchId,
  );
  const personRow = (id: string, block: Pick<SplitBlock, 'from' | 'to'>, share: number | null, counts?: ReadonlyMap<string, number>): Row => {
    const m = team.find((t) => t.vendor_team_member_id === id);
    return {
      key: id,
      initials: initialsOf(nameOf(id)),
      who: m ? `${roleNameOf(names, m.duty)} · ${nameOf(id)}` : nameOf(id),
      block: blockWords(block, counts),
      share: share === null ? null : shareWords(share),
    };
  };

  const sections = await Promise.all(
    cards.map(async (card) => {
      const on = ams.filter((m) => cover.some((c) => c.vendor_service_id === card.vendor_service_id && c.vendor_team_member_id === m.vendor_team_member_id)).slice(0, MAX_ACCOUNT_MANAGERS_PER_CARD);
      const title = card.title?.trim() || 'A card';
      if (on.length === 0) {
        const fallback = branchManager ?? shopManager;
        return { card, title, coveredBy: 'No Account Manager covers this card', groups: [{ type: null as string | null, label: 'Every event', note: null as string | null, rows: fallback ? [personRow(fallback.vendor_team_member_id, { from: 'AA', to: null }, null)] : [], adjustable: false, fair: null as SplitBlock[] | null, counts: new Map<string, number>() }] };
      }
      const cardCuts = cuts.filter((c) => c.vendor_service_id === card.vendor_service_id && (c.branch_id ?? null) === branchId);
      const types = [null, ...new Set(cardCuts.map((c) => c.event_type).filter((t): t is string => !!t))];
      const groups = await Promise.all(
        types.map(async (type) => {
          const { counts, source, measured } = await splitCountsFor(admin, card.vendor_service_id, type, ownEnough);
          const fair = fairSplit(counts, on.length);
          const mine = cardCuts.filter((c) => c.event_type === type);
          const fits = mine.length === on.length && mine.every((c) => on.some((m) => m.vendor_team_member_id === c.vendor_team_member_id));
          const from = source === 'own' ? 'from your past clients' : 'from all Setnayan inquiries';
          const rows = fits
            ? [...mine].sort((a, b) => a.from_prefix.localeCompare(b.from_prefix)).map((c) => personRow(c.vendor_team_member_id, { from: c.from_prefix, to: c.to_prefix }, null, counts))
            : fair.map((b, i) => personRow(on[i]!.vendor_team_member_id, b, on.length > 1 ? b.share : null, counts));
          return {
            type,
            label: `${type ? eventTypeLabel(type) : types.length > 1 ? 'Every other event' : 'Every event'} · ${fits ? 'adjusted' : on.length > 1 ? `fair split, ${from}` : 'one Account Manager'}`,
            // A refused count read is said, never drawn as an even split of nothing (ship review 22 Nov).
            note: !measured
              ? 'We couldn’t load the inquiry counts just now, so this split is not measured. Try again in a moment.'
              : mine.length > 0 && !fits
                ? 'Someone joined or left, so the fair split runs again. Reset to fair split?'
                : null,
            rows,
            adjustable: on.length === 2,
            fair,
            counts,
          };
        }),
      );
      return { card, title, coveredBy: `Covered by ${on.map((m) => nameOf(m.vendor_team_member_id).split(/\s+/)[0]).join(', ')}`, groups };
    }),
  );

  const adjusting = search.adjust ? sections.find((s) => s.card.vendor_service_id === search.adjust) ?? null : null;
  const adjustGroup = adjusting?.groups.find((g) => (g.type ?? '') === (search.type ?? '')) ?? null;
  const here = `${ROUTE}?branch=${encodeURIComponent(branchKey)}`;

  return (
    <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-3 sm:px-6" data-team-inquiries="">
      <BackButton route={ROUTE} className="mb-0" />
      <header className="space-y-1 pt-3">
        <h1 className="sn-h1">Who gets new inquiries</h1>
        <p className="text-[14px] text-ink/65">Each new inquiry goes to ONE Account Manager: by branch, card, event type, then last name.</p>
        <InfoTip label="How the branch and changes work" align="start">
          The branch is the one the service card is filed under. A Shop Manager or Branch Manager can change any split; a split
          you change stays until you reset it.
        </InfoTip>
      </header>

      <div className="mt-3 space-y-2">
        {search.error ? <ShopNotice tone="gold" role="alert">{search.error}</ShopNotice> : null}
        {search.saved ? <ShopNotice tone="success" role="status">Saved. New inquiries follow it from now on; clients already given out stay put.</ShopNotice> : null}
        {readFailed ? <ShopNotice tone="gold" role="alert">Part of this couldn’t load just now. Refresh to try again.</ShopNotice> : null}
      </div>

      {shown.length > 1 ? (
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Branch" data-team-inquiries-branch="">
          {shown.map((l) => {
            const n = active.filter((m) => m.duty === 'account_manager' && (m.branch_id ?? 'main') === l.key).length;
            return (
              <Link
                key={l.key}
                href={`${ROUTE}?branch=${encodeURIComponent(l.key)}`}
                aria-current={l.key === branchKey ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[13.5px] ${l.key === branchKey ? 'border-terracotta bg-terracotta/10 font-semibold text-terracotta' : 'border-ink/15 text-ink/75'}`}
              >
                {l.label} · {n}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="mt-4 space-y-4">
        {sections.length === 0 ? <p className="text-[14px] text-ink/65">No live cards on this branch yet.</p> : null}
        {sections.map((s) => (
          <article key={s.card.vendor_service_id} className="border-t border-ink/10 pt-4" data-team-inquiries-card={s.card.vendor_service_id}>
            <h2 className="text-[15px] font-semibold text-ink">{s.title} card</h2>
            <p className="text-[13px] text-[color:var(--m-slate-2)]">{s.coveredBy}</p>
            {s.groups.map((g) => (
              <div key={g.type ?? 'all'} className="mt-3 border-t border-ink/10 pt-3" data-team-inquiries-group={g.type ?? 'all'}>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/60">{g.label}</p>
                {g.note ? <p className="mt-1 text-[13px] text-[color:var(--m-slate-2)]">{g.note}</p> : null}
                <ul className="mt-2 space-y-2">
                  {g.rows.map((r) => (
                    <li key={r.key} className="flex min-h-11 items-center gap-3">
                      <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-full bg-terracotta/10 text-[13px] font-bold text-terracotta">
                        {r.initials}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{r.who}</span>
                      <span className="text-[14px] font-semibold text-ink">
                        {r.block}
                        {r.share ? ` · ${r.share}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                {g.adjustable ? (
                  <div className="mt-2 flex justify-end">
                    <Link
                      href={`${here}&adjust=${s.card.vendor_service_id}&type=${encodeURIComponent(g.type ?? '')}#adjust`}
                      className="inline-flex min-h-11 items-center font-semibold text-terracotta underline-offset-2 hover:underline"
                    >
                      Adjust
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </article>
        ))}
      </div>

      {adjusting && adjustGroup && adjustGroup.adjustable && adjustGroup.fair ? (
        <AdjustPanel
          serviceId={adjusting.card.vendor_service_id}
          type={adjustGroup.type}
          title={`Adjust · ${adjustGroup.type ? eventTypeLabel(adjustGroup.type) : 'Every event'}`}
          firstNames={adjustGroup.rows.map((r) => r.who.split(' · ').pop()!.split(/\s+/)[0]!)}
          choices={cutChoices(adjustGroup.counts, adjustGroup.fair[1]!.from)}
          counts={adjustGroup.counts}
          returnTo={here}
        />
      ) : null}
    </section>
  );
}

function AdjustPanel({
  serviceId,
  type,
  title,
  firstNames,
  choices,
  counts,
  returnTo,
}: {
  serviceId: string;
  type: string | null;
  title: string;
  firstNames: string[];
  choices: Array<{ cut: string; shares: [number, number] }>;
  counts: ReadonlyMap<string, number>;
  returnTo: string;
}) {
  const hidden = (
    <>
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="event_type" value={type ?? ''} />
      <input type="hidden" name="return_to" value={returnTo} />
    </>
  );
  return (
    <section id="adjust" className="mt-6 border-t border-ink/10 pt-4" data-team-inquiries-adjust="">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <p className="text-[13.5px] text-ink/70">
        Cut between {firstNames[0]} and {firstNames[1]} at:
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((c) => (
          <StayForm key={c.cut} door="supTeam.setVendorRoleNames" action={setVendorRoleNames}>
            {hidden}
            <input type="hidden" name="op" value="split-adjust" />
            <input type="hidden" name="cut" value={c.cut} />
            <SupplierSubmit
              tone="neutral"
              icon={<ArrowRightLeft aria-hidden strokeWidth={1.9} />}
              label={`${blockWords({ from: c.cut, to: null }, counts).replace(/ – Z$/, '')} · ${shareWords(c.shares[0])} / ${shareWords(c.shares[1])}`}
              pendingLabel="Saving…"
            />
          </StayForm>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--m-slate-2)]">
        Each choice shows the share of past clients each person would get.
      </p>
      <StayForm door="supTeam.setVendorRoleNames" action={setVendorRoleNames} className="mt-3 flex justify-end">
        {hidden}
        <input type="hidden" name="op" value="split-reset" />
        <SupplierSubmit tone="neutral" icon={<RotateCcw aria-hidden strokeWidth={1.9} />} label="Reset to fair split" pendingLabel="Resetting…" />
      </StayForm>
    </section>
  );
}
