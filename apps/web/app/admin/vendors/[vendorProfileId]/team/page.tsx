import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Coins, Gavel, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  enrichTeamWithUsers,
  fetchOpenAdminMotions,
  fetchVendorTeam,
  isVendorAdminRole,
  VENDOR_TEAM_ROLE_LABEL,
} from '@/lib/vendor-team';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = {
  title: 'Vendor team · Admin',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ vendorProfileId: string }>;
};

/**
 * /admin/vendors/[id]/team — read-only view of a store's members, roles, and
 * any open admin-governance votes (multi-admin org model, 2026-07-01). Lets
 * Setnayan staff answer "who runs this store / who are the admins" and audit a
 * pending demotion vote, without mutating the team (governance stays in the
 * vendor's own hands per the org model). Mirrors the admin gate used by the
 * sibling tokens page.
 */
export default async function AdminVendorTeamPage({ params }: Props) {
  await requireAdmin();
  const { vendorProfileId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, public_id, user_id, business_name, location_city')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!vendor) notFound();

  const rows = await fetchVendorTeam(admin, vendorProfileId);
  const members = await enrichTeamWithUsers(admin, rows);
  const { motions } = await fetchOpenAdminMotions(admin, vendorProfileId);
  const nameOf = (uid: string) =>
    members.find((m) => m.user_id === uid)?.display_name?.trim() ||
    members.find((m) => m.user_id === uid)?.email ||
    'Admin';
  const adminCount = members.filter((m) => isVendorAdminRole(m.role)).length;
  const founderId = (vendor as { user_id: string | null }).user_id;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <Link href="/admin/vendors" className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> All vendors
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
            <Users aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {(vendor as { business_name: string | null }).business_name ?? 'Vendor'} · Team
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              {(vendor as { public_id: string }).public_id} ·{' '}
              {adminCount} admin{adminCount === 1 ? '' : 's'} · {members.length} member
              {members.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Link
          href={`/admin/vendors/${vendorProfileId}/tokens`}
          className="inline-flex items-center gap-1.5 text-sm text-sky-700 hover:text-sky-900"
        >
          <Coins className="h-4 w-4" strokeWidth={1.75} /> Tokens &amp; tier
        </Link>
      </header>

      {motions.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-900/70">
            <Gavel className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Open admin votes ({motions.length})
          </h2>
          <ul className="space-y-1 text-sm text-ink/80">
            {motions.map((mo) => (
              <li key={mo.motion_id}>
                {mo.kind === 'remove' ? 'Remove' : `Demote to ${mo.new_role}`} ·{' '}
                <strong>{nameOf(mo.target_user_id)}</strong> — proposed by {nameOf(mo.proposed_by)}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink/55">
            Read-only — admin governance stays with the store’s own admins.
          </p>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Members</h2>
        <ul className="divide-y divide-ink/10 overflow-hidden sn-tile">
          {members.map((m) => (
            <li key={m.vendor_team_member_id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {m.display_name?.trim() || m.email || 'Team member'}
                  {m.user_id === founderId ? (
                    <span className="ml-2 rounded-full bg-ink/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/65">
                      Founder
                    </span>
                  ) : null}
                </p>
                <p className="truncate font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                  {m.email ?? '—'}
                  {m.team_label ? ` · ${m.team_label}` : ''}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                  isVendorAdminRole(m.role) ? 'bg-sky-100 text-sky-800' : 'bg-ink/10 text-ink/65'
                }`}
              >
                {VENDOR_TEAM_ROLE_LABEL[m.role]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
