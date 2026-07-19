'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import {
  layerForRelation,
  peopleConnectionsEnabled,
  type ConnectionRelation,
  DECLARABLE_RELATIONS,
} from '@/lib/people-connections';

/**
 * Person-spine · Phase 2 · connection flow server actions (STAGED).
 *
 * ⚠ Every action hard-guards on `peopleConnectionsEnabled()` (default OFF), so
 * in production they are inert no-ops until PH counsel signs off and the owner
 * flips the flag. Nothing writes relationship data while the flag is off. The
 * interactive UI that calls these is a paired sub-slice (it also needs a
 * cross-person name-visibility RLS decision that belongs with the counsel review).
 *
 * Model: you declare edges FROM your own person (first-degree only); the other
 * side CONFIRMS (mutual). We resolve the target by email via the Phase-1
 * resolver (find-or-create), then insert a pending edge.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function myPersonId(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as { person_id: string } | null)?.person_id ?? null;
}

/** Declare a first-degree connection to someone by email; sends a pending request. */
export async function proposeConnection(input: {
  relation: ConnectionRelation;
  email: string;
}): Promise<ActionResult> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  if (!DECLARABLE_RELATIONS.includes(input.relation)) {
    return { ok: false, error: 'Pick a relationship.' };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) return { ok: false, error: 'Enter a valid email.' };

  const supabase = await createClient();
  const fromPerson = await myPersonId(supabase, user.id);
  if (!fromPerson) return { ok: false, error: 'Your profile isn’t ready yet — try again in a moment.' };

  // Find-or-create the target person by email (unclaimed if new), created by me.
  const { data: toPerson, error: rpcErr } = await supabase.rpc('resolve_or_claim_person', {
    p_email: email,
    p_creator: user.id,
  });
  if (rpcErr || !toPerson) return { ok: false, error: 'Couldn’t find or add that person.' };
  if (toPerson === fromPerson) return { ok: false, error: 'That’s you.' };

  const { error } = await supabase.from('person_connections').insert({
    from_person_id: fromPerson,
    to_person_id: toPerson,
    relation: input.relation,
    layer: layerForRelation(input.relation),
    status: 'pending',
    created_by_user_id: user.id,
  });
  if (error) {
    // 23505 = unique_violation on the (from, to, relation) edge index.
    return {
      ok: false,
      error: error.code === '23505' ? 'You’ve already added them.' : 'Couldn’t send the request.',
    };
  }
  revalidatePath('/dashboard/people');
  return { ok: true };
}

/** The TO-person accepts a pending request (mutual confirmation). */
export async function confirmConnection(connectionId: string): Promise<ActionResult> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const myPerson = await myPersonId(supabase, user.id);
  if (!myPerson) return { ok: false, error: 'Your profile isn’t ready yet.' };

  // Only the recipient may confirm: to_person = me AND still pending.
  const { error } = await supabase
    .from('person_connections')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('connection_id', connectionId)
    .eq('to_person_id', myPerson)
    .eq('status', 'pending');
  if (error) return { ok: false, error: 'Couldn’t confirm.' };
  revalidatePath('/dashboard/people');
  return { ok: true };
}

/** The TO-person declines a pending request. */
export async function declineConnection(connectionId: string): Promise<ActionResult> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const myPerson = await myPersonId(supabase, user.id);
  if (!myPerson) return { ok: false, error: 'Your profile isn’t ready yet.' };

  const { error } = await supabase
    .from('person_connections')
    .update({ status: 'declined', declined_at: new Date().toISOString() })
    .eq('connection_id', connectionId)
    .eq('to_person_id', myPerson)
    .eq('status', 'pending');
  if (error) return { ok: false, error: 'Couldn’t decline.' };
  revalidatePath('/dashboard/people');
  return { ok: true };
}

/**
 * Generate the EVENT-created connection proposals for a ceremony (the locked
 * "the ceremony creates the edge" model): for a wedding, the spouse edge
 * (bride ↔ groom) + godparent edges (accepted principal sponsors → each
 * principal). Delegates the derivation to the idempotent SECURITY-DEFINER
 * `generate_event_connections` SQL function; the edges land as pending
 * proposals, still mutually confirmed by the other side.
 *
 * Host-only (couple member or accepted moderator — mirrors the event_sponsors
 * RLS). The SQL fn bypasses RLS, so this authorization gate is load-bearing.
 * Flag-guarded like every Phase-2 action: a no-op in production until PH counsel
 * signs off and the flag is flipped. Not yet auto-wired to the sponsor-accept /
 * role-set flows (a deliberate follow-up, kept off the live path for now).
 */
export async function generateEventConnections(
  eventId: string,
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  if (!eventId) return { ok: false, error: 'Missing event.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const supabase = await createClient();

  // Host-only: an event_members 'couple' row OR an accepted, non-removed
  // moderator. Read under RLS — if the caller can't see the row, they aren't it.
  const [{ data: couple }, { data: mod }] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .eq('member_type', 'couple')
      .maybeSingle(),
    supabase
      .from('event_moderators')
      .select('moderator_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);
  if (!couple && !mod) return { ok: false, error: 'Only the couple can do this.' };

  const { data, error } = await supabase.rpc('generate_event_connections', {
    p_event_id: eventId,
    p_creator: user.id,
  });
  if (error) return { ok: false, error: 'Couldn’t generate connections.' };
  revalidatePath('/dashboard/people');
  return { ok: true, created: (data as number | null) ?? 0 };
}

/**
 * The 2°→1° upgrade (owner degree model 2026-07-17): propose a friend
 * connection to a samahan co-member — your second degree becoming first.
 *
 * ⚠ Flag-guarded like every action here (inert until counsel + flag flip).
 * The target is addressed by community_members.id (bigserial — the roster
 * rule: never a UUID or email from the client):
 *   1. The member row is read with the USER client — community_roster_member_read
 *      RLS returns it only if the caller shares that samahan, which IS the
 *      second-degree proof.
 *   2. The target's person resolves server-side (admin: user_id → person, or
 *      email → resolve_or_claim_person as a fallback); emails never leave the
 *      server.
 *   3. The edge inserts under the USER client exactly like proposeConnection —
 *      relation 'friend', pending, mutual-confirm.
 */
export async function proposeSamahanConnection(formData: FormData): Promise<void> {
  if (!peopleConnectionsEnabled()) redirect('/dashboard/people');
  const memberRowId = Number(formData.get('member_row_id'));
  if (!Number.isInteger(memberRowId) || memberRowId <= 0) redirect('/dashboard/people');

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Second-degree proof: RLS only returns the row if we share that samahan.
  const { data: member } = await supabase
    .from('community_members')
    .select('user_id')
    .eq('id', memberRowId)
    .maybeSingle();
  const targetUserId = (member as { user_id: string } | null)?.user_id;
  if (!targetUserId || targetUserId === user.id) redirect('/dashboard/people');

  const fromPerson = await myPersonId(supabase, user.id);
  if (!fromPerson) redirect('/dashboard/people?error=profile_not_ready');

  // Resolve the co-member's person spine row server-side (their person is not
  // visible under our RLS pre-connection — that's by design).
  const admin = createAdminClient();
  const { data: personRow } = await admin
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', targetUserId)
    .is('deleted_at', null)
    .maybeSingle();
  let toPerson = (personRow as { person_id: string } | null)?.person_id ?? null;
  if (!toPerson) {
    // No person row yet — find-or-create via the Phase-1 resolver. The email
    // is read and consumed server-side only.
    const { data: u } = await admin.from('users').select('email').eq('user_id', targetUserId).maybeSingle();
    const email = ((u as { email: string | null } | null)?.email ?? '').trim().toLowerCase();
    if (!email) redirect('/dashboard/people?error=connect_failed');
    const { data: resolved } = await supabase.rpc('resolve_or_claim_person', {
      p_email: email,
      p_creator: user.id,
    });
    toPerson = (resolved as string | null) ?? null;
  }
  if (!toPerson || toPerson === fromPerson) redirect('/dashboard/people?error=connect_failed');

  const { error } = await supabase.from('person_connections').insert({
    from_person_id: fromPerson,
    to_person_id: toPerson,
    relation: 'friend',
    layer: layerForRelation('friend'),
    status: 'pending',
    created_by_user_id: user.id,
  });
  if (error && error.code !== '23505') redirect('/dashboard/people?error=connect_failed');

  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?saved=1');
}
