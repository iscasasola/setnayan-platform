'use server';

/**
 * ITEM 7c — the writes that make the 7a primitive reachable at all.
 *
 * 🔑 WHY THIS FILE EXISTS. 7a shipped `event_clusters` + `event_cluster_members`
 * and said so plainly: "NO SCREEN, NO SERVER ACTION, NO READ PATH … every table
 * here is empty." Which means that until this file merged, no row could EVER be
 * created in production by anybody. A primitive with no door is indistinguishable
 * from a primitive that does not work.
 *
 * ─── 🔒 THE AUTHORIZATION IS 7a's, NOT A NEW ONE ──────────────────────────
 * Every action below is a THIN WRAPPER over the policies already in the
 * database. Nothing here re-implements, widens or bypasses them:
 *
 *   · event_clusters_owner_insert / _update / _delete → owner_user_id = auth.uid()
 *   · event_cluster_members_link → BOTH halves: you own the cluster AND you are
 *     a COUPLE member of the celebration. 7a: "EITHER HALF ALONE IS A DEFECT."
 *   · event_cluster_members_set_anchor / _unlink → you own the cluster.
 *
 * These actions use the ordinary cookie-scoped client (`createClient`), NOT
 * `createAdminClient`. A service-role client here would run as a principal
 * those policies do not constrain, which is precisely how a thin wrapper turns
 * into a new, weaker authorization pattern by accident.
 *
 * ⇒ SO "ZERO ROWS AFFECTED" IS THE GATE. A refused write under RLS is not an
 *   exception — it is a filtered statement that succeeds and changes nothing.
 *   Every action below therefore `.select()`s and checks the returned length,
 *   rather than trusting a null `error`.
 *
 * ⛔ NOTHING HERE MOVES VALUE. No points, credits, shots, money or guest counts.
 *    A cluster is a label over celebrations (7a), and 7d — budgets — is a
 *    separate phase that is deliberately not started here.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_NAME = 80;

/** Trim, collapse whitespace, and cap. Returns null when nothing is left. */
function cleanName(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  return name.length === 0 ? null : name;
}

function isUuid(v: FormDataEntryValue | null): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

function revalidateCluster(clusterId?: string): void {
  revalidatePath('/dashboard/clusters');
  if (clusterId) revalidatePath(`/dashboard/clusters/${clusterId}`);
}

/* ── create ──────────────────────────────────────────────────────────────── */

/**
 * Make a new group. Redirects into it on success, because an empty group the
 * person cannot immediately fill is a dead end.
 */
export async function createCluster(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'You need to be signed in.' };

  const displayName = cleanName(formData.get('display_name'));
  if (!displayName) return { ok: false, error: 'Give the group a name first.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_clusters')
    .insert({ owner_user_id: user.id, display_name: displayName })
    .select('event_cluster_id');

  if (error) return { ok: false, error: error.message };
  const created = (data ?? [])[0] as { event_cluster_id: string } | undefined;
  if (!created) return { ok: false, error: 'That group could not be created.' };

  revalidateCluster(created.event_cluster_id);
  redirect(`/dashboard/clusters/${created.event_cluster_id}`);
}

/* ── rename ──────────────────────────────────────────────────────────────── */

export async function renameCluster(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'You need to be signed in.' };

  const clusterId = formData.get('event_cluster_id');
  if (!isUuid(clusterId)) return { ok: false, error: 'That group could not be found.' };

  const displayName = cleanName(formData.get('display_name'));
  if (!displayName) return { ok: false, error: 'A group needs a name.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_clusters')
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq('event_cluster_id', clusterId)
    .select('event_cluster_id');

  if (error) return { ok: false, error: error.message };
  if ((data ?? []).length === 0) {
    return { ok: false, error: 'Only your own groups can be renamed.' };
  }

  revalidateCluster(clusterId);
  return { ok: true };
}

/* ── link ────────────────────────────────────────────────────────────────── */

/**
 * Put one of YOUR celebrations into one of YOUR groups.
 *
 * 🔒 Both halves of that sentence are enforced by event_cluster_members_link in
 * the database, not here. This action does not pre-check them and must not
 * start to: a check in application code that drifts from the policy produces
 * either a lie (we said yes, the row never landed) or a second, competing
 * source of truth about who may link what.
 */
export async function linkCelebration(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'You need to be signed in.' };

  const clusterId = formData.get('event_cluster_id');
  const eventId = formData.get('event_id');
  if (!isUuid(clusterId)) return { ok: false, error: 'That group could not be found.' };
  if (!isUuid(eventId)) return { ok: false, error: 'Pick a celebration to add.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_cluster_members')
    .insert({ event_cluster_id: clusterId, event_id: eventId, linked_by: user.id })
    .select('event_id');

  if (error) {
    // 7a's UNIQUE (event_id): at most one cluster per celebration. Say that in
    // words rather than handing over a constraint name.
    if (error.code === '23505') {
      return { ok: false, error: 'That celebration is already in a group.' };
    }
    // A refused INSERT under RLS DOES raise (42501) — unlike a refused read.
    if (error.code === '42501') {
      return {
        ok: false,
        error: 'You can only add your own celebrations, to your own groups.',
      };
    }
    return { ok: false, error: error.message };
  }
  if ((data ?? []).length === 0) {
    return { ok: false, error: 'That celebration could not be added.' };
  }

  revalidateCluster(clusterId);
  return { ok: true };
}

/* ── anchor ──────────────────────────────────────────────────────────────── */

/**
 * Choose which celebration the others are shown beside — usually the wedding.
 *
 * 🪤 THE PARTIAL UNIQUE INDEX MAKES THIS TWO STATEMENTS, NOT ONE.
 * `event_cluster_members_one_anchor_idx` permits at most one anchored row per
 * cluster, so setting a new anchor while the old one still stands raises a
 * unique violation. Clear first, then set.
 *
 * Passing no event_id clears the anchor entirely, which is a legal, ordinary
 * state — 7a: "Zero anchors is legal and normal — a group of friends' year has
 * no wedding at its centre."
 */
export async function setClusterAnchor(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'You need to be signed in.' };

  const clusterId = formData.get('event_cluster_id');
  if (!isUuid(clusterId)) return { ok: false, error: 'That group could not be found.' };

  const rawEventId = formData.get('event_id');
  const eventId = isUuid(rawEventId) ? rawEventId : null;

  const supabase = await createClient();

  const { data: cleared, error: clearErr } = await supabase
    .from('event_cluster_members')
    .update({ is_anchor: false })
    .eq('event_cluster_id', clusterId)
    .eq('is_anchor', true)
    .select('event_id');

  if (clearErr) return { ok: false, error: clearErr.message };

  if (!eventId) {
    // Clearing was the whole request. Nothing to clear is not a failure.
    revalidateCluster(clusterId);
    return { ok: true };
  }

  const { data, error } = await supabase
    .from('event_cluster_members')
    .update({ is_anchor: true })
    .eq('event_cluster_id', clusterId)
    .eq('event_id', eventId)
    .select('event_id');

  if (error) return { ok: false, error: error.message };
  if ((data ?? []).length === 0) {
    // The clear above may have succeeded; if this row was not ours, say so
    // rather than reporting a silent success over a half-applied change.
    return {
      ok: false,
      error:
        (cleared ?? []).length > 0
          ? 'That celebration is not in this group — the previous anchor was cleared.'
          : 'Only your own groups can be changed.',
    };
  }

  revalidateCluster(clusterId);
  return { ok: true };
}

/* ── unlink ──────────────────────────────────────────────────────────────── */

/**
 * Take a celebration back out of the group.
 *
 * ⚠ THIS DELETES A LABEL, NOT A CELEBRATION. The event, its guests, its pot and
 * its money are untouched — the row removed here carries none of them (7a: a
 * cluster "holds no points, credits, shots, money or guest count"). The copy on
 * the screen has to say that, or a person will read "Remove" as "delete my
 * wedding".
 */
export async function unlinkCelebration(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'You need to be signed in.' };

  const clusterId = formData.get('event_cluster_id');
  const eventId = formData.get('event_id');
  if (!isUuid(clusterId)) return { ok: false, error: 'That group could not be found.' };
  if (!isUuid(eventId)) return { ok: false, error: 'Pick a celebration to remove.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_cluster_members')
    .delete()
    .eq('event_cluster_id', clusterId)
    .eq('event_id', eventId)
    .select('event_id');

  if (error) return { ok: false, error: error.message };
  if ((data ?? []).length === 0) {
    return { ok: false, error: 'Only your own groups can be changed.' };
  }

  revalidateCluster(clusterId);
  return { ok: true };
}
