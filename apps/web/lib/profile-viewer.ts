import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * profile-viewer.ts — who is looking at an account page, as far as that page is allowed to know.
 *
 * Owner, 2026-10-25, on People: *"why don't i see their user account page?"* · *"yes they should have an
 * account like me."* A person you already know on Setnayan — connected, asked to connect, or following
 * either way — opens that account's page from People and lands on a real profile, not a 404 and not a
 * stranger's empty state.
 *
 * ── WHAT "KNOWS THEM" MEANS ────────────────────────────────────────────────
 * Exactly the people whose NAME the viewer's own People page already shows them:
 *   • a `person_connections` row between the two of them that is `pending` or `confirmed` (the roster and
 *     Requests — Claire "waiting to confirm" included), or
 *   • a `user_follows` edge in EITHER direction (Following / Followers — `follow_people_names` answers for
 *     exactly that set).
 * So the page tells them nothing they could not already read: a name and how the two of them stand. A
 * DECLINED or deleted connection is not knowing them.
 *
 * ── FAILS CLOSED ───────────────────────────────────────────────────────────
 * Any refused read answers "does not know them", which is the old behaviour (a 404 for a switched-off
 * profile). Never the other way round.
 *
 * 🔒 Both ids are named explicitly in every query (RLS is a floor, not a scope — the owner's account is an
 * admin). Only booleans leave this file.
 */
export type ProfileViewer = {
  signedIn: boolean;
  /** The account holder themself. */
  isHolder: boolean;
  /** A confirmed connection. */
  connected: boolean;
  /** A connection asked, by either side, not answered yet. */
  pending: boolean;
  youFollow: boolean;
  followsYou: boolean;
};

const NOBODY: ProfileViewer = {
  signedIn: false,
  isHolder: false,
  connected: false,
  pending: false,
  youFollow: false,
  followsYou: false,
};

/** True when the viewer already knows this person on Setnayan (see the docblock). Never the holder. */
export function viewerKnowsThem(v: ProfileViewer | null | undefined): boolean {
  if (!v || !v.signedIn || v.isHolder) return false;
  return v.connected || v.pending || v.youFollow || v.followsYou;
}

/** The one line under the name, for a viewer who knows them. Null for anyone else. */
export function relationLine(v: ProfileViewer | null | undefined): string | null {
  if (!viewerKnowsThem(v) || !v) return null;
  if (v.connected) return 'Connected';
  if (v.pending) return 'Waiting to connect';
  if (v.youFollow && v.followsYou) return 'You follow each other';
  if (v.youFollow) return 'You follow them';
  return 'Follows you';
}

export async function readProfileViewer(targetUserId: string): Promise<ProfileViewer> {
  let me: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    me = user?.id ?? null;
  } catch {
    return NOBODY;
  }
  if (!me) return NOBODY;
  if (me === targetUserId) return { ...NOBODY, signedIn: true, isHolder: true };

  try {
    const admin = createAdminClient();
    const [follows, people] = await Promise.all([
      admin
        .from('user_follows')
        .select('follower_user_id, followed_user_id')
        .or(
          `and(follower_user_id.eq.${me},followed_user_id.eq.${targetUserId}),and(follower_user_id.eq.${targetUserId},followed_user_id.eq.${me})`,
        ),
      admin
        .from('people')
        .select('person_id, claimed_by_user_id')
        .in('claimed_by_user_id', [me, targetUserId])
        .is('deleted_at', null),
    ]);
    if (follows.error) logQueryError('readProfileViewer.follows', follows.error, {}, 'graceful_degrade');
    if (people.error) logQueryError('readProfileViewer.people', people.error, {}, 'graceful_degrade');

    const edges = (follows.error ? [] : (follows.data ?? [])) as Array<{
      follower_user_id: string;
      followed_user_id: string;
    }>;
    const youFollow = edges.some((e) => e.follower_user_id === me && e.followed_user_id === targetUserId);
    const followsYou = edges.some((e) => e.follower_user_id === targetUserId && e.followed_user_id === me);

    const rows = (people.error ? [] : (people.data ?? [])) as Array<{ person_id: string; claimed_by_user_id: string }>;
    const mine = rows.filter((r) => r.claimed_by_user_id === me).map((r) => r.person_id);
    const theirs = rows.filter((r) => r.claimed_by_user_id === targetUserId).map((r) => r.person_id);

    let connected = false;
    let pending = false;
    if (mine.length > 0 && theirs.length > 0) {
      const { data: conns, error: connError } = await admin
        .from('person_connections')
        .select('status')
        .or(
          `and(from_person_id.in.(${mine.join(',')}),to_person_id.in.(${theirs.join(',')})),and(from_person_id.in.(${theirs.join(',')}),to_person_id.in.(${mine.join(',')}))`,
        )
        .in('status', ['pending', 'confirmed'])
        .is('deleted_at', null);
      if (connError) logQueryError('readProfileViewer.connections', connError, {}, 'graceful_degrade');
      for (const c of (connError ? [] : (conns ?? [])) as Array<{ status: string }>) {
        if (c.status === 'confirmed') connected = true;
        else if (c.status === 'pending') pending = true;
      }
    }
    return { signedIn: true, isHolder: false, connected, pending: pending && !connected, youFollow, followsYou };
  } catch {
    return { ...NOBODY, signedIn: true };
  }
}
