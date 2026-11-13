'use server';

/**
 * /admin/team — areas × levels (DECISION_LOG 2026-11-13, "ADMIN TEAM: AREAS ×
 * LEVELS — AI FIRST, THEN BASIC, THEN ESCALATED").
 *
 * Owner, verbatim: "i can add an admin and pick what they can handle … i can
 * assign an admin for basic or for escalated or both."
 *
 *   · Every act here takes Team · Escalated (the owner always has it).
 *   · Taking a level away is immediate — removing access never waits.
 *   · Giving BASIC is immediate (answering and reversible steps that give
 *     nothing).
 *   · Giving ESCALATED is a two-admin request (`grant_admin_escalated`): a
 *     second admin approves it, or the owner types the word and it runs after
 *     24 hours. Making someone an admin at all is still `grant_team_member`,
 *     which now carries the areas they were added with.
 *   · The owner is shown as "everything" and cannot be changed here; nobody
 *     edits their own areas.
 *
 * Every write lands in admin_audit_log with area = 'team' and the actor.
 */

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminProfile } from '@/lib/admin/admin-predicate';
import { requireAdminCan } from '@/lib/admin/can.server';
import { ADMIN_AREAS, areaHasEscalated, isAdminArea, type AdminArea } from '@/lib/admin/areas';
import { isOwnerProfile } from '@/lib/admin/owner';
import { typedWordMatches } from '@/lib/admin/self-approval';
import { startOwnerWait } from '@/lib/admin/self-approval.server';

type AdminClient = ReturnType<typeof createAdminClient>;

async function auditTeam(
  admin: AdminClient,
  row: { action: string; actor: string; targetUserId: string; reason?: string | null; before?: unknown; after?: unknown },
) {
  const { error } = await admin.from('admin_audit_log').insert({
    action: row.action,
    area: 'team',
    target_table: 'admin_scopes',
    target_id: row.targetUserId,
    actor_user_id: row.actor,
    reason: row.reason ?? null,
    before_json: row.before ?? null,
    after_json: row.after ?? null,
  });
  if (error) console.error('[team audit] insert failed', error.message);
}

/** The ticked areas from the form: `basic` and `escalated` checkbox lists. */
function tickedAreas(formData: FormData): { basic: AdminArea[]; escalated: AdminArea[] } {
  const escalated = [...new Set(formData.getAll('escalated').filter(isAdminArea))].filter(areaHasEscalated);
  // Escalated includes Basic, so a row ticked Escalated is also Basic.
  const basic = [...new Set([...formData.getAll('basic').filter(isAdminArea), ...escalated])];
  return {
    basic: ADMIN_AREAS.filter((a) => basic.includes(a)),
    escalated: ADMIN_AREAS.filter((a) => escalated.includes(a)),
  };
}

async function readPerson(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from('users')
    .select('user_id, email, display_name, is_internal, is_team_member, account_type')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`Couldn’t read that account, so nothing was changed: ${error.message}`);
  if (!data) throw new Error('No Setnayan account with that id.');
  return data;
}

/** Start the owner's 24-hour wait on a request he just raised, when he typed the word. */
async function maybeStartOwnerWait(
  admin: AdminClient,
  formData: FormData,
  callerIsOwner: boolean,
  approvalId: string | null,
  ownerId: string,
): Promise<boolean> {
  if (!approvalId || !callerIsOwner || !typedWordMatches(formData.get('typed'))) return false;
  await startOwnerWait(admin, { approvalId, ownerId });
  return true;
}

async function raiseEscalatedRequest(
  admin: AdminClient,
  args: { actor: string; targetUserId: string; areas: AdminArea[]; rationale: string },
): Promise<string | null> {
  if (args.areas.length === 0) return null;
  const { data, error } = await admin
    .from('admin_approval_requests')
    .insert({
      action_type: 'grant_admin_escalated',
      target_user_id: args.targetUserId,
      payload: { scopes: { escalated: args.areas } },
      rationale: args.rationale.slice(0, 2000),
      initiated_by: args.actor,
    })
    .select('approval_id')
    .single();
  if (error) throw new Error(`Could not ask for the Escalated level: ${error.message}`);
  await auditTeam(admin, {
    action: 'approval_request_created',
    actor: args.actor,
    targetUserId: args.targetUserId,
    reason: args.rationale,
    after: { action_type: 'grant_admin_escalated', areas: args.areas },
  });
  return data.approval_id as string;
}

/**
 * Add an admin: name · email · areas × levels · why. The person must already
 * have a Setnayan account. Not yet an admin ⇒ ONE `grant_team_member` request
 * carrying every ticked area (Basic and Escalated ride on the same approval —
 * making someone an admin already takes two admins). Already an admin ⇒ the
 * same as saving their areas.
 */
export async function addAdmin(formData: FormData) {
  const { userId, powers } = await requireAdminCan('team', 'escalated');
  const admin = createAdminClient();

  const email = String(formData.get('email') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const why = String(formData.get('why') ?? '').trim();
  if (!email) throw new Error('Their account email is required.');
  if (why.length < 3) throw new Error('Say why (recorded in the Admin log).');
  const { basic, escalated } = tickedAreas(formData);
  if (basic.length === 0) throw new Error('Tick at least one area — an admin with no areas can open /admin and do nothing.');

  const { data: target, error } = await admin
    .from('users')
    .select('user_id, email, display_name, is_internal, is_team_member, account_type')
    .ilike('email', email)
    .maybeSingle();
  if (error) throw new Error(`Couldn’t look that email up, so nothing was changed: ${error.message}`);
  if (!target) throw new Error('No Setnayan account with that email — they need to sign up first.');
  if (target.user_id === userId) throw new Error('You cannot add yourself.');
  if (isOwnerProfile(target)) throw new Error('The owner already has every area.');

  const rationale = `${name ? `${name} · ` : ''}${why}`;

  if (isAdminProfile(target)) {
    // Already an admin: Basic now, Escalated as a request.
    await applyAreas(admin, { actor: userId, targetUserId: target.user_id as string, basic, escalated, rationale, callerIsOwner: powers.isOwner, formData });
  } else {
    const { data: req, error: insErr } = await admin
      .from('admin_approval_requests')
      .insert({
        action_type: 'grant_team_member',
        target_user_id: target.user_id,
        payload: { scopes: { basic, escalated } },
        rationale: rationale.slice(0, 2000),
        initiated_by: userId,
      })
      .select('approval_id')
      .single();
    if (insErr) throw new Error(`Could not create the request: ${insErr.message}`);
    await auditTeam(admin, {
      action: 'approval_request_created',
      actor: userId,
      targetUserId: target.user_id as string,
      reason: rationale,
      after: { action_type: 'grant_team_member', target_email: target.email, basic, escalated },
    });
    await maybeStartOwnerWait(admin, formData, powers.isOwner, req.approval_id as string, userId);
  }

  revalidatePath('/admin/team');
  revalidatePath('/admin/approvals');
}

async function applyAreas(
  admin: AdminClient,
  args: {
    actor: string;
    targetUserId: string;
    basic: AdminArea[];
    escalated: AdminArea[];
    rationale: string;
    callerIsOwner: boolean;
    formData: FormData;
  },
) {
  const { data: current, error } = await admin
    .from('admin_scopes')
    .select('area, level')
    .eq('user_id', args.targetUserId);
  if (error) throw new Error(`Couldn’t read their areas, so nothing was changed: ${error.message}`);
  const has = (area: string, level: string) =>
    (current ?? []).some((r) => r.area === area && r.level === level);

  // Taking away — immediate.
  const dropBasic = ADMIN_AREAS.filter((a) => has(a, 'basic') && !args.basic.includes(a));
  const dropEscalated = ADMIN_AREAS.filter((a) => has(a, 'escalated') && !args.escalated.includes(a));
  for (const [level, areas] of [['basic', dropBasic], ['escalated', dropEscalated]] as const) {
    if (areas.length === 0) continue;
    const { error: delErr } = await admin
      .from('admin_scopes')
      .delete()
      .eq('user_id', args.targetUserId)
      .eq('level', level)
      .in('area', areas);
    if (delErr) throw new Error(`Couldn’t take ${level} away: ${delErr.message}`);
  }

  // Giving Basic — immediate.
  const addBasic = args.basic.filter((a) => !has(a, 'basic'));
  if (addBasic.length > 0) {
    const { error: insErr } = await admin
      .from('admin_scopes')
      .upsert(
        addBasic.map((area) => ({ user_id: args.targetUserId, area, level: 'basic', granted_by: args.actor })),
        { onConflict: 'user_id,area,level', ignoreDuplicates: true },
      );
    if (insErr) throw new Error(`Couldn’t give Basic: ${insErr.message}`);
  }

  if (dropBasic.length + dropEscalated.length + addBasic.length > 0) {
    await auditTeam(admin, {
      action: 'admin_scopes_changed',
      actor: args.actor,
      targetUserId: args.targetUserId,
      reason: args.rationale,
      before: { scopes: current ?? [] },
      after: { removed_basic: dropBasic, removed_escalated: dropEscalated, added_basic: addBasic },
    });
  }

  // Giving Escalated — a two-admin request (the owner: typed + 24 h).
  const addEscalated = args.escalated.filter((a) => !has(a, 'escalated'));
  const approvalId = await raiseEscalatedRequest(admin, {
    actor: args.actor,
    targetUserId: args.targetUserId,
    areas: addEscalated,
    rationale: args.rationale,
  });
  await maybeStartOwnerWait(admin, args.formData, args.callerIsOwner, approvalId, args.actor);
}

/** Save one admin's areas × levels. */
export async function saveAdminAreas(formData: FormData) {
  const { userId, powers } = await requireAdminCan('team', 'escalated');
  const admin = createAdminClient();
  const targetUserId = String(formData.get('user_id') ?? '');
  if (!targetUserId) throw new Error('Invalid admin');
  if (targetUserId === userId) throw new Error('Nobody edits their own areas — ask the owner.');
  const target = await readPerson(admin, targetUserId);
  if (isOwnerProfile(target)) throw new Error('The owner has every area and cannot be changed.');
  if (!isAdminProfile(target)) throw new Error('That account is not an admin — use Add an admin.');

  const { basic, escalated } = tickedAreas(formData);
  const why = String(formData.get('why') ?? '').trim() || 'Areas changed on the Team screen';
  await applyAreas(admin, { actor: userId, targetUserId, basic, escalated, rationale: why, callerIsOwner: powers.isOwner, formData });

  revalidatePath('/admin/team');
  revalidatePath('/admin/approvals');
}

/** Take every area away. Immediate; they keep their account (and /admin opens to nothing). */
export async function takeAllAreasAway(formData: FormData) {
  const { userId } = await requireAdminCan('team', 'escalated');
  const admin = createAdminClient();
  const targetUserId = String(formData.get('user_id') ?? '');
  if (!targetUserId) throw new Error('Invalid admin');
  if (targetUserId === userId) throw new Error('Nobody edits their own areas — ask the owner.');
  const target = await readPerson(admin, targetUserId);
  if (isOwnerProfile(target)) throw new Error('The owner has every area and cannot be changed.');

  const { data: removed, error } = await admin
    .from('admin_scopes')
    .delete()
    .eq('user_id', targetUserId)
    .select('area, level');
  if (error) throw new Error(`Couldn’t take the areas away: ${error.message}`);
  await auditTeam(admin, {
    action: 'admin_scopes_cleared',
    actor: userId,
    targetUserId,
    before: { scopes: removed ?? [] },
    after: { scopes: [] },
  });
  revalidatePath('/admin/team');
}
