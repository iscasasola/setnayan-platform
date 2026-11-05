import 'server-only';

import { revalidatePath } from 'next/cache';
import type { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { layerForRelation, type ConnectionRelation } from '@/lib/people-connections';
import { connectionRequestSentence, firstNameOf, normalizeEmail } from '@/lib/people-add';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * THE ASK ITSELF — the ONE writer of a connection request to a known account, shared by the search's Add, the
 * event's Add (People `actions.ts`) and the guest's "Also connect with <hosts>" tick
 * (`lib/guest-connects-hosts.server.ts`), so they can never drift: one PENDING claim (unlabelled unless the caller
 * says), their bell gets the owner's sentence, and — only when the caller hands an `invite` sender — their inbox
 * the invitation. Only they can accept it.
 *
 * It lives here, not in the People `actions.ts`, because a `'use server'` file turns every export into a public
 * route: the guest's link step needs to CALL this writer, and must not be handed a second one.
 *
 * `fromEvent` stamps `created_by_event_id` — the database refuses it unless the sender belongs to that event
 * (migration 20271253740454), and the recipient's row only names it when they host it or celebrate it.
 *
 * 📵 `invite` is the caller's choice. The guest's tick passes none: a request from the link step is in-app only
 * (owner's standing rule — no new emails).
 */
export async function requestConnection(input: {
  supabase: SupabaseServer;
  userId: string;
  fromPerson: string;
  toUserId: string;
  theirName: string | null;
  theirEmail: string | null;
  relation: ConnectionRelation | null;
  fromEvent: { eventId: string; name: string; type: string } | null;
  invite?: (to: string, fromFirstName: string | null) => Promise<boolean>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, fromPerson, relation, fromEvent } = input;
  const admin = createAdminClient();
  const { data: theirPerson } = await admin
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', input.toUserId)
    .is('deleted_at', null)
    .maybeSingle();
  const toPerson = (theirPerson as { person_id: string } | null)?.person_id ?? null;
  if (!toPerson) return { ok: false, error: 'Their profile isn’t ready yet.' };

  const { data: already } = await supabase
    .from('person_connections')
    .select('connection_id')
    .eq('from_person_id', fromPerson)
    .eq('to_person_id', toPerson)
    .is('deleted_at', null)
    .limit(1);
  if (((already ?? []) as unknown[]).length > 0) {
    return { ok: false, error: 'They’re already on your list.' };
  }

  const theirName = (input.theirName ?? '').trim().slice(0, 120) || 'Someone';
  const { error } = await supabase.from('person_connections').insert({
    from_person_id: fromPerson,
    to_person_id: toPerson,
    relation,
    layer: relation ? layerForRelation(relation) : null,
    declared_name: theirName,
    status: 'pending',
    created_by_user_id: input.userId,
    created_by_event_id: fromEvent?.eventId ?? null,
  });
  if (error && error.code !== '23505') {
    return { ok: false, error: 'Couldn’t send the request.' };
  }

  const me = await supabase
    .from('people')
    .select('display_name')
    .eq('person_id', fromPerson)
    .maybeSingle();
  const myDisplayName = ((me.data as { display_name: string | null } | null)?.display_name ?? '').trim();
  const myFirstName = firstNameOf(myDisplayName);

  await emitNotification({
    userId: input.toUserId,
    type: 'connection_request',
    // The owner's sentence (2026-09-28): "{name} is trying to add you from your
    // {event name} {event type} event" — the same words their People row says.
    title: connectionRequestSentence(
      myDisplayName || 'Someone',
      fromEvent ? { name: fromEvent.name, type: fromEvent.type } : null,
    ),
    body: 'Open your people to accept or decline. Nothing connects until you say so.',
    relatedUrl: '/dashboard/people',
  });
  const email = normalizeEmail(input.theirEmail);
  if (email && input.invite) await input.invite(email, myFirstName);

  revalidatePath('/dashboard/people');
  return { ok: true };
}
