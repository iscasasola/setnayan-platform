import { redirect } from 'next/navigation';
import { Gavel, LogOut, Mail, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  enrichTeamWithUsers,
  fetchAdminVendorContext,
  fetchAgentServiceAssignments,
  fetchAssignableServices,
  fetchOpenAdminMotions,
  fetchVendorTeam,
  isVendorAdminRole,
  VENDOR_ASSIGNABLE_ROLES,
  VENDOR_TEAM_ROLE_BLURB,
  VENDOR_TEAM_ROLE_LABEL,
  type AssignableService,
  type VendorAdminMotion,
  type VendorAdminMotionVote,
  type VendorTeamMemberWithUser,
  type VendorTeamRole,
} from '@/lib/vendor-team';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  cancelAdminMotion,
  inviteVendorTeamMember,
  proposeAdminMotion,
  removeVendorTeamMember,
  setVendorAgentServices,
  stepDownSelf,
  updateVendorTeamMember,
  voteAdminMotion,
} from './actions';

export const metadata = { title: 'Team · Vendor' };

type Props = {
  searchParams: Promise<{
    saved?: string;
    invited?: string;
    error?: string;
    motion?: string;
    voted?: string;
  }>;
};

const ROLE_TONE: Record<VendorTeamRole, string> = {
  owner: 'bg-sky-100 text-sky-800',
  admin: 'bg-sky-100 text-sky-800',
  agent: 'bg-success-100 text-success-800',
  viewer: 'bg-ink/10 text-ink/65',
};

function nameOf(members: VendorTeamMemberWithUser[], userId: string): string {
  const m = members.find((x) => x.user_id === userId);
  return m?.display_name?.trim() || m?.email || 'Admin';
}

function motionLabel(m: VendorAdminMotion): string {
  if (m.kind === 'remove') return 'Remove from store';
  return `Demote to ${m.new_role === 'viewer' ? 'Viewer' : 'Agent'}`;
}

export default async function VendorTeamPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ADMIN-gated: any admin of the store may manage the team (multi-admin org
  // model, 2026-07-01). Non-admin members are bounced. The admin-client email
  // enrichment below bypasses RLS, so confirming admin first is load-bearing.
  const ctx = await fetchAdminVendorContext(supabase, user.id);
  if (!ctx) redirect('/vendor-dashboard');
  const vendorProfileId = ctx.vendorProfileId;

  const rows = await fetchVendorTeam(supabase, vendorProfileId);
  const admin = createAdminClient();
  const enriched = await enrichTeamWithUsers(admin, rows);
  const [services, assignments, motionData] = await Promise.all([
    fetchAssignableServices(supabase, vendorProfileId),
    fetchAgentServiceAssignments(supabase, vendorProfileId),
    fetchOpenAdminMotions(supabase, vendorProfileId),
  ]);

  const adminCount = enriched.filter((m) => isVendorAdminRole(m.role)).length;
  const { motions, votes } = motionData;
  const votesByMotion = new Map<string, VendorAdminMotionVote[]>();
  for (const v of votes) {
    const list = votesByMotion.get(v.motion_id) ?? [];
    list.push(v);
    votesByMotion.set(v.motion_id, list);
  }

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
          Your store is run by one or more <strong>Admins</strong>. Any admin can manage the team;
          changing or removing another admin needs a majority vote of the other admins. Agents are
          scoped to assigned services; Viewers are read-only. The optional label is what shows in the
          couple-facing chat when this person replies for the business.
        </p>
      </header>

      {search.error ? (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700">
          {decodeURIComponent(search.error)}
        </p>
      ) : null}
      {search.invited ? (
        <p role="status" className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800">
          Team member added.
        </p>
      ) : null}
      {search.motion ? (
        <p role="status" className="rounded-md border border-sky-300/60 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Vote started — the other admins can now weigh in.
        </p>
      ) : null}
      {search.voted ? (
        <p role="status" className="rounded-md border border-sky-300/60 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Your vote was recorded.
        </p>
      ) : null}
      {search.saved ? (
        <p role="status" className="rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800">
          Team updated.
        </p>
      ) : null}

      {/* ── Open admin votes ──────────────────────────────────────────── */}
      {motions.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/50 p-5">
          <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-sky-900/70">
            <Gavel className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Admin votes ({motions.length})
          </h2>
          <ul className="space-y-3">
            {motions.map((m) => {
              const others = Math.max(adminCount - 1, 0); // admins excluding the target
              const needed = Math.floor(others / 2) + 1;
              const mv = votesByMotion.get(m.motion_id) ?? [];
              const approvals = mv.filter((v) => v.approve && v.voter_user_id !== m.target_user_id).length;
              const myVote = mv.find((v) => v.voter_user_id === user.id);
              const iAmTarget = m.target_user_id === user.id;
              return (
                <li key={m.motion_id} className="rounded-xl border border-sky-200 bg-cream p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {motionLabel(m)} · {nameOf(enriched, m.target_user_id)}
                      </p>
                      <p className="text-xs text-ink/55">
                        Proposed by {nameOf(enriched, m.proposed_by)} · {approvals}/{needed} approvals needed
                      </p>
                    </div>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-sky-800">
                      Open
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {iAmTarget ? (
                      <span className="text-xs text-ink/55">You can’t vote on a motion about yourself.</span>
                    ) : (
                      <>
                        <form action={voteAdminMotion}>
                          <input type="hidden" name="motion_id" value={m.motion_id} />
                          <input type="hidden" name="approve" value="true" />
                          <SubmitButton
                            className={`inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium ${myVote?.approve ? 'bg-success-600 text-white' : 'border border-success-300 bg-cream text-success-900 hover:border-success-500'}`}
                            pendingLabel="…"
                          >
                            Approve{myVote?.approve ? ' ✓' : ''}
                          </SubmitButton>
                        </form>
                        <form action={voteAdminMotion}>
                          <input type="hidden" name="motion_id" value={m.motion_id} />
                          <input type="hidden" name="approve" value="false" />
                          <SubmitButton
                            className={`inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium ${myVote && !myVote.approve ? 'bg-terracotta text-white' : 'border border-ink/20 bg-cream text-ink hover:border-ink/40'}`}
                            pendingLabel="…"
                          >
                            Reject{myVote && !myVote.approve ? ' ✓' : ''}
                          </SubmitButton>
                        </form>
                      </>
                    )}
                    <form action={cancelAdminMotion} className="ml-auto">
                      <input type="hidden" name="motion_id" value={m.motion_id} />
                      <SubmitButton
                        className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-ink/55 hover:text-terracotta"
                        pendingLabel="…"
                      >
                        Cancel vote
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ── Invite ────────────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Invite a team member
        </h2>
        <p className="text-xs text-ink/55">
          V1 invites existing Setnayan accounts only — your colleague signs up first (any account
          type), then you add them here by email.
        </p>
        <form action={inviteVendorTeamMember} className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <label htmlFor="invite-email" className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Email</span>
            <input id="invite-email" name="email" type="email" required placeholder="colleague@example.com" className="input-field" />
          </label>
          <label htmlFor="invite-role" className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Role</span>
            <select id="invite-role" name="role" defaultValue="viewer" className="input-field cursor-pointer">
              {VENDOR_ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{VENDOR_TEAM_ROLE_LABEL[r]}</option>
              ))}
            </select>
          </label>
          <label htmlFor="invite-label" className="block space-y-1">
            <span className="block text-xs font-medium text-ink/70">Label (optional)</span>
            <input id="invite-label" name="team_label" maxLength={64} placeholder="e.g. Videographer" className="input-field" />
          </label>
          <div className="flex items-end">
            <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Adding…">
              <Mail className="mr-1.5 h-4 w-4" strokeWidth={1.75} aria-hidden />
              Add
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* ── Members ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Members ({enriched.length}) · {adminCount} admin{adminCount === 1 ? '' : 's'}
        </h2>

        {enriched.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center">
            <Users aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
            <p className="text-sm font-medium text-ink">No team members yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {enriched.map((m) => {
              const isSelf = m.user_id === user.id;
              const isAdmin = isVendorAdminRole(m.role);
              const hasOpenMotion = motions.some((mo) => mo.target_user_id === m.user_id);
              return (
                <li key={m.vendor_team_member_id} className="rounded-2xl border border-ink/10 bg-cream p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-base font-semibold text-ink">
                        {m.display_name?.trim() || m.email || 'Team member'}
                        {isSelf ? (
                          <span className="ml-2 rounded-full bg-ink/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">You</span>
                        ) : null}
                      </p>
                      <p className="truncate font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                        {m.email ?? '—'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${ROLE_TONE[m.role]}`}>
                          {VENDOR_TEAM_ROLE_LABEL[m.role]}
                        </span>
                        {m.team_label ? (
                          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] text-ink/70">{m.team_label}</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-ink/55">{VENDOR_TEAM_ROLE_BLURB[m.role]}</p>
                    </div>

                    {/* Self admin → Step down. Non-admin other → unilateral remove. */}
                    {isSelf && isAdmin ? (
                      <form action={stepDownSelf}>
                        <button
                          type="submit"
                          disabled={adminCount <= 1}
                          title={adminCount <= 1 ? 'You’re the only admin — promote someone first' : 'Step down to Agent'}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink/5 px-3 text-xs font-medium text-ink/70 hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <LogOut className="h-4 w-4" strokeWidth={1.75} /> Step down
                        </button>
                      </form>
                    ) : !isSelf && !isAdmin ? (
                      <form action={removeVendorTeamMember}>
                        <input type="hidden" name="vendor_team_member_id" value={m.vendor_team_member_id} />
                        <button type="submit" aria-label="Remove team member" className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta">
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {/* Non-admin, non-self → inline role/label edit (promotion to Admin is unilateral). */}
                  {!isSelf && !isAdmin ? (
                    <form action={updateVendorTeamMember} className="grid gap-3 sm:grid-cols-[auto_1fr_auto]">
                      <input type="hidden" name="vendor_team_member_id" value={m.vendor_team_member_id} />
                      <label className="block space-y-1">
                        <span className="block text-xs font-medium text-ink/70">Role</span>
                        <select name="role" defaultValue={m.role} className="input-field cursor-pointer">
                          {VENDOR_ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{VENDOR_TEAM_ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="block text-xs font-medium text-ink/70">Label</span>
                        <input name="team_label" maxLength={64} defaultValue={m.team_label ?? ''} placeholder="e.g. Videographer" className="input-field" />
                      </label>
                      <div className="flex items-end">
                        <SubmitButton className="inline-flex h-9 items-center justify-center rounded-md border border-ink/20 bg-cream px-4 text-xs font-medium text-ink hover:border-ink/40" pendingLabel="Saving…">
                          Save
                        </SubmitButton>
                      </div>
                    </form>
                  ) : null}

                  {/* Another admin → governance: start a demotion/removal vote. */}
                  {!isSelf && isAdmin ? (
                    hasOpenMotion ? (
                      <p className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 text-xs text-sky-900/80">
                        A vote about this admin is open above.
                      </p>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/40 p-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-sky-900/70">
                          Admin changes need a team vote
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={proposeAdminMotion} className="flex items-center gap-2">
                            <input type="hidden" name="target_user_id" value={m.user_id} />
                            <input type="hidden" name="kind" value="demote" />
                            <select name="new_role" defaultValue="agent" className="input-field h-8 cursor-pointer py-0 text-xs">
                              <option value="agent">Demote to Agent</option>
                              <option value="viewer">Demote to Viewer</option>
                            </select>
                            <SubmitButton className="inline-flex h-8 items-center justify-center rounded-md border border-sky-300 bg-cream px-3 text-xs font-medium text-sky-900 hover:border-sky-500" pendingLabel="…">
                              Start vote
                            </SubmitButton>
                          </form>
                          <form action={proposeAdminMotion}>
                            <input type="hidden" name="target_user_id" value={m.user_id} />
                            <input type="hidden" name="kind" value="remove" />
                            <SubmitButton className="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-ink/55 hover:text-terracotta" pendingLabel="…">
                              Start removal vote
                            </SubmitButton>
                          </form>
                        </div>
                      </div>
                    )
                  ) : null}

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
 * Phase 2a — per-service assignment for an agent. An admin checks the services
 * this agent should manage; the agent then sees only those services + their
 * customers. Replace-on-save semantics.
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
    <form action={setVendorAgentServices} className="mt-3 space-y-2 rounded-xl border border-success-200/70 bg-success-50/40 p-3">
      <input type="hidden" name="vendor_team_member_id" value={memberId} />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-success-900/70">
        Assigned services — this agent sees only these (and their customers)
      </p>
      {services.length === 0 ? (
        <p className="text-xs text-ink/55">Add services on the Services page first, then assign them here.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <label key={s.vendor_service_id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-2.5 py-1 text-xs text-ink/80 hover:border-ink/30">
                <input type="checkbox" name="service_ids" value={s.vendor_service_id} defaultChecked={assignedSet.has(s.vendor_service_id)} className="h-3.5 w-3.5 accent-success-600" />
                {categoryLabel(s.category)}
                {s.is_active ? null : <span className="text-ink/40">(inactive)</span>}
              </label>
            ))}
          </div>
          <SubmitButton className="inline-flex h-8 items-center justify-center rounded-md border border-success-300 bg-cream px-3 text-xs font-medium text-success-900 hover:border-success-500" pendingLabel="Saving…">
            Save assignments
          </SubmitButton>
        </>
      )}
    </form>
  );
}
