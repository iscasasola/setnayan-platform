'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { renderBrandedEmail } from '@/lib/email-template';
import { emitNotification } from '@/lib/notification-emit';
import {
  CONNECTION_RELATIONS,
  layerForRelation,
  peopleConnectionsEnabled,
  type ConnectionRelation,
  DECLARABLE_RELATIONS,
} from '@/lib/people-connections';
import {
  isOnePartnerRefusal,
  labelRequestLine,
  partnerHolding,
  replacePartnerQuestion,
  type PartnerRuleRow,
} from '@/lib/people-label-handshake';
import { getSpouseContext } from '@/lib/people-spouse-context';
import { searchPeopleByName, type PersonHit } from '@/lib/people-search';
import {
  RELATION_LABEL,
  connectionRequestSentence,
  firstNameOf,
  normalizeEmail,
  spouseIsOfferable,
} from '@/lib/people-add';
import { followUser, unfollowUser } from '@/app/u/_actions/audience-actions';
import { celebrantAccountsFor } from '@/lib/event-celebrants.server';

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
  /** The label, and it is OPTIONAL now — owner 2026-08-21: "just add them first.
   *  Then you can set a label." NULL lands them on the roster unlabelled. */
  relation?: ConnectionRelation | null;
  name: string;
  email: string;
}): Promise<{ ok: true; delivered: boolean } | { ok: false; error: string }> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const relation = input.relation ?? null;
  if (relation !== null && !DECLARABLE_RELATIONS.includes(relation)) {
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
  if (relation === 'spouse') {
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
  const myDisplayName = ((me.data as { display_name: string | null } | null)?.display_name ?? '').trim();
  const myFirstName = firstNameOf(myDisplayName);

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

  // ONE ROW PER PERSON. The roster shows a person once, so a second add of the
  // same person is not a second row — it re-sends the note. Checked here rather
  // than left to a unique violation, because the edge index is per RELATION and
  // "Maria unlabelled" plus "Maria, sister" are two different keys.
  const { data: already } = await supabase
    .from('person_connections')
    .select('connection_id')
    .eq('from_person_id', fromPerson)
    .eq('to_person_id', toPerson)
    .is('deleted_at', null)
    .limit(1);
  const alreadyThere = ((already ?? []) as Array<{ connection_id: string }>).length > 0;

  if (!alreadyThere) {
    const { error } = await supabase.from('person_connections').insert({
      from_person_id: fromPerson,
      to_person_id: toPerson,
      relation,
      layer: relation ? layerForRelation(relation) : null,
      declared_name: name,
      status: 'pending',
      created_by_user_id: user.id,
    });
    if (error && error.code !== '23505') {
      return { ok: false, error: 'Couldn’t send the request.' };
    }
  }

  // THE TRAY IS WHERE THEY MEET IT. Home counts only CONFIRMED connections, so
  // before this a request lived on /dashboard/people and nowhere else — findable
  // only by somebody who already knew to look. The email reaches their inbox;
  // this reaches them the next time they open Setnayan.
  //
  // Non-fatal by construction: `emitNotification` swallows its own failures, and
  // the claim is already stored either way.
  const theirUserId = (existing as { claimed_by_user_id: string | null } | null)?.claimed_by_user_id;
  if (theirUserId) {
    await emitNotification({
      userId: theirUserId,
      type: 'connection_request',
      // The owner's sentence (2026-09-28) — the same one their People row says.
      title: connectionRequestSentence(myDisplayName || 'Someone', null),
      body: 'Open your people to accept or decline. Nothing connects until you say so.',
      relatedUrl: '/dashboard/people',
    });
  }

  const delivered = await sendPeopleInvitation(email, myFirstName);
  revalidatePath('/dashboard/people');
  return { ok: true, delivered };
}

/**
 * What a label action can answer. `replacePartner` is not an error — it is the
 * question "one partner at a time" asks (owner 2026-09-29: a second pick asks
 * to replace, in plain words). The screen shows `question` and, on yes, calls
 * again with `replacePartner: true`.
 */
export type LabelResult =
  | { ok: true; asked: boolean }
  | { ok: false; error: string }
  | { ok: false; replacePartner: { question: string } };

type PartnerRow = PartnerRuleRow & { declared_name: string | null };

/** Every live row I am on — the input the one-partner rule reads. */
async function myRowsForPartnerRule(
  supabase: SupabaseServer,
  myPerson: string,
): Promise<PartnerRow[] | null> {
  const { data, error } = await supabase
    .from('person_connections')
    .select(
      'connection_id, from_person_id, to_person_id, relation, status, proposed_relation, proposed_status, declared_name',
    )
    .or(`from_person_id.eq.${myPerson},to_person_id.eq.${myPerson}`)
    .is('deleted_at', null);
  if (error) return null;
  return (data ?? []) as PartnerRow[];
}

/** The name I may see for somebody — the one rule's answer, else what I typed. */
async function nameICanSee(
  supabase: SupabaseServer,
  personId: string,
  fallback: string | null,
): Promise<string> {
  const { data } = await supabase.rpc('visible_connection_names', { p_person_ids: [personId] });
  const hit = ((data ?? []) as Array<{ person_id: string; display_name: string | null }>).find(
    (r) => r.person_id === personId,
  );
  return (hit?.display_name ?? '').trim() || (fallback ?? '').trim() || 'them';
}

/**
 * END the partner I hold on another row, because I said yes to replacing it.
 * Only ever REMOVES: an ask I sent is taken back, an agreed partner label is
 * taken off (either side may, on a confirmed connection), an unanswered
 * partner request I sent loses its label. The connection itself stays.
 */
async function endMyPartner(
  supabase: SupabaseServer,
  myPerson: string,
  row: PartnerRow,
): Promise<boolean> {
  const mine = row.from_person_id === myPerson;
  const patch: Record<string, unknown> = {};
  if (mine && row.proposed_relation === 'partner' && row.proposed_status === 'pending') {
    Object.assign(patch, {
      proposed_relation: null,
      proposed_status: null,
      proposed_at: null,
      proposal_answered_at: null,
    });
  }
  if (row.relation === 'partner') Object.assign(patch, { relation: null, layer: null });
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase
    .from('person_connections')
    .update(patch)
    .eq('connection_id', row.connection_id)
    .is('deleted_at', null);
  return !error;
}

/**
 * The one-partner rule, asked BEFORE the write so the answer can be a question
 * rather than a refusal. `null` = go ahead (and, when `replace` is set, the old
 * partner has been ended). The database's trigger is the actual control.
 */
async function checkOnePartner(input: {
  supabase: SupabaseServer;
  myPerson: string;
  exceptConnectionId: string;
  nextName: string;
  replace: boolean;
}): Promise<LabelResult | null> {
  const rows = await myRowsForPartnerRule(input.supabase, input.myPerson);
  if (!rows) return { ok: false, error: 'Couldn’t check your partner just now — try again.' };
  const held = partnerHolding(rows, input.myPerson, input.exceptConnectionId);
  if (!held) return null;
  const row = rows.find((r) => r.connection_id === held.connectionId)!;
  if (!input.replace) {
    const current = await nameICanSee(
      input.supabase,
      held.otherPersonId,
      row.from_person_id === input.myPerson ? row.declared_name : null,
    );
    return {
      ok: false,
      replacePartner: {
        question: replacePartnerQuestion({ name: current, kind: held.kind }, input.nextName),
      },
    };
  }
  const ended = await endMyPartner(input.supabase, input.myPerson, row);
  return ended ? null : { ok: false, error: 'Couldn’t change your partner just now — try again.' };
}

/** A database refusal, in words a person can act on — never the raw message. */
function labelWriteError(error: { code?: string; message?: string }): string {
  if (isOnePartnerRefusal(error.message)) {
    return 'One partner at a time — they may have just named someone else. Refresh and try again.';
  }
  return error.code === '23505' ? 'You’ve already used that label for them.' : 'Couldn’t save that label.';
}

/**
 * SET (or CLEAR) THE LABEL on somebody on your list — and, on a connection you
 * both already accepted, ASK for it.
 *
 * Owner, 2026-08-21: *"just add them first. Then you can set a label."* And
 * 2026-09-29: *"assigning a label needs a handshake."* So:
 *   · on a request still waiting, the label rides that request — they see it
 *     when they decide, and accepting the request accepts the label;
 *   · on a connection they already accepted, the label is ASKED
 *     (`proposed_relation`). It says "Waiting for <name> to confirm", derives
 *     no kin, and lands in their Requests and on their bell. No email.
 *   · clearing is never asked: taking a label back only ever removes.
 *
 * ⚖ ONLY THE DECLARER LABELS. `relation` means "what to_person IS to
 * from_person", so the ask is the declarer's statement about their own life;
 * the other side answers it. The `from_person_id = my person` filter holds
 * that line here, and the transition guard holds it in the database.
 *
 * 🔒 The spouse rule applies here too, and so does one partner at a time.
 */
export async function setConnectionLabel(
  connectionId: string,
  relation: ConnectionRelation | null,
  opts: { replacePartner?: boolean } = {},
): Promise<LabelResult> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  if (relation !== null && !DECLARABLE_RELATIONS.includes(relation)) {
    return { ok: false, error: 'That isn’t a label.' };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  if (relation === 'spouse') {
    const ctx = await getSpouseContext(user.id);
    if (!spouseIsOfferable(ctx)) {
      return {
        ok: false,
        error:
          'Set “Married” on your profile — or hold until your wedding day has passed — before naming a spouse.',
      };
    }
  }

  const supabase = await createClient();
  const myPerson = await myPersonId(supabase, user.id);
  if (!myPerson) return { ok: false, error: 'Your profile isn’t ready yet.' };

  const { data: rowData } = await supabase
    .from('person_connections')
    .select('to_person_id, status, relation, proposed_relation, proposed_status, declared_name')
    .eq('connection_id', connectionId)
    .eq('from_person_id', myPerson)
    .is('deleted_at', null)
    .maybeSingle();
  const row = rowData as {
    to_person_id: string;
    status: string;
    relation: string | null;
    proposed_relation: string | null;
    proposed_status: string | null;
    declared_name: string | null;
  } | null;
  if (!row) return { ok: false, error: 'That person isn’t on your list any more.' };
  const connected = row.status === 'confirmed';

  // ── CLEAR — never asked; only ever removes ────────────────────────────────
  if (relation === null) {
    const { error } = await supabase
      .from('person_connections')
      .update({
        relation: null,
        layer: null,
        ...(connected
          ? { proposed_relation: null, proposed_status: null, proposed_at: null, proposal_answered_at: null }
          : {}),
      })
      .eq('connection_id', connectionId)
      .eq('from_person_id', myPerson)
      .is('deleted_at', null);
    if (error) return { ok: false, error: 'Couldn’t remove that label.' };
    revalidatePath('/dashboard/people');
    return { ok: true, asked: false };
  }

  // Already what we both stand behind, or already asked and waiting: nothing to do.
  if (connected && row.relation === relation && !row.proposed_relation) {
    return { ok: true, asked: false };
  }
  if (connected && row.proposed_relation === relation && row.proposed_status === 'pending') {
    return { ok: true, asked: true };
  }

  const theirName = await nameICanSee(supabase, row.to_person_id, row.declared_name);

  if (relation === 'partner') {
    const stop = await checkOnePartner({
      supabase,
      myPerson,
      exceptConnectionId: connectionId,
      nextName: theirName,
      replace: opts.replacePartner === true,
    });
    if (stop) return stop;
  }

  // ── A REQUEST STILL WAITING — the label rides it ──────────────────────────
  if (!connected) {
    const { error } = await supabase
      .from('person_connections')
      .update({ relation, layer: layerForRelation(relation) })
      .eq('connection_id', connectionId)
      .eq('from_person_id', myPerson)
      .is('deleted_at', null);
    if (error) return { ok: false, error: labelWriteError(error) };
    revalidatePath('/dashboard/people');
    return { ok: true, asked: false };
  }

  // ── A CONNECTION WE BOTH ACCEPTED — ASK ───────────────────────────────────
  // The old word comes off as the new one is asked: "you changed it" should
  // not leave the tree reading the old fact while the new one waits. Declined,
  // the result is no label — the owner's "removed quietly".
  const { error } = await supabase
    .from('person_connections')
    .update({
      relation: null,
      layer: null,
      proposed_relation: relation,
      proposed_status: 'pending',
      proposed_at: new Date().toISOString(),
      proposal_answered_at: null,
    })
    .eq('connection_id', connectionId)
    .eq('from_person_id', myPerson)
    .eq('status', 'confirmed')
    .is('deleted_at', null);
  if (error) return { ok: false, error: labelWriteError(error) };

  // THE BELL — the same `connection_request` notice a request to connect uses,
  // pointed at the same Requests view. No email (owner 2026-09-29).
  const admin = createAdminClient();
  const [{ data: them }, { data: me }] = await Promise.all([
    admin.from('people').select('claimed_by_user_id').eq('person_id', row.to_person_id).maybeSingle(),
    admin.from('people').select('display_name').eq('person_id', myPerson).maybeSingle(),
  ]);
  const theirUserId = (them as { claimed_by_user_id: string | null } | null)?.claimed_by_user_id;
  if (theirUserId) {
    await emitNotification({
      userId: theirUserId,
      type: 'connection_request',
      title: labelRequestLine(
        (me as { display_name: string | null } | null)?.display_name ?? 'Someone',
        relation,
      ),
      body: 'Open your requests to confirm. Nothing changes until you say so.',
      relatedUrl: '/dashboard/people?view=requests',
    });
  }

  revalidatePath('/dashboard/people');
  return { ok: true, asked: true };
}

/**
 * CONFIRM a label somebody asked of me. The person it is ABOUT is the only one
 * who can, and only while it waits — `to_person_id = me` and
 * `proposed_status = 'pending'` here, the transition guard in the database.
 * One partner at a time applies: saying yes to a partner while holding one
 * asks to replace, in the same plain words.
 */
export async function confirmLabel(
  connectionId: string,
  opts: { replacePartner?: boolean } = {},
): Promise<LabelResult> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const myPerson = await myPersonId(supabase, user.id);
  if (!myPerson) return { ok: false, error: 'Your profile isn’t ready yet.' };

  const { data: rowData } = await supabase
    .from('person_connections')
    .select('from_person_id, proposed_relation, proposed_status')
    .eq('connection_id', connectionId)
    .eq('to_person_id', myPerson)
    .eq('status', 'confirmed')
    .is('deleted_at', null)
    .maybeSingle();
  const row = rowData as {
    from_person_id: string;
    proposed_relation: string | null;
    proposed_status: string | null;
  } | null;
  const asked = row?.proposed_status === 'pending' ? (row.proposed_relation as ConnectionRelation) : null;
  if (!row || !asked || !CONNECTION_RELATIONS.includes(asked)) {
    return { ok: false, error: 'That isn’t waiting on you any more.' };
  }

  if (asked === 'partner') {
    const stop = await checkOnePartner({
      supabase,
      myPerson,
      exceptConnectionId: connectionId,
      nextName: await nameICanSee(supabase, row.from_person_id, null),
      replace: opts.replacePartner === true,
    });
    if (stop) return stop;
  }

  const { data, error } = await supabase
    .from('person_connections')
    .update({
      relation: asked,
      layer: layerForRelation(asked),
      proposed_relation: null,
      proposed_status: null,
      proposed_at: null,
      proposal_answered_at: null,
    })
    .eq('connection_id', connectionId)
    .eq('to_person_id', myPerson)
    .eq('proposed_status', 'pending')
    .select('from_person_id');
  if (error) return { ok: false, error: labelWriteError(error) };

  // The answer travels back, on the same notice a confirmed connection uses.
  if (((data ?? []) as unknown[]).length > 0) {
    const admin = createAdminClient();
    const [{ data: asker }, { data: me }] = await Promise.all([
      admin.from('people').select('claimed_by_user_id').eq('person_id', row.from_person_id).maybeSingle(),
      admin.from('people').select('display_name').eq('person_id', myPerson).maybeSingle(),
    ]);
    const askerUserId = (asker as { claimed_by_user_id: string | null } | null)?.claimed_by_user_id;
    if (askerUserId) {
      const myName = firstNameOf((me as { display_name: string | null } | null)?.display_name) ?? 'They';
      await emitNotification({
        userId: askerUserId,
        type: 'connection_confirmed',
        title: `${myName} confirmed — they’re your ${RELATION_LABEL[asked]}`,
        body:
          asked === 'partner'
            ? 'You’re a couple on Setnayan now. Plan an event together whenever you’re ready.'
            : 'It’s on your people now.',
        relatedUrl: '/dashboard/people',
      });
    }
  }

  revalidatePath('/dashboard/people');
  return { ok: true, asked: false };
}

/**
 * DECLINE a label somebody asked of me. Quiet on purpose (owner 2026-09-29):
 * no notice goes back; the asker's own row says "<name> didn't confirm", and
 * the connection underneath stays exactly as it was.
 */
export async function declineLabel(connectionId: string): Promise<ActionResult> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const myPerson = await myPersonId(supabase, user.id);
  if (!myPerson) return { ok: false, error: 'Your profile isn’t ready yet.' };

  const { error } = await supabase
    .from('person_connections')
    .update({ proposed_status: 'declined', proposal_answered_at: new Date().toISOString() })
    .eq('connection_id', connectionId)
    .eq('to_person_id', myPerson)
    .eq('proposed_status', 'pending');
  if (error) return { ok: false, error: 'Couldn’t decline.' };
  revalidatePath('/dashboard/people');
  return { ok: true };
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
export async function confirmConnection(
  connectionId: string,
  opts: { replacePartner?: boolean } = {},
): Promise<ActionResult | { ok: false; replacePartner: { question: string } }> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const myPerson = await myPersonId(supabase, user.id);
  if (!myPerson) return { ok: false, error: 'Your profile isn’t ready yet.' };

  // A REQUEST THAT CARRIES "PARTNER" — accepting it accepts the label, so one
  // partner at a time asks to replace here too, in the same plain words.
  const { data: carried } = await supabase
    .from('person_connections')
    .select('from_person_id, relation')
    .eq('connection_id', connectionId)
    .eq('to_person_id', myPerson)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .maybeSingle();
  const carriedRow = carried as { from_person_id: string; relation: string | null } | null;
  if (carriedRow?.relation === 'partner') {
    const stop = await checkOnePartner({
      supabase,
      myPerson,
      exceptConnectionId: connectionId,
      nextName: await nameICanSee(supabase, carriedRow.from_person_id, null),
      replace: opts.replacePartner === true,
    });
    if (stop) return stop.ok ? { ok: true } : stop;
  }

  // Only the recipient may confirm: to_person = me AND still pending.
  // `.select()` so the answer can be carried back to whoever asked — an UPDATE
  // that matched nothing returns an empty array, which is how a stale click on
  // an already-answered row is told apart from a real confirmation. RLS denial
  // and "no such pending row" are the same value here, and both mean: say
  // nothing to anybody.
  const { data, error } = await supabase
    .from('person_connections')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('connection_id', connectionId)
    .eq('to_person_id', myPerson)
    .eq('status', 'pending')
    .select('from_person_id');
  if (error) {
    return {
      ok: false,
      error: isOnePartnerRefusal(error.message)
        ? 'One partner at a time — refresh and try again.'
        : 'Couldn’t confirm.',
    };
  }
  const rows = (data ?? []) as Array<{ from_person_id: string }>;

  // THE ANSWER TRAVELS BACK. Without this the person who asked learns nothing —
  // their row just quietly changes state the next time they load the page.
  if (rows.length > 0) {
    const admin = createAdminClient();
    const [{ data: asker }, { data: me }] = await Promise.all([
      admin
        .from('people')
        .select('claimed_by_user_id')
        .eq('person_id', rows[0]!.from_person_id)
        .maybeSingle(),
      admin.from('people').select('display_name').eq('person_id', myPerson).maybeSingle(),
    ]);
    const askerUserId = (asker as { claimed_by_user_id: string | null } | null)?.claimed_by_user_id;
    if (askerUserId) {
      const myName =
        firstNameOf((me as { display_name: string | null } | null)?.display_name) ?? 'They';
      await emitNotification({
        userId: askerUserId,
        type: 'connection_confirmed',
        title: `${myName} confirmed your connection`,
        body: 'They’re on your people now — set what they are to you whenever you like.',
        relatedUrl: '/dashboard/people',
      });
    }
  }

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
      .neq('role_subtype', 'viewer') // a limited helper views, never edits (owner 2026-09-28)
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
  if (!peopleConnectionsEnabled()) redirect('/dashboard/people?view=samahan');
  const memberRowId = Number(formData.get('member_row_id'));
  if (!Number.isInteger(memberRowId) || memberRowId <= 0) redirect('/dashboard/people?view=samahan');

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
  if (!targetUserId || targetUserId === user.id) redirect('/dashboard/people?view=samahan');

  const fromPerson = await myPersonId(supabase, user.id);
  if (!fromPerson) redirect('/dashboard/people?view=samahan&error=profile_not_ready');

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
    if (!email) redirect('/dashboard/people?view=samahan&error=connect_failed');
    const { data: resolved } = await supabase.rpc('resolve_or_claim_person', {
      p_email: email,
      p_creator: user.id,
    });
    toPerson = (resolved as string | null) ?? null;
  }
  if (!toPerson || toPerson === fromPerson) redirect('/dashboard/people?view=samahan&error=connect_failed');

  const { error } = await supabase.from('person_connections').insert({
    from_person_id: fromPerson,
    to_person_id: toPerson,
    relation: 'friend',
    layer: layerForRelation('friend'),
    status: 'pending',
    created_by_user_id: user.id,
  });
  if (error && error.code !== '23505') redirect('/dashboard/people?view=samahan&error=connect_failed');

  revalidatePath('/dashboard/people');
  redirect('/dashboard/people?view=samahan&saved=1');
}

/**
 * ASK somebody on your list into a samahan — the second half of the owner's
 * sentence: *"Then you can set a label. or a samahan, just like the guest list."*
 *
 * ⚖ **IT SENDS AN INVITATION; IT DOES NOT ADD THEM, AND THAT IS NOT MY RULE.**
 * `community_members` has exactly one INSERT policy — `community_member_admin_insert`,
 * `WITH CHECK (is_admin())` — so through the API nobody but a Setnayan admin can
 * put a person in a samahan. The only other way in is redeeming the standing
 * link. The product's consent model is therefore already decided: **you are
 * asked into a samahan, never placed in one.** A chip that silently inserted a
 * membership would have had to route around that policy with the service key,
 * which is the shape of every "the app layer is not the control" defect this
 * codebase has already paid for.
 *
 * So the INTERACTION matches the guest list (a chip on the row, one tap) and the
 * MECHANISM matches samahan's own: their invitation lands in their inbox, and
 * the chip appears on the roster when they actually join.
 *
 * Organiser-only, because `invite_tokens_organizer_all` is organiser-only: the
 * token read below runs under the caller's own session, so RLS is the gate and a
 * refusal reads as "no live link", never as a leak.
 */
export async function invitePersonToSamahan(input: {
  connectionId: string;
  communityId: string;
}): Promise<{ ok: true; delivered: boolean; samahan: string } | { ok: false; error: string }> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  if (!input.connectionId || !input.communityId) return { ok: false, error: 'Pick a group.' };

  const supabase = await createClient();
  const myPerson = await myPersonId(supabase, user.id);
  if (!myPerson) return { ok: false, error: 'Your profile isn’t ready yet.' };

  // CONFIRMED only. Asking somebody into your group before they have agreed to
  // be connected to you at all is a second ask stacked on an unanswered one.
  const { data: edge } = await supabase
    .from('person_connections')
    .select('from_person_id, to_person_id, status')
    .eq('connection_id', input.connectionId)
    .is('deleted_at', null)
    .maybeSingle();
  const row = edge as { from_person_id: string; to_person_id: string; status: string } | null;
  if (!row || row.status !== 'confirmed') {
    return { ok: false, error: 'You can invite them once you’re connected.' };
  }
  const otherPerson = row.from_person_id === myPerson ? row.to_person_id : row.from_person_id;
  if (otherPerson === myPerson) return { ok: false, error: 'That’s you.' };

  // The standing link, read under MY session — organiser-only by policy.
  const { data: tokenRow } = await supabase
    .from('community_invite_tokens')
    .select('token, expires_at, revoked_at')
    .eq('community_id', input.communityId)
    .maybeSingle();
  const live = tokenRow as { token: string; expires_at: string | null; revoked_at: string | null } | null;
  const usable =
    !!live &&
    !live.revoked_at &&
    (!live.expires_at || new Date(live.expires_at) > new Date());
  if (!usable) {
    return {
      ok: false,
      error: 'That group has no live invite link — open it and make one first.',
    };
  }

  const { data: community } = await supabase
    .from('communities')
    .select('name')
    .eq('community_id', input.communityId)
    .maybeSingle();
  const samahanName = ((community as { name: string } | null)?.name ?? 'your group').trim();

  // Their address + whether they are already in it. Server-side only; neither
  // value is returned to the caller.
  const admin = createAdminClient();
  const [{ data: them }, { data: me }] = await Promise.all([
    admin.from('people').select('email, claimed_by_user_id').eq('person_id', otherPerson).maybeSingle(),
    admin.from('people').select('display_name').eq('person_id', myPerson).maybeSingle(),
  ]);
  const themRow = them as { email: string | null; claimed_by_user_id: string | null } | null;
  const email = normalizeEmail(themRow?.email);
  if (!email) return { ok: false, error: 'We don’t have an email for them.' };

  if (themRow?.claimed_by_user_id) {
    const { data: member } = await admin
      .from('community_members')
      .select('id')
      .eq('community_id', input.communityId)
      .eq('user_id', themRow.claimed_by_user_id)
      .maybeSingle();
    if (member) return { ok: false, error: 'They’re already in it.' };
  }

  const origin = await appOrigin();
  const url = `${origin}/samahan/join/${live!.token}`;
  const who = firstNameOf((me as { display_name: string | null } | null)?.display_name) ?? 'Someone you know';
  const lines = [
    `${who} would like you in ${samahanName} on Setnayan — the group they keep their celebrations with.`,
    'Opening the link puts you in; nothing happens until you do.',
  ];
  const delivered = await sendEmail({
    to: email,
    subject: `${who} invited you to ${samahanName}`,
    text: `${lines.join('\n\n')}\n\nJoin ${samahanName}: ${url}`,
    html: renderBrandedEmail({
      heading: `You're invited to ${samahanName}`,
      paragraphs: lines,
      ctaLabel: `Join ${samahanName}`,
      ctaHref: url,
      footnote:
        'If you weren’t expecting this, you can ignore this email — you are not in the group unless you open the link.',
    }),
  });

  revalidatePath('/dashboard/people');
  return { ok: true, delivered: delivered.ok, samahan: samahanName };
}

/**
 * FIND SOMEBODY BY NAME (owner 2026-08-21, *"just like facebook"*).
 *
 * A thin, guarded wrapper: the flag, the signed-in caller, and nothing else —
 * every refusal and every "what a result may carry" rule lives in
 * `lib/people-search.ts`, which is where a reader will look for them.
 *
 * 🔒 It cannot be used to test whether an account exists: an opted-out person,
 * a name nobody has, and a name only anonymous drafts carry all return `[]`.
 */
export async function findPeopleByName(query: string): Promise<PersonHit[]> {
  if (!peopleConnectionsEnabled()) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  return searchPeopleByName(query, user.id);
}

/**
 * ADD SOMEBODY YOU PICKED OUT OF THE SEARCH — the owner's *"pick the person they
 * want to add"*, and the reason this exists separately from
 * `addPersonConnection`: there is no email to type, because we already know
 * exactly which account it is.
 *
 * ⚠ THE HANDLE IS A PUBLIC ID, NEVER A user_id. The browser is given
 * `users.public_id` and hands it straight back; a raw `user_id` in a client
 * payload is an internal key travelling through an untrusted place for no gain.
 *
 * Everything else is the ordinary add: a PENDING claim, unlabelled unless the
 * caller says otherwise, their tray gets the ask, and their inbox gets the same
 * invitation. Only they can confirm it.
 */
export async function addPersonByPublicId(input: {
  publicId: string;
  relation?: ConnectionRelation | null;
}): Promise<ActionResult> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const publicId = (input.publicId ?? '').trim();
  if (!publicId) return { ok: false, error: 'Pick somebody first.' };
  const relation = input.relation ?? null;
  if (relation !== null && !DECLARABLE_RELATIONS.includes(relation)) {
    return { ok: false, error: 'That isn’t a label.' };
  }
  if (relation === 'spouse') {
    const ctx = await getSpouseContext(user.id);
    if (!spouseIsOfferable(ctx)) {
      return {
        ok: false,
        error:
          'Set “Married” on your profile — or hold until your wedding day has passed — before adding a spouse.',
      };
    }
  }

  const supabase = await createClient();
  const fromPerson = await myPersonId(supabase, user.id);
  if (!fromPerson) return { ok: false, error: 'Your profile isn’t ready yet — try again in a moment.' };

  // Resolve the pick server-side. The discoverability switch is re-checked HERE
  // and not trusted from the search that produced the row: a public id lives as
  // long as the account does, and somebody who turned themselves off between the
  // search and the tap has turned themselves off.
  const admin = createAdminClient();
  const { data: target } = await admin
    .from('users')
    .select('user_id, display_name, email, discoverable_by_name')
    .eq('public_id', publicId)
    .maybeSingle();
  const them = target as {
    user_id: string;
    display_name: string | null;
    email: string | null;
    discoverable_by_name: boolean | null;
  } | null;
  if (!them || them.discoverable_by_name === false) {
    return { ok: false, error: 'We couldn’t find that person any more.' };
  }
  if (them.user_id === user.id) return { ok: false, error: 'That’s you.' };

  return requestConnection({
    supabase,
    userId: user.id,
    fromPerson,
    toUserId: them.user_id,
    theirName: them.display_name,
    theirEmail: them.email,
    relation,
    fromEvent: null,
  });
}

/**
 * THE ASK ITSELF — shared by the search's Add and the event's Add, so the two
 * can never drift: one PENDING claim (unlabelled unless the caller says),
 * their bell gets the owner's sentence, their inbox the invitation. Only they
 * can accept it.
 *
 * `fromEvent` stamps `created_by_event_id` — the database refuses it unless the
 * sender belongs to that event (migration 20271253740454), and the recipient's
 * row only names it when they host it.
 */
async function requestConnection(input: {
  supabase: SupabaseServer;
  userId: string;
  fromPerson: string;
  toUserId: string;
  theirName: string | null;
  theirEmail: string | null;
  relation: ConnectionRelation | null;
  fromEvent: { eventId: string; name: string; type: string } | null;
}): Promise<ActionResult> {
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
  if (email) await sendPeopleInvitation(email, myFirstName);

  revalidatePath('/dashboard/people');
  return { ok: true };
}

/**
 * ADD A CELEBRANT FROM THEIR EVENT — the guest's side (owner 2026-09-28: *"They
 * have an option to add the celebrants from the event … The host/celebrants
 * will have a request list (X person is trying to add you from your X event.
 * [Accept]/[Decline]"*).
 *
 * 🔒 EVERYTHING IS RE-DECIDED HERE, NOTHING IS TRUSTED FROM THE PAGE:
 *   · the caller's account must already be ON this event (a member row) — the
 *     list is drawn only for a guest whose seat is linked to their account;
 *   · the person must be one of THIS event's celebrants, recomputed now
 *     (`celebrantAccountsFor`), so a public id copied from anywhere else is
 *     refused rather than asked;
 *   · the handle is a public id, never a user_id.
 * Then it is the ordinary ask, carrying `created_by_event_id`.
 */
export async function addCelebrantFromEvent(input: {
  eventId: string;
  publicId: string;
}): Promise<ActionResult> {
  if (!peopleConnectionsEnabled()) return { ok: false, error: 'Connections aren’t available yet.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const eventId = (input.eventId ?? '').trim();
  const publicId = (input.publicId ?? '').trim();
  if (!eventId || !publicId) return { ok: false, error: 'Pick somebody first.' };

  const admin = createAdminClient();
  const [{ data: seat }, { data: event }, { data: target }] = await Promise.all([
    admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    admin.from('events').select('display_name, event_type').eq('event_id', eventId).maybeSingle(),
    admin
      .from('users')
      .select('user_id, display_name, email')
      .eq('public_id', publicId)
      .maybeSingle(),
  ]);
  if (!seat || !event) return { ok: false, error: 'Open your invitation from your account first.' };
  const them = target as { user_id: string; display_name: string | null; email: string | null } | null;
  if (!them) return { ok: false, error: 'We couldn’t find that person any more.' };
  if (them.user_id === user.id) return { ok: false, error: 'That’s you.' };

  const celebrants = await celebrantAccountsFor(admin, eventId);
  if (!celebrants.some((c) => c.userId === them.user_id)) {
    return { ok: false, error: 'You can add this event’s celebrants from here.' };
  }

  const supabase = await createClient();
  const fromPerson = await myPersonId(supabase, user.id);
  if (!fromPerson) return { ok: false, error: 'Your profile isn’t ready yet — try again in a moment.' };

  const ev = event as { display_name: string | null; event_type: string | null };
  return requestConnection({
    supabase,
    userId: user.id,
    fromPerson,
    toUserId: them.user_id,
    theirName: them.display_name,
    theirEmail: them.email,
    relation: null,
    fromEvent: {
      eventId,
      name: (ev.display_name ?? '').trim(),
      type: (ev.event_type ?? '').replace(/_/g, ' '),
    },
  });
}

/**
 * FOLLOW / UNFOLLOW SOMEBODY BY THEIR PUBLIC HANDLE — Follow in the name
 * search, Follow back on Followers, Unfollow on Following, and Follow beside a
 * celebrant on their event (owner 2026-09-28).
 *
 * ⚠ A PUBLIC ID, NEVER A user_id. The browser holds `users.public_id`; the
 * account is resolved here. The write itself is the shipped `followUser` /
 * `unfollowUser` — RLS confines it to the caller's own rows, a follow is only
 * accepted toward a public profile, and an unfollow leaves the `user_unfollows`
 * tombstone (PR #6077) so an automatic follow never re-follows them.
 *
 * Unfollowing a CONNECTED person is allowed and leaves them connected (owner
 * 2026-09-28: the Facebook model).
 */
export async function setFollowByPublicId(input: {
  publicId: string;
  follow: boolean;
}): Promise<{ ok: true; following: boolean } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const publicId = (input.publicId ?? '').trim();
  if (!publicId) return { ok: false, error: 'Pick somebody first.' };

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from('users')
    .select('user_id')
    .eq('public_id', publicId)
    .maybeSingle();
  if (targetError) return { ok: false, error: 'Couldn’t reach them just now — try again.' };
  const theirId = (target as { user_id: string } | null)?.user_id;
  if (!theirId) return { ok: false, error: 'We couldn’t find that person any more.' };
  if (theirId === user.id) return { ok: false, error: 'That’s you.' };

  const res = input.follow ? await followUser(theirId) : await unfollowUser(theirId);
  if (!res.ok) {
    return {
      ok: false,
      error: input.follow
        ? 'Their profile isn’t public, so they can’t be followed.'
        : 'Couldn’t unfollow just now — try again.',
    };
  }
  revalidatePath('/dashboard/people');
  return { ok: true, following: res.following };
}
