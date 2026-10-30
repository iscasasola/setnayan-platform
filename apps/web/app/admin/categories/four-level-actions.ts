'use server';

/**
 * four-level-actions.ts — the in-place doors of the four-level Categories page (🌳 ③b; corpus
 * prototypes/admin_taxonomy_four_levels_2026-10-26/interactive-v4.html). The last-row "＋ Add …" rows,
 * the part picker's ticks, drag-onto-a-parent and the drawer's Order ▾ / Move to ▾ / Services ▾ picks fire
 * these from a `useTransition` — they cannot redirect, so each answers `{ ok, message }` /
 * `{ ok:false, error }` and the client refreshes. Every one re-checks admin (the /admin layout already
 * 404s everyone else) and calls the ONE core in `_components/taxonomy-writes.ts` that the shipped forms
 * call too.
 *
 * 🔢 THREE EXPORTS, NOT FIFTEEN. Every exported server action is one Vercel route and the deployment
 * refuses above 2,048 (`scripts/lint-server-action-budget.mjs`, 2026-09-26: production stopped for ~7
 * hours). So the map's writes share one door per argument shape: `mapWrite(op)` for the typed calls,
 * `mapReorder(level, parent, ids)` for every Order ▾, `mapWriteForm(kind, formData)` for the shipped
 * FormData pickers (ListPick · SavePick). The op is re-validated here — it arrives from the browser.
 */
import { revalidatePath } from 'next/cache';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getURLFromRedirectError } from 'next/dist/client/components/redirect';
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
  setOnePerEventCore,
  setPartServicesCore,
  type WriteResult,
} from './_components/taxonomy-writes';
import {
  addLeafAttributeFieldAction,
  addLeafAttributeOptionAction,
  addRefinementOption,
  clearLastMinuteStart,
  relabelLeafAttributeFieldAction,
  remapCanonical,
  removeRefinementOption,
  renameCanonicalService,
  renameTaxonomyNode,
  retireLeafAttributeFieldAction,
  retireLeafAttributeOptionAction,
  setCategoryHidden,
  setCategoryIcon,
  setCategoryPhoto,
  setLastMinuteStart,
  setServiceEventTypes,
  setServiceFlag,
  setServiceSecondaryTiles,
  updatePlanningDeadline,
  updateRefinementLeaf,
  updateRefinementOption,
} from './actions';
import { addTradeAlias, approveTradeAlias, rejectTradeAlias, unteachTradeAlias } from './search-word-actions';

export type MapOp =
  | { op: 'addGroup'; label: string }
  | { op: 'addCategory'; groupId: string; label: string }
  | { op: 'addService'; categoryId: string; label: string }
  | { op: 'addPart'; categoryId: string; label: string; services: string[] }
  | { op: 'link'; slotKey: string; services: string[]; on: boolean }
  | { op: 'movePart'; slotKey: string; categoryId: string }
  | { op: 'moveService'; key: string; categoryId: string }
  | { op: 'renamePart'; slotKey: string; label: string }
  | { op: 'hidePart'; slotKey: string; hidden: boolean }
  | { op: 'onePerEvent'; categoryId: string; on: boolean };

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

const str = (v: unknown) => String(v ?? '');
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

/** Every typed in-place write of the map — add · link · move · rename · hide. */
export async function mapWrite(op: MapOp): Promise<WriteResult> {
  const admin = createAdminClient();
  switch (op?.op) {
    case 'addGroup':
      return asAdmin((a) => addGroupCore(admin, a, str(op.label)));
    case 'addCategory':
      return asAdmin((a) => addCategoryCore(admin, a, str(op.groupId), str(op.label)));
    case 'addService':
      return asAdmin((a) => addServiceCore(admin, a, { tileId: str(op.categoryId), label: str(op.label) }));
    case 'addPart':
      return asAdmin((a) => addPartCore(admin, a, { homeCategoryId: str(op.categoryId), label: str(op.label), services: list(op.services) }));
    case 'link':
      return asAdmin((a) => linkPartServicesCore(admin, a, str(op.slotKey), list(op.services), op.on === true));
    case 'movePart':
      return asAdmin((a) => movePartHomeCore(admin, a, str(op.slotKey), str(op.categoryId)));
    case 'moveService':
      return asAdmin((a) => moveServiceCore(admin, a, str(op.key), str(op.categoryId)));
    case 'renamePart':
      return asAdmin((a) => renamePartCore(admin, a, str(op.slotKey), str(op.label)));
    case 'hidePart':
      return asAdmin((a) => setPartHiddenCore(admin, a, str(op.slotKey), op.hidden === true));
    case 'onePerEvent':
      return asAdmin((a) => setOnePerEventCore(admin, a, str(op.categoryId), op.on === true));
    default:
      return { ok: false, error: 'Unknown change.' };
  }
}

/** Order ▾ on a group (parent ''), a category's services, or a home's parts — bound per drawer. */
export async function mapReorder(level: 'groups' | 'services' | 'parts', parentId: string, orderedIds: string[]): Promise<WriteResult> {
  const admin = createAdminClient();
  const ids = list(orderedIds);
  if (level === 'groups') return asAdmin((a) => reorderGroupsCore(admin, a, ids));
  if (level === 'services') return asAdmin((a) => reorderServicesCore(admin, a, str(parentId), ids));
  if (level === 'parts') return asAdmin((a) => reorderPartsCore(admin, a, str(parentId), ids));
  return { ok: false, error: 'Unknown order.' };
}

/**
 * 💾 THE DRAWER SAVES IN PLACE (owner 2026-10-29, Admin › Categories panels approved — "a save never resets the
 * screen"). The drawer's text fields, switches and pickers that USED to post a redirect-back form (`actions.ts`,
 * `search-word-actions.ts`) now post the SAME FormData here and get an answer instead of a page load. The shipped
 * action still does the work — its validation, its audit row, its revalidatePath — and its `redirectBack(…, 'ok' |
 * 'error', words)` is read back as the answer (the Papic in-place door's pattern, `studio/papic/in-place-actions.ts`).
 * A redirect anywhere else (`/login`) is let through. +0 exported functions: one more `kind` on an existing door.
 */
const SHIPPED_FORMS = {
  'rename-node': renameTaxonomyNode,
  'rename-service': renameCanonicalService,
  'category-hidden': setCategoryHidden,
  'service-flag': setServiceFlag,
  'service-category': remapCanonical,
  'service-also': setServiceSecondaryTiles,
  'service-events': setServiceEventTypes,
  deadline: updatePlanningDeadline,
  'last-minute': setLastMinuteStart,
  'last-minute-off': clearLastMinuteStart,
  icon: setCategoryIcon,
  photo: setCategoryPhoto,
  'word-add': addTradeAlias,
  'word-approve': approveTradeAlias,
  'word-reject': rejectTradeAlias,
  'word-remove': unteachTradeAlias,
  'field-add': addLeafAttributeFieldAction,
  'field-option-add': addLeafAttributeOptionAction,
  'field-relabel': relabelLeafAttributeFieldAction,
  'field-retire': retireLeafAttributeFieldAction,
  'field-option-retire': retireLeafAttributeOptionAction,
  'card-save': (fd: FormData) => updateRefinementLeaf(str(fd.get('_leaf')), fd),
  'option-save': (fd: FormData) => updateRefinementOption(str(fd.get('_leaf')), str(fd.get('_option')), fd),
  'option-add': (fd: FormData) => addRefinementOption(str(fd.get('_leaf')), fd),
  'option-remove': (fd: FormData) => removeRefinementOption(str(fd.get('_leaf')), str(fd.get('_option')), fd),
} as const satisfies Record<string, (fd: FormData) => Promise<unknown>>;

export type ShippedFormKind = keyof typeof SHIPPED_FORMS;

async function answerOf(run: () => Promise<unknown>): Promise<WriteResult> {
  try {
    await run();
    return { ok: true, message: 'Saved.' };
  } catch (e) {
    if (!isRedirectError(e)) {
      const words = e instanceof Error && e.message && e.message.length < 200 ? e.message : null;
      return { ok: false, error: words ?? 'That could not be saved just now. Please try again.' };
    }
    const url = new URL(getURLFromRedirectError(e) ?? '', 'http://in-place.local');
    if (url.pathname !== CATEGORIES_PATH) throw e;
    const error = url.searchParams.get('error');
    if (error) return { ok: false, error };
    return { ok: true, message: url.searchParams.get('ok') ?? 'Saved.' };
  }
}

/**
 * The FormData doors, bound per use: "Services ▾" on a part (a `ListPick` posting `slot_key` + every `services`),
 * "Files shops as ▾" on a category (a `SavePick` posting `category_id` + `coarse_category`), and every shipped
 * redirect-back form of the drawer, answered in place (`SHIPPED_FORMS` above).
 */
export async function mapWriteForm(kind: 'part-services' | 'coarse' | 'rename-part' | ShippedFormKind, formData: FormData): Promise<WriteResult> {
  if (kind === 'rename-part') {
    const admin = createAdminClient();
    return asAdmin((a) => renamePartCore(admin, a, str(formData.get('slot_key')), str(formData.get('label'))));
  }
  if (kind === 'part-services') {
    const admin = createAdminClient();
    return asAdmin((a) => setPartServicesCore(admin, a, str(formData.get('slot_key')), formData.getAll('services').map(String)));
  }
  if (kind === 'coarse') {
    const admin = createAdminClient();
    return asAdmin((a) => setCoarseCategoryCore(admin, a, str(formData.get('category_id')), str(formData.get('coarse_category'))));
  }
  const shipped = Object.prototype.hasOwnProperty.call(SHIPPED_FORMS, kind) ? SHIPPED_FORMS[kind as ShippedFormKind] : null;
  if (!shipped) return { ok: false, error: 'Unknown change.' };
  return answerOf(() => shipped(formData));
}
