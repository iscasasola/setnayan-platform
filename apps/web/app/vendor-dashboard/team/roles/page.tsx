import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BackButton } from '@/app/_components/back-button';
import { InfoTip } from '@/app/_components/info-tip';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isStoreShellRequest } from '@/lib/request-platform';
import { fetchTeamManagerContext, fetchVendorRoleNames } from '@/lib/vendor-team';
import { resolveVendorStanding } from '@/lib/vendor-role';
import { fetchVendorBranches } from '@/lib/vendor-branches';
import { shopLocations } from '@/lib/branch-copy';
import { TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';
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
import { RolesForm } from './roles-form';

/**
 * /vendor-dashboard/team/roles — ROLES (six supplier roles, owner 19 Nov 2026; drawing (a) in
 * iscasasola/setnayan-platform#8013). The six fixed roles, one line each, ⓘ for what each can and can't do, and a box
 * for the shop's own name — shown on every card of that role. A blank box keeps the fixed name.
 *
 * Who may open it: whoever runs the team (Shop Manager, or a Branch Manager — read-only for them; renaming is the Shop
 * Manager's, `role_names`). Anyone else sees the 🔒 with the Problem and the Solution — never a blank page. A refused
 * names read THROWS (the route's error page says it couldn't load) — never the fixed names for a shop that renamed them.
 */
export const metadata = { title: 'Roles · Team · Supplier' };

type Search = { saved?: string; error?: string };

export default async function TeamRolesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [ctx, standing] = await Promise.all([
    fetchTeamManagerContext(supabase, user.id),
    resolveVendorStanding(supabase, user.id),
  ]);

  if (!ctx) {
    return (
      <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-3 sm:px-6" data-team-roles="locked">
        <BackButton route="/vendor-dashboard/team/roles" className="mb-0" />
        <h1 className="sn-h1 pt-3">Roles</h1>
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
    '1 Helper free',
  ].join(' · ');

  return (
    <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-3 sm:px-6" data-team-roles="">
      <BackButton route="/vendor-dashboard/team/roles" className="mb-0" />
      <header className="space-y-1 pt-3">
        <h1 className="sn-h1">Roles</h1>
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
