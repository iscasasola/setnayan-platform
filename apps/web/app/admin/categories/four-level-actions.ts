'use server';

/**
 * four-level-actions.ts — the in-place doors of the four-level Categories page (🌳 ③b; corpus
 * prototypes/admin_taxonomy_four_levels_2026-10-26/interactive-v4.html). The last-row "＋ Add …" rows,
 * the part picker's ticks, drag-onto-a-parent and the Order ▾ / Move to ▾ picks fire these from a
 * `useTransition` — they cannot redirect, so each answers `{ ok, message }` / `{ ok:false, error }` and
 * the client refreshes. Every one re-checks admin (the /admin layout already 404s everyone else) and
 * calls the ONE core in `_components/taxonomy-writes.ts` that the shipped forms call too.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CATEGORIES_PATH } from './_components/back';
import {
  addCategoryCore,
  addGroupCore,
  addPartCore,
  addServiceCore,
  linkPartServicesCore,
  movePartHomeCore,
  moveServiceCore,
  renamePartCore,
  reorderGroupsCore,
  reorderPartsCore,
  reorderServicesCore,
  setCoarseCategoryCore,
  setPartHiddenCore,
  setPartServicesCore,
  type WriteResult,
} from './_components/taxonomy-writes';

async function gate(): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from('users').select('is_internal, is_team_member, account_type').eq('user_id', user.id).maybeSingle();
  return me?.is_internal || me?.is_team_member || me?.account_type === 'admin' ? { id: user.id } : null;
}

/** Run one core as the signed-in admin, then redraw every surface the taxonomy feeds. */
async function asAdmin(run: (actorId: string) => Promise<WriteResult>): Promise<WriteResult> {
  const me = await gate();
  if (!me) return { ok: false, error: 'Forbidden.' };
  const res = await run(me.id);
  if (res.ok) {
    revalidatePath(CATEGORIES_PATH);
    revalidatePath('/explore');
  }
  return res;
}

const admin = () => createAdminClient();

export async function addGroupInPlace(label: string): Promise<WriteResult> {
  return asAdmin((actor) => addGroupCore(admin(), actor, label));
}

export async function addCategoryInPlace(groupId: string, label: string): Promise<WriteResult> {
  return asAdmin((actor) => addCategoryCore(admin(), actor, groupId, label));
}

export async function addServiceInPlace(tileId: string, label: string): Promise<WriteResult> {
  return asAdmin((actor) => addServiceCore(admin(), actor, { tileId, label }));
}

export async function addPartInPlace(homeCategoryId: string, label: string, services: string[]): Promise<WriteResult> {
  return asAdmin((actor) => addPartCore(admin(), actor, { homeCategoryId, label, services }));
}

export async function linkPartServices(slotKey: string, services: string[], on: boolean): Promise<WriteResult> {
  return asAdmin((actor) => linkPartServicesCore(admin(), actor, slotKey, services, on));
}

/** FormData shape for the drawer's `ListPick` (posts the whole list under `services`). */
export async function setPartServicesForm(formData: FormData): Promise<WriteResult> {
  const slot = String(formData.get('slot_key') ?? '');
  const services = formData.getAll('services').map(String);
  return asAdmin((actor) => setPartServicesCore(admin(), actor, slot, services));
}

export async function moveServiceInPlace(canonical: string, tileId: string): Promise<WriteResult> {
  return asAdmin((actor) => moveServiceCore(admin(), actor, canonical, tileId));
}

export async function movePartHome(slotKey: string, categoryId: string): Promise<WriteResult> {
  return asAdmin((actor) => movePartHomeCore(admin(), actor, slotKey, categoryId));
}

export async function reorderGroups(orderedIds: string[]): Promise<WriteResult> {
  return asAdmin((actor) => reorderGroupsCore(admin(), actor, orderedIds));
}

export async function reorderServices(tileId: string, orderedKeys: string[]): Promise<WriteResult> {
  return asAdmin((actor) => reorderServicesCore(admin(), actor, tileId, orderedKeys));
}

export async function reorderParts(homeId: string, orderedKeys: string[]): Promise<WriteResult> {
  return asAdmin((actor) => reorderPartsCore(admin(), actor, homeId, orderedKeys));
}

/** "Files shops as ▾" — a `SavePick` posts `category_id` + `coarse_category`. */
export async function setCoarseCategoryForm(formData: FormData): Promise<WriteResult> {
  return asAdmin((actor) =>
    setCoarseCategoryCore(admin(), actor, String(formData.get('category_id') ?? ''), String(formData.get('coarse_category') ?? '')),
  );
}

export async function renamePart(slotKey: string, label: string): Promise<WriteResult> {
  return asAdmin((actor) => renamePartCore(admin(), actor, slotKey, label));
}

export async function setPartHidden(slotKey: string, hidden: boolean): Promise<WriteResult> {
  return asAdmin((actor) => setPartHiddenCore(admin(), actor, slotKey, hidden));
}
