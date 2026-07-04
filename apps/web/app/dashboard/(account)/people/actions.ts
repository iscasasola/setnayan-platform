'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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
