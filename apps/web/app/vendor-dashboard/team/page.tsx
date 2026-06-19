import { redirect } from 'next/navigation';
import { Mail, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  enrichTeamWithUsers,
  fetchAgentServiceAssignments,
  fetchAssignableServices,
  fetchVendorTeam,
  VENDOR_TEAM_ROLE_BLURB,
  VENDOR_TEAM_ROLE_LABEL,
  VENDOR_TEAM_ROLES,
  type AssignableService,
  type VendorTeamRole,
} from '@/lib/vendor-team';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  inviteVendorTeamMember,
  removeVendorTeamMember,
  setVendorAgentServices,
  updateVendorTeamMember,
} from './actions';

export const metadata = { title: 'Team · Vendor' };

type Props = {
  searchParams: Promise<{ saved?: string; invited?: string; error?: string }>;
};

const ROLE_TONE: Record<VendorTeamRole, string> = {
  owner: 'bg-violet-100 text-violet-800',
  admin: 'bg-sky-100 text-sky-800',
  agent: 'bg-success-100 text-success-800',
  viewer: 'bg-ink/10 text-ink/65',
};

export default async function VendorTeamPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Owner-only: team management (incl. the admin-client email enrichment
  // below, which bypasses RLS) must not be reachable by non-owner members.
  // Resolve the OWNED profile directly — not the member-aware
  // fetchOwnVendorProfile — so agents/admins can't load this surface.
  const { data: profile } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) redirect('/vendor-dashboard');

  const rows = await fetchVendorTeam(supabase, profile.vendor_profile_id);
  // Need admin client to resolve member emails (public.users RLS is per-user).
  const admin = createAdminClient();
  const enriched = await enrichTeamWithUsers(admin, rows);
  // Phase 2a — per-service agent assignment data.
  const [services, assignments] = await Promise.all([
    fetchAssignableServices(supabase, profile.vendor_profile_id),
    fetchAgentServiceAssignments(supabase, profile.vendor_profile_id),
  ]);

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Users aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Team</h1>
        <p className="max-w-prose text-base text-ink/65">
          Invite collaborators with one of four role tiers — Owner, Admin, Agent, Viewer.
          The optional team label is what shows in the couple-facing chat when this user
          replies on behalf of the business.
        </p>
      </header>

      {search.error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}
      {search.invited ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          Team member added.
        </p>
      ) : null}
      {search.saved ? (
        <p
          role="status"
          className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800"
        >
          Team updated.
        </p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Invite a team member
        </h2>
        <p className="text-xs text-ink/55">
          V1 invites existing Setnayan accounts only — your colleague signs up first
          (any account type), then you add them here by email.
        </p>
        <form
          action={inviteVendorTeamMember}
          className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
        >
          <label htmlFor="invite-email" className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Email</span>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="colleague@example.com"
              className="input-field"
            />
          </label>
          <label htmlFor="invite-role" className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Role</span>
            <select
              id="invite-role"
              name="role"
              defaultValue="viewer"
              className="input-field cursor-pointer"
            >
              {VENDOR_TEAM_ROLES.filter((r) => r !== 'owner').map((r) => (
                <option key={r} value={r}>
                  {VENDOR_TEAM_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="invite-label" className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Label (optional)</span>
            <input
              id="invite-label"
              name="team_label"
              maxLength={64}
              placeholder="e.g. Videographer"
              className="input-field"
            />
          </label>
          <div className="flex items-end">
            <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Adding…">
              <Mail className="mr-1.5 h-4 w-4" strokeWidth={1.75} aria-hidden />
              Add
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Members ({enriched.length})
        </h2>

        {enriched.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center">
            <Users
              aria-hidden
              className="mx-auto mb-2 h-6 w-6 text-ink/30"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium text-ink">No team members yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {enriched.map((m) => {
              const isSelf = m.user_id === user.id;
              const isOwner = m.role === 'owner';
              const disableEdit = isSelf || isOwner;
              return (
                <li
                  key={m.vendor_team_member_id}
                  className="rounded-2xl border border-ink/10 bg-cream p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-semibold text-ink">
                        {m.display_name?.trim() || m.email || 'Team member'}
                        {isSelf ? (
                          <span className="ml-2 rounded-full bg-ink/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
                            You
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                        {m.email ?? '—'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${ROLE_TONE[m.role]}`}
                        >
                          {VENDOR_TEAM_ROLE_LABEL[m.role]}
                        </span>
                        {m.team_label ? (
                          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/70">
                            {m.team_label}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-ink/55">{VENDOR_TEAM_ROLE_BLURB[m.role]}</p>
                    </div>
                    <form action={removeVendorTeamMember}>
                      <input
                        type="hidden"
                        name="vendor_team_member_id"
                        value={m.vendor_team_member_id}
                      />
                      <button
                        type="submit"
                        aria-label="Remove team member"
                        disabled={disableEdit}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </form>
                  </div>

                  {disableEdit ? null : (
                    <form
                      action={updateVendorTeamMember}
                      className="grid gap-3 sm:grid-cols-[auto_1fr_auto]"
                    >
                      <input
                        type="hidden"
                        name="vendor_team_member_id"
                        value={m.vendor_team_member_id}
                      />
                      <label className="block space-y-1">
                        <span className="block text-xs font-medium text-ink/70">Role</span>
                        <select
                          name="role"
                          defaultValue={m.role}
                          className="input-field cursor-pointer"
                        >
                          {VENDOR_TEAM_ROLES.filter((r) => r !== 'owner').map((r) => (
                            <option key={r} value={r}>
                              {VENDOR_TEAM_ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="block text-xs font-medium text-ink/70">Label</span>
                        <input
                          name="team_label"
                          maxLength={64}
                          defaultValue={m.team_label ?? ''}
                          placeholder="e.g. Videographer"
                          className="input-field"
                        />
                      </label>
                      <div className="flex items-end">
                        <SubmitButton
                          className="inline-flex h-9 items-center justify-center rounded-md border border-ink/20 bg-cream px-4 text-xs font-medium text-ink hover:border-ink/40"
                          pendingLabel="Saving…"
                        >
                          Save
                        </SubmitButton>
                      </div>
                    </form>
                  )}

                  {m.role === 'agent' ? (
                    <AgentServiceAssignment
                      memberId={m.vendor_team_member_id}
                      services={services}
                      assigned={assignments[m.vendor_team_member_id] ?? []}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

function categoryLabel(category: string): string {
  return category
    .split(/[_-]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Phase 2a — per-service assignment for an agent. The owner/admin checks the
 * services this agent should manage; an agent then sees only those services +
 * the customers tied to them (wired in Phase 2b). Replace-on-save semantics.
 */
function AgentServiceAssignment({
  memberId,
  services,
  assigned,
}: {
  memberId: string;
  services: AssignableService[];
  assigned: string[];
}) {
  const assignedSet = new Set(assigned);
  return (
    <form
      action={setVendorAgentServices}
      className="mt-3 space-y-2 rounded-xl border border-success-200/70 bg-success-50/40 p-3"
    >
      <input type="hidden" name="vendor_team_member_id" value={memberId} />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-success-900/70">
        Assigned services — this agent sees only these (and their customers)
      </p>
      {services.length === 0 ? (
        <p className="text-xs text-ink/55">
          Add services on the Services page first, then assign them here.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <label
                key={s.vendor_service_id}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-xs text-ink/80 hover:border-ink/30"
              >
                <input
                  type="checkbox"
                  name="service_ids"
                  value={s.vendor_service_id}
                  defaultChecked={assignedSet.has(s.vendor_service_id)}
                  className="h-3.5 w-3.5 accent-success-600"
                />
                {categoryLabel(s.category)}
                {s.is_active ? null : <span className="text-ink/40">(inactive)</span>}
              </label>
            ))}
          </div>
          <SubmitButton
            className="inline-flex h-8 items-center justify-center rounded-md border border-success-300 bg-cream px-3 text-xs font-medium text-success-900 hover:border-success-500"
            pendingLabel="Saving…"
          >
            Save assignments
          </SubmitButton>
        </>
      )}
    </form>
  );
}
