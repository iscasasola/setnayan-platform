import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { CoupleCarry } from '@/lib/onboarding/couple-handoff';
import { carriedName } from '@/lib/onboarding/couple-handoff';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * plan-together.server.ts — who "Plan an event together" is with.
 *
 * Owner, 2026-09-29: *"add partner (to become a couple)"*. When both have
 * confirmed, People offers ONE next step, which opens `/dashboard/create-event
 * ?with=<connection id>`. This decides whether that id means anything:
 *
 *   · the connection must be one THIS account is on (read under the user's own
 *     session — RLS shows each person only their own rows),
 *   · CONFIRMED, not removed, and its agreed label PARTNER.
 *
 * Anything else answers NULL and the page is the ordinary create step. Only
 * two first names leave: the partner's through `visible_connection_names`
 * (the one function allowed to resolve a name), and the viewer's own. Nothing
 * is written.
 */
export async function readPlanTogether(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
): Promise<CoupleCarry | null> {
  if (!UUID_RE.test(connectionId)) return null;

  const { data: me, error: meError } = await supabase
    .from('people')
    .select('person_id, display_name')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (meError) logQueryError('readPlanTogether.me', meError, {}, 'graceful_degrade');
  const mine = me as { person_id: string; display_name: string | null } | null;
  if (!mine) return null;

  const { data: row, error: rowError } = await supabase
    .from('person_connections')
    .select('from_person_id, to_person_id, relation, status')
    .eq('connection_id', connectionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (rowError) logQueryError('readPlanTogether.row', rowError, {}, 'graceful_degrade');
  const edge = row as {
    from_person_id: string;
    to_person_id: string;
    relation: string | null;
    status: string;
  } | null;
  if (!edge || edge.status !== 'confirmed' || edge.relation !== 'partner') return null;
  if (edge.from_person_id !== mine.person_id && edge.to_person_id !== mine.person_id) return null;
  const other = edge.from_person_id === mine.person_id ? edge.to_person_id : edge.from_person_id;

  const { data: names, error: namesError } = await supabase.rpc('visible_connection_names', {
    p_person_ids: [other],
  });
  if (namesError) logQueryError('readPlanTogether.names', namesError, {}, 'graceful_degrade');
  const theirs = ((names ?? []) as Array<{ person_id: string; display_name: string | null }>).find(
    (n) => n.person_id === other,
  );
  const partner = carriedName(theirs?.display_name);
  const self = carriedName(mine.display_name);
  return partner && self ? { me: self, partner } : null;
}
