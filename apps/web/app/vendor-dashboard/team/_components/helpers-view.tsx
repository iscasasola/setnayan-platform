import { Check, Gavel, LogOut, Trash2, UserPlus, X } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { Fold } from '@/app/_components/fold';
import { formatPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import {
  isVendorAdminRole,
  type AssignableService,
  type VendorAdminMotion,
  type VendorAdminMotionVote,
  type VendorTeamMemberWithUser,
} from '@/lib/vendor-team';
import { ShopNotice } from '../../_components/kit';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { DatesRow } from '../../customers/_components/dates-row';
import { InviteHelperSheet, RolePick } from './helpers-controls';
import { TeamMemberCard } from './member-card';
import {
  BRANCH_MANAGER_MAY_GIVE,
  VENDOR_DUTIES,
  dutyOfRank,
  isVendorDuty,
  roleNameOf,
  roleOptionLabel,
  type VendorDuty,
  type VendorRoleNames,
} from '@/lib/vendor-duties';
import { StayForm } from '@/app/_components/stay-form';
import { AgentServiceAssignment } from './who-works-what-services';
import { keyOfBranchId, whoWorksWhatLine, type BranchScope, type ScopedService } from '@/lib/branch-copy';
import { PLAN_PERIOD } from '@/lib/vendor-plan-change-words';

/**
 * HELPERS — the screen (simpler supplier dashboard step 6; owner-APPROVED 2026-10-14 "team seats → Helpers";
 * prototype SCREENS.helpers + SHEETS.invite). Presentational: every value arrives read and every write is the SHIPPED
 * team action, handed in — so `/vendor-dashboard/team` and `/dev/supplier-plan-lab` draw the same thing.
 *
 *   · one row per person, the role as ONE dropdown (`RolePick` → `updateVendorTeamMember`), ✕ removes;
 *   · Helpers on your plan — the seat line, with the ONE FREE HELPER every plan carries (lib/vendor-free-helper.ts);
 *   · Add a seat (Ultra, live catalogue price) · Who works what (labels + an agent's services) ·
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
  return `Make ${m.new_role === 'viewer' ? 'a Helper' : 'an Account Manager'}`;
}

/** The member's role — the row's own, else the nearest role to its rank (a row read before the six landed). */
function dutyOfMember(m: VendorTeamMemberWithUser): VendorDuty {
  return isVendorDuty(m.duty) ? m.duty : dutyOfRank(m.role);
}

export function HelpersView({
  userId,
  branchScope,
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
  embedded = false,
  manager = { duty: 'shop_manager', branchId: null },
  roleNames = {},
}: {
  /** 🧑‍🤝‍🧑 Who is running the screen: a Shop Manager (the whole shop) or a Branch Manager (their branch). */
  manager?: { duty: 'shop_manager' | 'branch_manager'; branchId: string | null };
  /** The shop's own name for each role (Team › Roles); empty = the fixed names. */
  roleNames?: VendorRoleNames;
  userId: string;
  /** 🏢 Whole branch (owner 2026-11-14, item 9) — the shop's locations and who holds which in full. Omitted = one location. */
  branchScope?: BranchScope;
  founderUserId: string | null;
  enriched: VendorTeamMemberWithUser[];
  motionData: { motions: VendorAdminMotion[]; votes: VendorAdminMotionVote[] };
  services: AssignableService[];
  assignments: Record<string, string[]>;
  seatsLine: string;
  canBuySeats: boolean;
  storeShell: boolean;
  extraSeats: number;
  /** The live `vendor_extra_seat` price; null when unread — then no figure is shown. */
  seatFeePhp: number | null;
  search: HelpersSearch;
  actions: HelpersActions;
  /** Drawn inside the Shop ⚙'s "Team" fold (2026-10-31): no page column, no page title — the fold names it. */
  embedded?: boolean;
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
  const isShopManager = manager.duty === 'shop_manager';
  const iAmAdmin = isShopManager && (me ? isVendorAdminRole(me.role) : true);
  const otherAdmins = isShopManager ? enriched.filter((m) => m.user_id !== userId && isVendorAdminRole(m.role)) : [];
  // Who works what: the Account Managers — they are set to service cards (owner 19 Nov). A Branch Manager holds their
  // branch whole by role, so has no boxes to tick.
  const agents = enriched.filter((m) => dutyOfMember(m) === 'account_manager' && m.user_id !== userId);
  // 🧑‍🤝‍🧑 The role pick: the shop's name with the fixed role beside it (drawing (c)). A Branch Manager gives the roles
  // at or below theirs only.
  const givable: readonly VendorDuty[] = isShopManager ? VENDOR_DUTIES : BRANCH_MANAGER_MAY_GIVE;
  const roleOptions = givable.map((d) => ({ key: d as string, label: roleOptionLabel(roleNames, d) }));
  // Who works what names each service by its card title, filed under its location (owner 2026-11-14, item 9).
  const myBranchKey = keyOfBranchId(manager.branchId);
  const allLocations = branchScope?.locations ?? [];
  const locations = isShopManager ? allLocations : allLocations.filter((l) => l.key === myBranchKey);
  const labelOfKey = new Map(allLocations.map((l) => [l.key, l.label] as const));
  const wholeKeys = branchScope?.wholeKeys ?? {};
  const scoped: ScopedService[] = services
    .map((s) => ({
      id: s.vendor_service_id,
      name: s.title?.trim() || categoryLabel(s.category),
      key: keyOfBranchId(s.branch_id),
      active: s.is_active,
    }))
    .filter((s) => isShopManager || s.key === myBranchKey);

  const introLine = isShopManager
    ? 'Each person has one role. Give each role your shop’s own name on Roles.'
    : `You run ${labelOfKey.get(myBranchKey) ?? 'your branch'}’s team — Account Managers, Event Crew and Helpers.`;

  return (
    <section className={embedded ? 'pb-2' : 'mx-auto w-full max-w-xl px-4 pb-32 pt-6 sm:px-6 sm:pt-10'} data-helpers-screen="">
      <header className="space-y-1">
        {embedded ? null : <h1 className="sn-h1">Team</h1>}
        <p className="text-[14px] text-ink/65">{introLine}</p>
      </header>

      <div className="mt-3 space-y-2">
        {search.error ? (
          <ShopNotice tone="gold" role="alert">
            {search.error}
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
          <DatesRow data="helpers-none" title="Just you so far" line="Invite someone — one Helper is free on every plan" />
        ) : (
          enriched.map((m) => {
            const isSelf = m.user_id === userId;
            const isAdmin = isVendorAdminRole(m.role);
            const who = m.display_name?.trim() || m.email || 'Team member';
            const duty = dutyOfMember(m);
            const branchKey = keyOfBranchId(m.branch_id);
            // A Branch Manager changes only the roles at or below theirs — the database refuses the rest anyway.
            const canChange = !isSelf && !isAdmin && (isShopManager || BRANCH_MANAGER_MAY_GIVE.includes(duty));
            return (
              <TeamMemberCard
                key={m.vendor_team_member_id}
                memberId={m.vendor_team_member_id}
                name={who}
                duty={duty}
                names={roleNames}
                branchLabel={labelOfKey.get(branchKey) ?? null}
                cardCount={duty === 'account_manager' || duty === 'branch_manager' ? (assignments[m.vendor_team_member_id] ?? []).length : null}
                teamLabel={m.team_label}
                isSelf={isSelf}
                end={
                  canChange ? (
                    <span className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
                      <RolePick
                        memberId={m.vendor_team_member_id}
                        name={who}
                        role={duty}
                        branchKey={branchKey}
                        teamLabel={m.team_label}
                        options={roleOptions}
                        locations={locations}
                        action={actions.update}
                      />
                      <StayForm door="supTeam.removeVendorTeamMember" action={actions.remove}>
                        <input type="hidden" name="vendor_team_member_id" value={m.vendor_team_member_id} />
                        <SupplierSubmit
                          tone="danger"
                          icon={<Trash2 aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                          label={`Remove ${who}`}
                          pendingLabel="Removing…"
                          className="icon-only"
                        />
                      </StayForm>
                    </span>
                  ) : null
                }
                aside={
                  m.user_id === founderUserId ? (
                    <Badge tone="ok" data="helpers-role">
                      Owner
                    </Badge>
                  ) : m.paused_by_plan_at ? (
                    // 👤 d–h (g), drawing (b): a seat a smaller plan paused — on the team, can't sign in to the shop.
                    <Badge tone="wait" data="helpers-waiting-for-plan">
                      Added · waiting for plan
                    </Badge>
                  ) : null
                }
              />
            );
          })
        )}
      </div>

      {/* ── THE PLAN, THE EDGES ── */}
      <div className="mt-5 border-t border-ink/10" data-helpers-rows="">
        <DatesRow
          data="helpers-roles"
          title="Roles"
          line={`${VENDOR_DUTIES.map((d) => roleNameOf(roleNames, d)).slice(0, 3).join(' · ')} · and 3 more`}
          href="/vendor-dashboard/team/roles"
        />
        <DatesRow
          data="helpers-plan"
          title="Seats on your plan"
          line={seatsLine}
          badge={{ tone: 'quiet', word: 'Plan' }}
          href={storeShell || !isShopManager ? null : '/vendor-dashboard/subscription'}
        />

        {/* Extra seats — Ultra add-on that joins the plan's monthly renewal, the live catalogue price. 🔒 Never in the store shell. */}
        {canBuySeats && !storeShell ? (
          <DatesRow
            data="helpers-add-seat"
            title="Add a seat"
            line={`${seatFeePhp !== null ? `${formatPhp(seatFeePhp)} ${PLAN_PERIOD.slash} each · ` : ''}${formatCount(extraSeats)} added · joins your renewal`}
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

        {/* Who works what — each TEAM MEMBER's services and "what they do" label. A view-only Helper is not listed: they
            work no service, so a services picker would do nothing for them (supplier batch walk R5). */}
        {agents.length > 0 ? (
          <div className="border-t border-ink/10" data-helpers-fold="who-works-what">
            <Fold
              title="Who works what"
              line={agents.map((a) => whoWorksWhatLine(a.display_name?.trim() || a.email || 'Team member', assignments[a.vendor_team_member_id] ?? [], locations.length >= 2 ? (wholeKeys[a.vendor_team_member_id] ?? []) : [], scoped, locations)).join(' · ')}
              data="helpers-who-works-what"
            >
              <div className="space-y-3 pb-3">
                {agents.map((m) => (
                  <div key={m.vendor_team_member_id} className="border-t border-ink/10 pt-3 first:border-t-0 first:pt-0">
                    <StayForm door="supTeam.updateVendorTeamMember" action={actions.update} className="flex min-h-[60px] items-end gap-2">
                      <input type="hidden" name="vendor_team_member_id" value={m.vendor_team_member_id} />
                      <label className="block min-w-0 flex-1 space-y-1">
                        <span className="block text-[13px] text-ink/60">
                          What {m.display_name?.trim() || m.email || 'this team member'} does{' '}
                        </span>
                        <input name="team_label" maxLength={64} defaultValue={m.team_label ?? ''} placeholder="e.g. Front desk" className="input-field min-h-11" />
                      </label>
                      <SupplierSubmit
                        tone="neutral"
                        icon={<Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                        label="Save"
                        pendingLabel="Saving…"
                      />
                    </StayForm>
                    {dutyOfMember(m) === 'account_manager' ? (
                      <AgentServiceAssignment
                        action={actions.setServices}
                        memberId={m.vendor_team_member_id}
                        services={scoped}
                        assigned={assignments[m.vendor_team_member_id] ?? []}
                        locations={locations}
                        wholeKeys={wholeKeys[m.vendor_team_member_id] ?? []}
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
                            <StayForm door="supTeam.voteAdminMotion" action={actions.vote}>
                              <input type="hidden" name="motion_id" value={m.motion_id} />
                              <input type="hidden" name="approve" value="true" />
                              <SupplierSubmit
                                tone="ok"
                                main={myVote?.approve === true}
                                icon={<Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                                label={myVote?.approve ? 'You agreed' : 'Agree'}
                                pendingLabel="…"
                              />
                            </StayForm>
                            <StayForm door="supTeam.voteAdminMotion" action={actions.vote}>
                              <input type="hidden" name="motion_id" value={m.motion_id} />
                              <input type="hidden" name="approve" value="false" />
                              <SupplierSubmit
                                tone="danger"
                                icon={<X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                                label={myVote && !myVote.approve ? 'You said no' : 'Say no'}
                                pendingLabel="…"
                              />
                            </StayForm>
                          </>
                        )}
                        <StayForm door="supTeam.cancelAdminMotion" action={actions.cancelMotion}>
                          <input type="hidden" name="motion_id" value={m.motion_id} />
                          <SupplierSubmit
                            tone="neutral"
                            icon={<X aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                            label="Call off the vote"
                            pendingLabel="…"
                          />
                        </StayForm>
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
                        <StayForm door="supTeam.proposeAdminMotion" action={actions.propose}>
                          <input type="hidden" name="target_user_id" value={m.user_id} />
                          <input type="hidden" name="kind" value="demote" />
                          <input type="hidden" name="new_role" value="agent" />
                          <SupplierSubmit
                            tone="neutral"
                            icon={<Gavel aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                            label="Ask to make them an Account Manager"
                            pendingLabel="Starting…"
                          />
                        </StayForm>
                        <StayForm door="supTeam.proposeAdminMotion" action={actions.propose}>
                          <input type="hidden" name="target_user_id" value={m.user_id} />
                          <input type="hidden" name="kind" value="demote" />
                          <input type="hidden" name="new_role" value="viewer" />
                          <SupplierSubmit
                            tone="neutral"
                            icon={<Gavel aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                            label="Ask to make them a Helper"
                            pendingLabel="Starting…"
                          />
                        </StayForm>
                        <StayForm door="supTeam.proposeAdminMotion" action={actions.propose}>
                          <input type="hidden" name="target_user_id" value={m.user_id} />
                          <input type="hidden" name="kind" value="remove" />
                          <SupplierSubmit
                            tone="danger"
                            icon={<Trash2 aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                            label="Ask to remove them"
                            pendingLabel="Starting…"
                          />
                        </StayForm>
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
            line={adminCount <= 1 ? 'You are the only Shop Manager — make someone else a Shop Manager first' : 'Leave the Shop Manager role · you stay as an Account Manager'}
            end={
              adminCount <= 1 ? undefined : (
                <StayForm door="supTeam.stepDownSelf" action={actions.stepDown}>
                  <SupplierSubmit
                    tone="danger"
                    icon={<LogOut aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
                    label="Step down"
                    pendingLabel="Stepping down…"
                  />
                </StayForm>
              )
            }
          />
        ) : null}
      </div>

      <InviteHelperSheet
        options={roleOptions}
        defaultRole="helper"
        locations={locations}
        defaultBranch={isShopManager ? 'main' : myBranchKey}
        action={actions.invite}
        seatLine={seatsLine}
      />
    </section>
  );
}


function categoryLabel(category: string): string {
  return category
    .split(/[_-]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
