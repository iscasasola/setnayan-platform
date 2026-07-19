'use server';

/**
 * Life Story · server actions (PR-3).
 *
 * markPersonInMemoriam — the ✦ opt-in. Ethics contract (Build Plan §0/§5 +
 * strategy §6): the flag is only ever set BY the user, on people THEY added
 * to their events (created_by_user_id) — never themselves (alive-framing:
 * you don't memorialize the account holder), never inferred, fully
 * reversible. RLS on `people` plus the explicit .eq filter is the ownership
 * gate; zero rows updated ⇒ not yours to mark.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { captureEvent } from '@/lib/analytics';

type ActionResult = { ok: true } | { ok: false; error: string };

export async function markPersonInMemoriam(
  personId: string,
  remembered: boolean,
): Promise<ActionResult> {
  if (!lifeStoryEnabled()) return { ok: false, error: 'Life Story is not enabled.' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'You need to be signed in.' };

  const supabase = await createClient();

  // Alive-framing (Build Plan §0/§5): the account holder can NEVER mark their
  // OWN person node. The self-claim trigger sets created_by_user_id = self on
  // that node, so the created_by ownership gate alone would accept it — the UI
  // hides the toggle, but the action must refuse it too (defense in depth).
  const { data: selfRows } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', user.id);
  if ((selfRows ?? []).some((r) => (r as { person_id: string }).person_id === personId)) {
    return { ok: false, error: 'You can’t mark yourself.' };
  }

  const { data, error } = await supabase
    .from('people')
    .update({ in_memoriam: remembered })
    .eq('person_id', personId)
    .eq('created_by_user_id', user.id)
    .is('deleted_at', null)
    .select('person_id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Only people you added to your events can be marked.' };
  }

  // ✦ adoption (strategy §9). NO PII — the boolean only; no person id/name.
  await captureEvent({
    distinctId: user.id,
    event: 'life_flash_person_remembered',
    properties: { remembered },
  });

  revalidatePath('/dashboard/life-flash');
  return { ok: true };
}
