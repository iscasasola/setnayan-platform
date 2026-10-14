import { Check, Gavel, LogOut, Trash2, UserPlus, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { Badge } from '@/app/_components/badge';
import { Fold } from '@/app/_components/fold';
import { formatPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { FREE_HELPER_ROLE } from '@/lib/vendor-free-helper';
import {
  isVendorAdminRole,
  VENDOR_TEAM_ROLE_BLURB,
  VENDOR_TEAM_ROLE_LABEL,
  VENDOR_TEAM_ROLE_PICK,
  type AssignableService,
  type VendorAdminMotion,
  type VendorAdminMotionVote,
  type VendorTeamMemberWithUser,
} from '@/lib/vendor-team';
import { ShopNotice } from '../../_components/kit';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { DatesRow } from '../../customers/_components/dates-row';
import { InviteHelperSheet, RolePick } from './helpers-controls';

/**
 * HELPERS — the screen (simpler supplier dashboard step 6; owner-APPROVED 2026-10-14 "team seats → Helpers";
 * prototype SCREENS.helpers + SHEETS.invite). Presentational: every value arrives read and every write is the SHIPPED
 * team action, handed in — so `/vendor-dashboard/team` and `/dev/supplier-plan-lab` draw the same thing.
 *
 *   · one row per person, the role as ONE dropdown (`RolePick` → `updateVendorTeamMember`), ✕ removes;
 *   · Helpers on your plan — the seat line, with the ONE FREE HELPER every plan carries (lib/vendor-free-helper.ts);
 *   · Add a seat (Enterprise/Custom, live catalogue price) · Who works what (labels + an agent's services) ·
 *     Admin changes (two admins agree — the shipped motions) · Step down;
 *   · the one terracotta button, "Invite a helper", opens the invite sheet (`inviteVendorTeamMember`).
 */
type Action = (formData: FormData) => void | Promise<void>;

export type HelpersActions = {
  update: Action;
  remove: Action;
  buySeat: Action;
  vote: Action;
  cancelMotion: Action;
  propose: Action;
  stepDown: Action;
  invite: Action;
  setServices: Action;
};

export type HelpersSearch = { saved?: string; invited?: string; error?: string; motion?: string; voted?: string };

// A NULL proposer means the account was deleted (migration 20271210831005).
// Say so. Falling through to the generic fallback would print a stranger's
// placeholder for a real person who left — the repo's own render-honesty rule.
function nameOf(members: VendorTeamMemberWithUser[], userId: string | null): string {
  if (!userId) return 'a departed admin';
  const m = members.find((x) => x.user_id === userId);
  return m?.display_name?.trim() || m?.email || 'Admin';
}

function motionLabel(m: VendorAdminMotion): string {
  if (m.kind === 'remove') return 'Remove from the shop';
  return `Make a ${m.new_role === 'viewer' ? 'Helper' : 'Team member'}`;
}

export function HelpersView({
  userId,
  founderUserId,
  enriched,
  motionData,
  services,
  assignments,
  seatsLine,
  canBuySeats,
  storeShell,
  extraSeats,
  seatFeePhp,
  search,
  actions,
}: {
  userId: string;
  founderUserId: string | null;
  enriched: VendorTeamMemberWithUser[];
  motionData: { motions: VendorAdminMotion[]; votes: VendorAdminMotionVote[] };
  services: AssignableService[];
  assignments: Record<string, string[]>;
  seatsLine: string;
  canBuySeats: boolean;
  storeShell: boolean;
  extraSeats: number;
  seatFeePhp: number;
  search: HelpersSearch;
  actions: HelpersActions;
}) {
  const adminCount = enriched.filter((m) => isVendorAdminRole(m.role)).length;
  const { motions, votes } = motionData;
  const votesByMotion = new Map<string, VendorAdminMotionVote[]>();
  for (const v of votes) {
    const list = votesByMotion.get(v.motion_id) ?? [];
    list.push(v);
    votesByMotion.set(v.motion_id, list);
  }

  const me = enriched.find((m) => m.user_id === userId) ?? null;
  const iAmAdmin = me ? isVendorAdminRole(me.role) : true;
  const otherAdmins = enriched.filter((m) => m.user_id !== userId && isVendorAdminRole(m.role));
  const agents = enriched.filter((m) => m.role === 'agent');
  const nonAdmins = enriched.filter((m) => m.user_id !== userId && !isVendorAdminRole(m.role));
  const roleOptions = VENDOR_TEAM_ROLE_PICK.map((o) => ({ key: o.key as string, label: o.label }));

  return (
    <section className="mx-auto w-full max-w-xl px-4 pb-32 pt-6 sm:px-6 sm:pt-10" data-helpers-screen="">
      <header className="space-y-1">
        <h1 className="sn-h1">Helpers</h1>
        <p className="text-[14px] text-ink/65">
          Helpers and team members see Today and Customers only. Admins run the shop with you.
        </p>
      </header>

      <div className="mt-3 space-y-2">
        {search.error ? (
          <ShopNotice tone="gold" role="alert">
            {decodeURIComponent(search.error)}
          </ShopNotice>
        ) : null}
        {search.invited ? (
          <ShopNotice tone="success" role="status">
            They are on your team. They see it the next time they open Setnayan.
          </ShopNotice>
        ) : null}
        {search.motion ? (
          <ShopNotice tone="success" role="status">
            Vote started — the other admins can now weigh in.
          </ShopNotice>
        ) : null}
        {search.voted ? (
          <ShopNotice tone="success" role="status">
            Your vote was recorded.
          </ShopNotice>
        ) : null}
        {search.saved ? (
          <ShopNotice tone="success" role="status">
            Saved.
          </ShopNotice>
        ) : null}
      </div>

      {/* ── WHO IS ON THE TEAM — one row each; a role is ONE dropdown ── */}
      <div className="mt-4" data-helpers-members="">
        {enriched.length === 0 ? (
          <DatesRow data="helpers-none" title="Just you so far" line="Invite a helper — one Helper is free on every plan" />
        ) : (
          enriched.map((m) => {
            const isSelf = m.user_id === userId;
            const isAdmin = isVendorAdminRole(m.role);
            const who = m.display_name?.trim() || m.email || 'Team member';
            const line = [m.team_label, isSelf ? 'You' : m.email].filter(Boolean).join(' · ');
            return (
              <DatesRow
                key={m.vendor_team_member_id}
                data="helpers-member"
                title={who}
                line={line || VENDOR_TEAM_ROLE_BLURB[m.role]}
                end={
                  !isSelf && !isAdmin ? (
                    <span className="flex flex-none items-center gap-1">
                      <RolePick
                        memberId={m.vendor_team_member_id}
                        name={who}
                        role={m.role}
                        teamLabel={m.team_label}
                        options={roleOptions}
                        action={actions.update}
                      />
                      <form action={actions.remove}>
                        <input type="hidden" name="vendor_team_member_id" value={m.vendor_team_member_id} />
                        <SupplierSubmit
                          tone="danger"
                          icon={<Trash2 aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                          label={`Remove ${who}`}
                          pendingLabel="Removing…"
                          className="icon-only"
                        />
                      </form>
                    </span>
                  ) : (
                    <Badge tone={isAdmin ? 'ok' : 'quiet'} data="helpers-role">
                      {m.user_id === founderUserId ? 'Owner' : VENDOR_TEAM_ROLE_LABEL[m.role]}
                    </Badge>
                  )
                }
              />
            );
          })
        )}
      </div>

      {/* ── THE PLAN, THE EDGES ── */}
      <div className="mt-5 border-t border-ink/10" data-helpers-rows="">
        <DatesRow
          data="helpers-plan"
          title="Helpers on your plan"
          line={seatsLine}
          badge={{ tone: 'quiet', word: 'Plan' }}
          href={storeShell ? null : '/vendor-dashboard/subscription'}
        />

        {/* Extra seats — Enterprise/Custom ₱/28d add-on, the live catalogue price. 🔒 Never in the store shell. */}
        {canBuySeats && !storeShell ? (
          <DatesRow
            data="helpers-add-seat"
            title="Add a seat"
            line={`${formatPhp(seatFeePhp)} / 28 days each · ${formatCount(extraSeats)} added · joins your renewal`}
            end={
              <form action={actions.buySeat}>
                <SupplierSubmit
                  tone="neutral"
                  icon={<UserPlus aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                  label="Add a seat"
                  pendingLabel="Starting…"
                />
              </form>
            }
          />
        ) : null}

        {/* Who works what — the agents' services, and every helper's "what they do" label. */}
        {nonAdmins.length > 0 ? (
          <div className="border-t border-ink/10" data-helpers-fold="who-works-what">
            <Fold
              title="Who works what"
              line={
                agents.length > 0
                  ? agents.map((a) => `${a.display_name?.trim() || a.email || 'Team member'} · ${(assignments[a.vendor_team_member_id] ?? []).length} services`).join(' · ')
                  : 'What each helper does'
              }
              data="helpers-who-works-what"
            >
              <div className="space-y-3 pb-3">
                {nonAdmins.map((m) => (
                  <div key={m.vendor_team_member_id} className="border-t border-ink/10 pt-3 first:border-t-0 first:pt-0">
                    <form action={actions.update} className="flex min-h-[60px] items-end gap-2">
                      <input type="hidden" name="vendor_team_member_id" value={m.vendor_team_member_id} />
                      <input type="hidden" name="role" value={m.role} />
                      <label className="block min-w-0 flex-1 space-y-1">
                        <span className="block text-[13px] text-ink/60">
                          What {m.display_name?.trim() || m.email || 'they'} do{' '}
                        </span>
                        <input name="team_label" maxLength={64} defaultValue={m.team_label ?? ''} placeholder="e.g. Front desk" className="input-field min-h-11" />
                      </label>
                      <SupplierSubmit
                        tone="neutral"
                        icon={<Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                        label="Save"
                        pendingLabel="Saving…"
                      />
                    </form>
                    {m.role === 'agent' ? (
                      <AgentServiceAssignment
                        action={actions.setServices}
                        memberId={m.vendor_team_member_id}
                        services={services}
                        assigned={assignments[m.vendor_team_member_id] ?? []}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </Fold>
          </div>
        ) : null}

        {/* Admin changes — two admins agree (the shipped motions). */}
        {otherAdmins.length > 0 || motions.length > 0 ? (
          <div className="border-t border-ink/10" data-helpers-fold="admin-changes">
            <Fold
              title="Admin changes"
              line={motions.length > 0 ? `${formatCount(motions.length)} vote${motions.length === 1 ? '' : 's'} open · two admins agree` : 'Two admins agree'}
              aside={motions.length > 0 ? <Badge tone="wait" data="helpers-motions">{formatCount(motions.length)}</Badge> : undefined}
              data="helpers-admin-changes"
            >
              <div className="space-y-3 pb-3">
                {motions.map((m) => {
                  const others = Math.max(adminCount - 1, 0); // admins excluding the target
                  const needed = Math.floor(others / 2) + 1;
                  const mv = votesByMotion.get(m.motion_id) ?? [];
                  const approvals = mv.filter((v) => v.approve && v.voter_user_id !== m.target_user_id).length;
                  const myVote = mv.find((v) => v.voter_user_id === userId);
                  const iAmTarget = m.target_user_id === userId;
                  return (
                    <div key={m.motion_id} className="border-t border-ink/10 pt-3 first:border-t-0 first:pt-0" data-helpers-motion="">
                      <p className="text-[15px] font-medium text-ink">
                        {motionLabel(m)} · {nameOf(enriched, m.target_user_id)}
                      </p>
                      <p className="text-[13px] text-ink/60">
                        Asked by {nameOf(enriched, m.proposed_by)} · {formatCount(approvals)} of {formatCount(needed)} agree
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {iAmTarget ? (
                          <span className="text-[13px] text-ink/60">You can’t vote on a change about yourself.</span>
                        ) : (
                          <>
                            <form action={actions.vote}>
                              <input type="hidden" name="motion_id" value={m.motion_id} />
                              <input type="hidden" name="approve" value="true" />
                              <SupplierSubmit
                                tone="ok"
                                main={myVote?.approve === true}
                                icon={<Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                                label={myVote?.approve ? 'You agreed' : 'Agree'}
                                pendingLabel="…"
                              />
                            </form>
                            <form action={actions.vote}>
                              <input type="hidden" name="motion_id" value={m.motion_id} />
                              <input type="hidden" name="approve" value="false" />
                              <SupplierSubmit
                                tone="danger"
                                icon={<X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                                label={myVote && !myVote.approve ? 'You said no' : 'Say no'}
                                pendingLabel="…"
                              />
                            </form>
                          </>
                        )}
                        <form action={actions.cancelMotion}>
                          <input type="hidden" name="motion_id" value={m.motion_id} />
                          <SupplierSubmit
                            tone="neutral"
                            icon={<X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                            label="Call off the vote"
                            pendingLabel="…"
                          />
                        </form>
                      </div>
                    </div>
                  );
                })}
                {otherAdmins.map((m) => {
                  const who = m.display_name?.trim() || m.email || 'Admin';
                  const hasOpenMotion = motions.some((mo) => mo.target_user_id === m.user_id);
                  if (hasOpenMotion) return null;
                  return (
                    <div key={m.vendor_team_member_id} className="border-t border-ink/10 pt-3 first:border-t-0 first:pt-0" data-helpers-propose="">
                      <p className="text-[15px] font-medium text-ink">{who}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <form action={actions.propose}>
                          <input type="hidden" name="target_user_id" value={m.user_id} />
                          <input type="hidden" name="kind" value="demote" />
                          <input type="hidden" name="new_role" value="agent" />
                          <SupplierSubmit
                            tone="neutral"
                            icon={<Gavel aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                            label="Ask to make them a Team member"
                            pendingLabel="Starting…"
                          />
                        </form>
                        <form action={actions.propose}>
                          <input type="hidden" name="target_user_id" value={m.user_id} />
                          <input type="hidden" name="kind" value="demote" />
                          <input type="hidden" name="new_role" value="viewer" />
                          <SupplierSubmit
                            tone="neutral"
                            icon={<Gavel aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                            label="Ask to make them a Helper"
                            pendingLabel="Starting…"
                          />
                        </form>
                        <form action={actions.propose}>
                          <input type="hidden" name="target_user_id" value={m.user_id} />
                          <input type="hidden" name="kind" value="remove" />
                          <SupplierSubmit
                            tone="danger"
                            icon={<Trash2 aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                            label="Ask to remove them"
                            pendingLabel="Starting…"
                          />
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Fold>
          </div>
        ) : null}

        {/* Step down — an admin leaves the admin role (stays as a Team member). */}
        {iAmAdmin && me ? (
          <DatesRow
            data="helpers-step-down"
            title="Step down"
            line={adminCount <= 1 ? 'You are the only admin — make someone else an admin first' : 'Leave the admin role · you stay as a Team member'}
            end={
              adminCount <= 1 ? undefined : (
                <form action={actions.stepDown}>
                  <SupplierSubmit
                    tone="danger"
                    icon={<LogOut aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                    label="Step down"
                    pendingLabel="Stepping down…"
                  />
                </form>
              )
            }
          />
        ) : null}
      </div>

      <InviteHelperSheet options={roleOptions} defaultRole={FREE_HELPER_ROLE} action={actions.invite} seatLine={seatsLine} />
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
  action,
  memberId,
  services,
  assigned,
}: {
  action: Action;
  memberId: string;
  services: AssignableService[];
  assigned: string[];
}) {
  const assignedSet = new Set(assigned);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="vendor_team_member_id" value={memberId} />
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-success-900/70">
        Their services — they see only these, and those customers
      </p>
      {services.length === 0 ? (
        <p className="text-xs text-ink/55">Add services on the Services page first, then assign them here.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {services.map((s) => (
              <label key={s.vendor_service_id} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-white/70 px-3 py-1 text-[13px] text-ink/80 hover:border-ink/30">
                <input type="checkbox" name="service_ids" value={s.vendor_service_id} defaultChecked={assignedSet.has(s.vendor_service_id)} className="h-3.5 w-3.5 accent-success-600" />
                {categoryLabel(s.category)}
                {s.is_active ? null : <span className="text-ink/40">(inactive)</span>}
              </label>
            ))}
          </div>
          <SubmitButton className="inline-flex min-h-11 items-center justify-center rounded-md border border-success-300 bg-white/70 px-4 text-[13px] font-medium text-success-900 hover:border-success-500" pendingLabel="Saving…">
            Save their services
          </SubmitButton>
        </>
      )}
    </form>
  );
}
