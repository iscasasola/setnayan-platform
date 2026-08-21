'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { renderBrandedEmail } from '@/lib/email-template';
import {
  layerForRelation,
  peopleConnectionsEnabled,
  type ConnectionRelation,
  DECLARABLE_RELATIONS,
} from '@/lib/people-connections';
import { getSpouseContext } from '@/lib/people-spouse-context';
import { firstNameOf, normalizeEmail, spouseIsOfferable } from '@/lib/people-add';

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

/** The absolute origin of the running app, for links that leave it. */
async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'www.setnayan.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

/**
 * The invitation, in ONE place, because it is sent from three call sites and a
 * second copy would drift.
 *
 * 🔒 WHAT IT MAY AND MAY NOT SAY. It names the SENDER's first name — they typed
 * this address themselves, exactly as they do for a samahan link — and it never
 * names the RELATION. "Ana added you" is an invitation; "Ana says you are her
 * wife" is a claim about somebody delivered to an address that might be a typo.
 * The claim itself lives behind sign-in, where only the person it is about can
 * read it.
 *
 * The CTA is `/login?next=/dashboard/people`: the sign-in card threads `next`
 * through to its signup link, so one URL serves both the person who already has
 * an account and the person who does not.
 */
async function sendPeopleInvitation(
  to: string,
  fromFirstName: string | null,
): Promise<boolean> {
  const origin = await appOrigin();
  const url = `${origin}/login?next=${encodeURIComponent('/dashboard/people')}`;
  const who = fromFirstName ?? 'Someone you know';
  const heading = `${who} added you to their people`;
  const lines = [
    `${who} keeps their celebrations on Setnayan — birthdays, weddings, the photos afterwards — and added you to the people in their life.`,
    'Open your people to see who it is and decide. Nothing connects until you confirm it yourself.',
  ];
  const sent = await sendEmail({
    to,
    subject: `${who} added you on Setnayan`,
    text: `${lines.join('\n\n')}\n\nSee who added you: ${url}`,
    html: renderBrandedEmail({
      heading,
      paragraphs: lines,
      ctaLabel: 'See who added me',
      ctaHref: url,
      footnote:
        'If you weren’t expecting this, you can ignore this email — nothing is shared and nothing connects without your confirmation.',
    }),
  });
  return sent.ok;
}

/**
 * ADD SOMEONE — the one door, and the one that now actually reaches them.
 *
 * ⚠ WHAT THIS REPLACES. `proposeConnection` wrote a row and stopped: no email,
 * no notification, and the home page counts confirmed connections only, so a
 * request landed somewhere nobody would meet it. It also called the
 * find-or-create resolver FIRST, which minted a person node holding a stranger's
 * email — and only then hit `kin_pilot_mutual_accounts`, which refuses a
 * connection to an unclaimed person. So the one thing that survived a request
 * to a non-user was the record of them that the pilot boundary exists to
 * prevent, and the adder was told "Couldn't send the request."
 *
 * THE ORDER IS NOW: look up (never create) → they have an account? store the
 * claim and tell them : store NOTHING and invite them to join.
 *
 * 🔒 BOTH BRANCHES RETURN THE SAME SHAPE. `{ ok, delivered }` and one sentence
 * of copy — see the oracle note in `lib/people-add.ts`. A caller cannot learn
 * from this action whether an address has a Setnayan account.
 */
export async function addPersonConnection(input: {
  relation: ConnectionRelation;
  name: string;
  email: string;
}): Promise<{ ok: true; delivered: boolean } | { ok: false; error: string }> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  if (!DECLARABLE_RELATIONS.includes(input.relation)) {
    return { ok: false, error: 'Pick a relationship.' };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const name = (input.name ?? '').trim().slice(0, 120);
  if (!name) return { ok: false, error: 'Add their name.' };
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: 'Enter their email so we can reach them.' };

  const supabase = await createClient();

  // THE SPOUSE RULE IS ENFORCED HERE, NOT BY THE HIDDEN CHIP. A chip the
  // browser never drew is still a value a hand-made request can post.
  if (input.relation === 'spouse') {
    const ctx = await getSpouseContext(user.id);
    if (!spouseIsOfferable(ctx)) {
      return {
        ok: false,
        error:
          'Set “Married” on your profile — or hold until your wedding day has passed — before adding a spouse.',
      };
    }
  }

  const fromPerson = await myPersonId(supabase, user.id);
  if (!fromPerson) return { ok: false, error: 'Your profile isn’t ready yet — try again in a moment.' };

  const me = await supabase
    .from('people')
    .select('display_name')
    .eq('person_id', fromPerson)
    .maybeSingle();
  const myFirstName = firstNameOf((me.data as { display_name: string | null } | null)?.display_name);

  // LOOK UP, NEVER CREATE. An address with no account leaves no trace here —
  // that is the pilot boundary honoured rather than tripped over. The admin
  // client is used because another person's row is invisible under
  // `people_owner_all`, and NOTHING about the lookup is returned to the caller.
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('people')
    .select('person_id, claimed_by_user_id')
    .eq('email', email)
    .is('deleted_at', null)
    .not('claimed_by_user_id', 'is', null)
    .maybeSingle();
  const toPerson = (existing as { person_id: string } | null)?.person_id ?? null;

  if (!toPerson) {
    // No account behind that address: invite them, store nothing about them.
    const delivered = await sendPeopleInvitation(email, myFirstName);
    return { ok: true, delivered };
  }
  if (toPerson === fromPerson) return { ok: false, error: 'That’s you.' };

  const { error } = await supabase.from('person_connections').insert({
    from_person_id: fromPerson,
    to_person_id: toPerson,
    relation: input.relation,
    layer: layerForRelation(input.relation),
    status: 'pending',
    created_by_user_id: user.id,
  });
  if (error && error.code !== '23505') {
    // 23505 = the edge already exists; re-sending the note is the kind answer,
    // so it falls through to the send rather than reading as a failure.
    return { ok: false, error: 'Couldn’t send the request.' };
  }

  const delivered = await sendPeopleInvitation(email, myFirstName);
  revalidatePath('/dashboard/people');
  return { ok: true, delivered };
}

/**
 * WITHDRAW a request I sent. A forward primitive with no inverse is how a
 * couple ends up unable to un-ask (the `cancel_vendor_lock_request` lesson,
 * 2026-08-16) — so the ask ships with its own undo.
 *
 * Soft-delete, not DELETE: every read in the product already filters
 * `deleted_at`, and the row is evidence of what was asked. Only the DECLARER's
 * side is touched; a confirmed connection is a mutual fact and comes down the
 * same way, from whichever side asks.
 */
export async function withdrawConnection(connectionId: string): Promise<ActionResult> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const myPerson = await myPersonId(supabase, user.id);
  if (!myPerson) return { ok: false, error: 'Your profile isn’t ready yet.' };

  const { error } = await supabase
    .from('person_connections')
    .update({ deleted_at: new Date().toISOString() })
    .eq('connection_id', connectionId)
    .eq('from_person_id', myPerson)
    .is('deleted_at', null);
  if (error) return { ok: false, error: 'Couldn’t remove that.' };
  revalidatePath('/dashboard/people');
  return { ok: true };
}

/**
 * SEND THE NOTE AGAIN for a request already waiting. The address is read
 * server-side from the person node and never returned — the caller learns only
 * whether the send left the building.
 */
export async function resendConnectionInvitation(
  connectionId: string,
): Promise<{ ok: true; delivered: boolean } | { ok: false; error: string }> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const myPerson = await myPersonId(supabase, user.id);
  if (!myPerson) return { ok: false, error: 'Your profile isn’t ready yet.' };

  const { data: row } = await supabase
    .from('person_connections')
    .select('to_person_id, status')
    .eq('connection_id', connectionId)
    .eq('from_person_id', myPerson)
    .is('deleted_at', null)
    .maybeSingle();
  const target = row as { to_person_id: string; status: string } | null;
  if (!target || target.status !== 'pending') {
    return { ok: false, error: 'That request isn’t waiting any more.' };
  }

  const admin = createAdminClient();
  const [{ data: them }, { data: me }] = await Promise.all([
    admin.from('people').select('email').eq('person_id', target.to_person_id).maybeSingle(),
    admin.from('people').select('display_name').eq('person_id', myPerson).maybeSingle(),
  ]);
  const email = normalizeEmail((them as { email: string | null } | null)?.email);
  if (!email) return { ok: false, error: 'We don’t have an email for them.' };

  const delivered = await sendPeopleInvitation(
    email,
    firstNameOf((me as { display_name: string | null } | null)?.display_name),
  );
  return { ok: true, delivered };
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
