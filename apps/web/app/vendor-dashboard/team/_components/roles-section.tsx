import Link from 'next/link';
import { redirect } from 'next/navigation';
import { InfoTip } from '@/app/_components/info-tip';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isStoreShellRequest } from '@/lib/request-platform';
import { readTeamManagerContext, fetchVendorRoleNames } from '@/lib/vendor-team';
import { TeamUnread } from './team-unread';
import { TeamSectionHead } from './team-section-head';
import { TEAM_HREF, TEAM_INQUIRIES_HREF, TEAM_ROLES_HREF } from '@/lib/team-sections';
import { resolveVendorStanding } from '@/lib/vendor-role';
import { fetchVendorBranches } from '@/lib/vendor-branches';
import { shopLocations } from '@/lib/branch-copy';
import { TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';
import { FREE_HELPER_SEATS } from '@/lib/vendor-free-helper';
import { formatCount } from '@/lib/format-number';
import {
  VENDOR_DUTIES,
  VENDOR_DUTY_DETAIL,
  VENDOR_DUTY_LINE,
  VENDOR_DUTY_NAME,
  dutyMay,
  type VendorRoleNames,
} from '@/lib/vendor-duties';
import { ShopNotice } from '../../_components/kit';
import { RoleLock } from '../../_components/role-lock';
import { setVendorRoleNames } from '../actions';
import { RolesForm } from '../roles/roles-form';
import { DatesRow } from '../../customers/_components/dates-row';

/**
 * /vendor-dashboard/team/roles — ROLES (six supplier roles, owner 19 Nov 2026; drawing (a) in
 * iscasasola/setnayan-platform#8013). The six fixed roles, one line each, ⓘ for what each can and can't do, and a box
 * for the shop's own name — shown on every card of that role. A blank box keeps the fixed name.
 *
 * Who may open it: whoever runs the team (Shop Manager, or a Branch Manager — read-only for them; renaming is the Shop
 * Manager's, `role_names`). Anyone else sees the 🔒 with the Problem and the Solution — never a blank page. A refused
 * names read THROWS (the route's error page says it couldn't load) — never the fixed names for a shop that renamed them.
 */

export type RolesSearch = { saved?: string; error?: string };

/** Roles, drawn IN PLACE inside the Team layer (final check B13) — the shipped Roles page's body, unchanged but for its
 *  way back (the layer's ‹) and its title (the layer's head). `/vendor-dashboard/team/roles` forwards here. */
export async function RolesSection({ search }: { search: RolesSearch }) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [ctx, standing] = await Promise.all([
    readTeamManagerContext(supabase, user.id),
    resolveVendorStanding(supabase, user.id),
  ]);

  if (ctx === 'unread') {
    return (
      <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-3 sm:px-6" data-team-roles="unread">
        <TeamSectionHead title="Roles" backTo={TEAM_HREF} />
        <div className="mt-4">
          <TeamUnread retryHref={TEAM_ROLES_HREF} />
        </div>
      </section>
    );
  }
  if (!ctx) {
    return (
      <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-3 sm:px-6" data-team-roles="locked">
        <TeamSectionHead title="Roles" backTo={TEAM_HREF} />
        <RoleLock duty={standing?.duty ?? null} capability="team" className="mt-4" />
      </section>
    );
  }

  const admin = createAdminClient();
  const [names, branches, shop, storeShell] = await Promise.all([
    fetchVendorRoleNames(supabase, ctx.vendorProfileId),
    fetchVendorBranches(supabase, ctx.vendorProfileId, admin).catch(() => null),
    supabase.from('vendor_profiles').select('location_city').eq('vendor_profile_id', ctx.vendorProfileId).maybeSingle(),
    isStoreShellRequest(),
  ]);
  const canRename = dutyMay(ctx.duty, 'role_names');
  const city = (shop.data as { location_city: string | null } | null)?.location_city ?? null;
  const locations = branches
    ? shopLocations(
        branches.map((b) => ({ id: b.branch_id, label: b.branch_label, status: b.status })),
        city,
      )
    : null;
  const planLine = [
    TIER_LABEL[asVendorTier(ctx.tierState ?? 'free')],
    locations ? locations.map((l) => l.label).join(' + ') : 'We couldn’t read your branches just now',
    // From the one constant, never typed (final check A5-G5-10); no clause when the free Helper is off.
    FREE_HELPER_SEATS > 0 ? `${formatCount(FREE_HELPER_SEATS)} Helper free` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-3 sm:px-6" data-team-roles="">
      <TeamSectionHead title="Roles" backTo={TEAM_HREF} />
      <header className="space-y-1 pt-3">
        <p className="text-[14px] text-ink/65">
          What each role can do. Give it your shop’s own name — it shows on every card of that role.
        </p>
      </header>

      <div className="mt-3 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-[color:var(--m-slate-2)]" data-team-roles-plan="">
        <span>{planLine}</span>
        {canRename && !storeShell ? (
          <Link href="/vendor-dashboard/subscription" className="font-semibold text-terracotta underline-offset-2 hover:underline">
            Change plan
          </Link>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {search.error ? (
          <ShopNotice tone="gold" role="alert">
            {search.error}
          </ShopNotice>
        ) : null}
        {search.saved ? (
          <ShopNotice tone="success" role="status">
            Saved. Every card of a renamed role shows its new name.
          </ShopNotice>
        ) : null}
      </div>

      {/* 👤 d–h (e): the inquiry split lives one tap under Roles (drawing: "‹ Roles · Who gets new inquiries"). */}
      <DatesRow
        data="team-roles-inquiries"
        title="Who gets new inquiries"
        line="Each new client goes to one Account Manager — by branch, card, event type and last name"
        href={TEAM_INQUIRIES_HREF}
      />

      {canRename ? <RolesForm names={names} action={setVendorRoleNames} /> : <RolesList names={names} />}

      {!canRename ? <RoleLock duty={ctx.duty} names={names} capability="role_names" className="mt-4" /> : null}
    </section>
  );
}

/** Read-only for a Branch Manager: the fixed role, the shop's name for it, what it does — no boxes to type into. */
function RolesList({ names }: { names: VendorRoleNames }) {
  return (
    <div className="mt-4" data-team-roles-list="">
      {VENDOR_DUTIES.map((duty) => (
        <div key={duty} className="border-t border-ink/10 py-3 first:border-t-0" data-team-role={duty}>
          <div className="flex flex-wrap items-center gap-2">
            <InfoTip label={VENDOR_DUTY_NAME[duty]} labelClassName="text-[15px] font-semibold text-ink" align="start">
              {VENDOR_DUTY_DETAIL[duty]}
            </InfoTip>
            {names[duty] ? <span className="text-[14px] font-semibold text-terracotta">{names[duty]}</span> : null}
          </div>
          <p className="mt-0.5 text-[13.5px] text-[color:var(--m-slate-2)]">{VENDOR_DUTY_LINE[duty]}</p>
        </div>
      ))}
    </div>
  );
}
