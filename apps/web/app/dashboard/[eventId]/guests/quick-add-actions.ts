'use server';

import { revalidatePath } from 'next/cache';
import { parsePersonName } from '@/lib/person-name-parse';
import { takeGenderMark, type TitleGender } from '@/lib/guest-title';
import { createClient } from '@/lib/supabase/server';
import { guestEditsLocked } from '@/lib/pax';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import {
  defaultInvitedToForRole,
  GROUP_CATEGORY_LABELS,
  A_PLUS_ONE_BRINGS_NO_ONE,
  SINGLETON_GUEST_ROLES,
  singletonRoleConflictMessage,
  singletonRoleDuplicateMessage,
  singletonRoleFromIndexError,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import { normalizeGuestName } from '@/lib/guest-name';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { pgArrayLiteral, updateJsonColumn, type JsonColumnClient } from '@/lib/update-json-column';
import { makeGuestGroupOnce } from '@/lib/guest-group-made-once';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { isHonoreeRole } from '@/lib/role-groups';
import { checkExtraSeats } from '@/lib/extra-seats-sync';
import { MOST_PLUS_ONES } from '@/lib/guest-role-drop';

// Iteration 0053 P2: the valid role set is per event type — each action below
// resolves it via resolveRoleSetForEvent(eventId) (wedding → the 24-role set;
// singletons bride/groom stay offered, the DB partial-unique index guards a
// second one and we surface a friendly error).
const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];

export type QuickAddInput = {
  first_name: string;
  last_name: string;
  /**
   * The three OPTIONAL name parts (added 2026-09-14). Absent means absent:
   * they are stored as NULL, never '' — so "no title" and "title cleared"
   * stay the same thing, and a guest with no honorific carries no empty
   * string into seating cards, QR labels or the print pack.
   *
   * `lib/person-name-parse.ts` fills these from a typed line; a caller that
   * knows the parts already (the detailed form, the detail editor) passes
   * them straight through.
   */
  name_prefix?: string | null;
  middle_name?: string | null;
  name_suffix?: string | null;
  side: string;
  role: string;
  group_id?: string | null;
  /** The standard group (Family · Friends · Work · School · Officiant · Other). Absent or unknown = 'other', as before. */
  group_category?: string | null;
  /**
   * Optional, and it does more than store an address: `set_guest_person` is a
   * BEFORE INSERT OR UPDATE OF email trigger, so writing it here resolves
   * `guests.person_id` to the SAME person node this address already has.
   *
   * That is what makes "add from your people" a re-invitation rather than a
   * new stranger with a familiar name. The CSV import has always written this
   * column; the field is added here so the picker reuses this one canonical
   * insert instead of growing a second, softer one beside it.
   *
   * 🔒 The caller may pass an address it can prove is the HOST'S OWN record —
   * a guest row on another of their events. It is deliberately never carried
   * for a samahan co-member or a connection; see `people-you-can-invite.ts`.
   */
  email?: string | null;
};

/**
 * How an add asks the page to redraw. Absent (every caller before 2026-10-19) = as before: the Guests page is redrawn in the
 * same answer. `refresh: false` = the caller already draws the new row and re-reads the list itself, once, when its queue of
 * adds is empty (`_components/guest-add-queue.ts`) — so ten names typed in a row cost one redraw, not ten.
 */
export type AddWriteOptions = {
  refresh?: boolean;
  /** "Add from your People" through the search box: the address People holds for them (server-side only — see
   *  `addGuestsFromPeople`), so the guest resolves to the SAME person node. */
  email?: string | null;
};

export type QuickAddResult =
  | {
      ok: true;
      guest: {
        guest_id: string;
        first_name: string;
        last_name: string;
        side: GuestSide;
        role: GuestRole;
      };
    }
  | { ok: false; error: string };

/**
 * Fast quick-add (iteration 0001 — additive Phase 1, 2026-06-02).
 *
 * Inserts ONE guest from the bottom-sheet quick-add and RETURNS a result
 * instead of redirecting, so the sheet stays open for rapid back-to-back
 * entry (the sticky-batch-context flow). The detailed `/guests/new`
 * form-action (createGuest) keeps the redirect-on-save behaviour and the
 * full option set (plus-one / meal / email / invited-to blocks).
 *
 * group_category is required on the row; quick-adds default to 'other'
 * (host refines later). Custom-group membership is the prototype's
 * sticky "Group" chip — wired here as an optional upsert into
 * guest_group_memberships when a group_id is passed.
 */
export async function quickAddGuest(
  eventId: string,
  input: QuickAddInput,
  opts: AddWriteOptions = {},
): Promise<QuickAddResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  // BACKSTOP. Callers that already split a name (capture bar, the detailed
  // form, the import) pass the parts explicitly and are trusted verbatim.
  // A caller that passes NONE of the three gets its first/last re-parsed here,
  // so a path nobody remembered to wire — today "add from your people", and
  // any future one — still cannot store a title as a given name.
  //
  // The `undefined` check is load-bearing: an explicit null means "this guest
  // HAS no prefix" and must not be overwritten by a parse, while an absent key
  // means "this caller knows nothing about name parts".
  // 🪪 A typed "(Woman)" / "(Man)" — "Atty. (Woman) Eufemia Cruz" — is the host's mark for the title's gender
  // (owner 2026-10-17), read and taken out: it never lands in a name part.
  const marks = [input.first_name, input.last_name, input.name_prefix].map((v) => (typeof v === 'string' ? takeGenderMark(v) : null));
  const gender: TitleGender | null = marks.find((m) => m?.gender)?.gender ?? null;
  if (gender) {
    input = {
      ...input,
      first_name: marks[0]?.text ?? input.first_name,
      last_name: marks[1]?.text ?? input.last_name,
      ...(input.name_prefix !== undefined ? { name_prefix: marks[2]?.text ?? input.name_prefix } : {}),
    };
  }
  const callerSuppliedParts =
    input.name_prefix !== undefined ||
    input.middle_name !== undefined ||
    input.name_suffix !== undefined;
  const derived = callerSuppliedParts
    ? null
    : parsePersonName(`${input.first_name ?? ''} ${input.last_name ?? ''}`.trim());

  const first_name = normalizeGuestName(derived?.firstName || input.first_name);
  const last_name = normalizeGuestName(derived?.lastName || input.last_name);
  // Same invisible-character + whitespace normalization the required names
  // get, then '' collapses to null — these three are optional by contract.
  const name_prefix = normalizeGuestName(derived ? derived.prefix : input.name_prefix) || null;
  const middle_name = normalizeGuestName(derived ? derived.middleName : input.middle_name) || null;
  const name_suffix = normalizeGuestName(derived ? derived.suffix : input.name_suffix) || null;
  const side = input.side as GuestSide;
  const role = (input.role || 'guest') as GuestRole;
  const email = (input.email ?? '').trim().toLowerCase() || null;

  // Both names required — matches createGuest's contract and the
  // guests.last_name NOT NULL column. Edge cases (mononyms, TBA) go
  // through the detailed form.
  if (!first_name || !last_name) {
    return { ok: false, error: 'Add both a first and last name.' };
  }
  if (!SIDE_VALUES.includes(side)) {
    return { ok: false, error: 'Pick a side first.' };
  }
  const roleSet = await resolveRoleSetForEvent(eventId);
  if (!roleSet.offeredRoles.includes(role)) {
    return { ok: false, error: 'That role isn’t valid.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };
  // Post-finalize guard (Adaptive Pax Pricing Phase 9); the DB trigger backs it.
  if (await guestEditsLocked(supabase, eventId)) {
    return { ok: false, error: 'Your guest list is finalized — the guest count is locked.' };
  }

  const { data: inserted, error } = await supabase
    .from('guests')
    .insert({
      event_id: eventId,
      first_name,
      last_name,
      // Omitted when null so a caller that knows nothing about name parts
      // inserts exactly the row it inserted before this field existed.
      ...(name_prefix ? { name_prefix } : {}),
      ...(gender ? { gender } : {}),
      ...(middle_name ? { middle_name } : {}),
      ...(name_suffix ? { name_suffix } : {}),
      side,
      group_category: input.group_category && Object.hasOwn(GROUP_CATEGORY_LABELS, input.group_category) ? input.group_category : 'other',
      role,
      rsvp_status: 'pending',
      photo_consent: true,
      invited_to_blocks: defaultInvitedToForRole(role),
      custom_tags: [],
      // Omitted entirely when absent, so every existing caller inserts exactly
      // the row it inserted before. See the field's note on QuickAddInput.
      ...(email ? { email } : {}),
    })
    .select('guest_id')
    .single();

  if (error || !inserted) {
    // 23505 from the per-event single-bride / single-groom partial unique
    // indexes — friendlier than the raw constraint name.
    const friendly =
      error &&
      (error as { code?: string }).code === '23505' &&
      /guests_one_(bride|groom)_per_event/.test(error.message)
        ? role === 'bride'
          ? 'There’s already a Bride — change theirs first.'
          : 'There’s already a Groom — change theirs first.'
        : (error?.message ?? 'Couldn’t add that guest.');
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Quick-add guest (insert)',
      file_path: 'app/dashboard/[eventId]/guests/quick-add-actions.ts',
      error_message: error?.message ?? 'insert returned no row',
      payload_snapshot: { eventId, side, role },
    });
    return { ok: false, error: friendly };
  }

  // Optional sticky custom-group assignment. Verify the group belongs to
  // this event (RLS guards too) before the membership upsert; a bad
  // group_id silently no-ops rather than failing the whole add.
  const groupId = (input.group_id ?? '').trim();
  if (groupId) {
    const { data: groupRow } = await supabase
      .from('guest_groups')
      .select('event_id')
      .eq('group_id', groupId)
      .maybeSingle();
    if (groupRow && groupRow.event_id === eventId) {
      await supabase
        .from('guest_group_memberships')
        .upsert([{ group_id: groupId, guest_id: inserted.guest_id }], {
          onConflict: 'group_id,guest_id',
          ignoreDuplicates: true,
        });
    }
  }

  // Smart seat-plan Phase 5: auto-place the new guest (clusters with its group
  // when one was picked). Best-effort — never blocks the add.
  await applyReconcileForEvent(supabase, eventId);

  // ⚡ A queued add (the name box, Quick add) asks for NO page redraw: its own row is already on the screen, and the list
  // re-reads ONCE when the queue is empty (`guest-add-queue.ts`). A redraw here made every add wait on the whole Guests page.
  if (opts.refresh !== false) revalidatePath(`/dashboard/${eventId}/guests`);
  return {
    ok: true,
    guest: { guest_id: inserted.guest_id, first_name, last_name, side, role },
  };
}

export type QuickGroupResult =
  // `created` distinguishes a FRESH insert (true) from the case-insensitive
  // find-or-create REUSE of a pre-existing group (false). The capture-bar
  // single-add (inline-actions.ts › addSingleGuest) reads it so that, when the
  // guest insert then fails, it deletes ONLY the groups it just minted and
  // never a group the couple already had. See T18 (orphan-groups on-failed-add).
  | { ok: true; group: { group_id: string; label: string }; created: boolean }
  | { ok: false; error: string };

/**
 * Create a custom guest group from the quick-add sheet's Group picker
 * (iteration 0001 — additive, 2026-06-02). Mirrors createGuestGroup
 * (groups-actions.ts) but RETURNS the new row instead of redirecting,
 * so the sheet stays open and can lock the new group for the next adds.
 *
 * team_side defaults to 'both' on this fast path (the host refines it in
 * the Groups sidebar). The case-insensitive unique index is treated as
 * idempotent: if a group with that name already exists for the event we
 * return it as success — the host wanted that group, it's already there.
 */
export async function quickCreateGroup(
  eventId: string,
  rawLabel: string,
  /** Which family the new group belongs to. Only a guest's own + passes one
   *  (owner 2026-09-21); anything unrecognised is 'both', as before. */
  rawSide?: unknown,
): Promise<QuickGroupResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  const label = (rawLabel ?? '').trim();
  if (!label) return { ok: false, error: 'Type a group name.' };
  if (label.length > 64) return { ok: false, error: 'Keep it under 64 characters.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  // The guest's side when one is passed, else 'both' (the host refines it later in the Groups sidebar).
  const teamSide = rawSide === 'bride' || rawSide === 'groom' ? rawSide : 'both';

  // 👥 One name, one group (2026-10-21): a name that already shows in this side's list IS that group — reused, never
  // twinned (`makeGuestGroupOnce`, the one place an own group is written).
  const made = await makeGuestGroupOnce(supabase, eventId, label, teamSide);
  if (!made.ok) return { ok: false, error: made.error };
  // Fresh insert → created:true; only these ids are eligible for the caller's on-failed-add cleanup. A reuse is
  // created:false, so the caller never deletes a group the couple already had.
  if (made.created) revalidatePath(`/dashboard/${eventId}/guests`);
  return {
    ok: true,
    group: { group_id: made.group.group_id, label: made.group.label },
    created: made.created,
  };
}

export type QuickRoleResult =
  | {
      ok: true;
      guest: { guest_id: string; role: GuestRole; extra_roles: GuestRole[] };
    }
  | { ok: false; error: string };

// Canonical singleton list (lib/guests) — bride/groom + the Muslim Nikah
// singletons (wali/imam/wakil). Imported rather than re-declared so this guard
// can't drift from the DB partial-unique indexes.
const SINGLETON_ROLES: ReadonlyArray<GuestRole> = SINGLETON_GUEST_ROLES;

/**
 * Multi-role (iteration 0001 — 2026-06-02). When the quick-add finds a
 * same-name guest with a DIFFERENT role, the resolver can give that guest
 * a SECOND role instead of creating a duplicate. The primary `role` is
 * untouched (it keeps driving the seating tier + invite defaults); the
 * new role is appended to `extra_roles`.
 *
 * Singleton roles (Bride/Groom + the Muslim Nikah singletons wali/imam/
 * wakil) are one-per-event — guarded by the partial-unique indexes on the
 * primary `role` column and, for bride/groom, the
 * guests_extra_roles_no_singletons CHECK. The SINGLETON_ROLES guard below
 * blocks any of them from being added as a SECOND role here.
 */
export async function addRoleToGuest(
  eventId: string,
  guestId: string,
  rawRole: string,
): Promise<QuickRoleResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  const role = rawRole as GuestRole;
  const roleSet = await resolveRoleSetForEvent(eventId);
  if (!roleSet.offeredRoles.includes(role)) {
    return { ok: false, error: 'That role isn’t valid.' };
  }
  if (SINGLETON_ROLES.includes(role)) {
    return { ok: false, error: singletonRoleConflictMessage(role) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  const { data: g, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, event_id, role, extra_roles')
    .eq('guest_id', guestId)
    .maybeSingle();
  if (readErr || !g || g.event_id !== eventId) {
    return { ok: false, error: 'Couldn’t find that guest.' };
  }

  const current: GuestRole[] = (g.extra_roles ?? []) as GuestRole[];
  // Already has it (as primary or extra) → no-op success.
  if (g.role === role || current.includes(role)) {
    return { ok: true, guest: { guest_id: g.guest_id, role: g.role, extra_roles: current } };
  }
  /* 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER (owner 2026-10-18, round 2): the role is added to the extra roles AS THEY
     ARE when the write lands (`updateJsonColumn`, a compare-and-set on the list) — never to the copy read above, so a
     role the other host added meanwhile stays. */
  let next: GuestRole[] = [...current, role];
  let updErr: { message: string; code?: string } | null = null;
  try {
    await updateJsonColumn<GuestRole[]>(
      supabase as unknown as JsonColumnClient,
      { table: 'guests', row: { guest_id: guestId, event_id: eventId }, column: 'extra_roles', what: 'That role', spell: pgArrayLiteral },
      (cur) => {
        const now = (cur ?? []) as GuestRole[];
        next = now.includes(role) ? now : [...now, role];
        return now.includes(role) ? null : { next };
      },
    );
  } catch (e) {
    updErr = { message: e instanceof Error ? e.message : String(e), code: (e as { code?: string }).code };
  }
  if (updErr) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Add extra role to guest (update)',
      file_path: 'app/dashboard/[eventId]/guests/quick-add-actions.ts',
      error_message: updErr.message,
      payload_snapshot: { eventId, guestId, role },
    });
    return { ok: false, error: updErr.message ?? 'Couldn’t add that role.' };
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, guest: { guest_id: g.guest_id, role: g.role, extra_roles: next } };
}

/**
 * ✋ How Guests › List's drag asks (owner 2026-11-01, DECISION_LOG "GUESTS › LIST: DRAG TO CHANGE ROLE"; the drop's
 * meaning is `lib/guest-role-drop.ts`). `via: 'list-drag'` refuses the couple and the honoree (they are never moved);
 * `broughtBy` is a drop on "Guests of [Role]": the guest becomes that person's +1 (null = nobody's — the Undo).
 * An argument on the shipped writer, not a new export: the server-action budget has no room (`lint-server-action-budget`).
 */
export type RoleDragAsk = { via: 'list-drag'; broughtBy?: string | null };

/** The owner's rule for "Guests of [Role]", verbatim: *"they get to that group only if they do not have a role and their role is guest"*. */
const ONLY_A_PLAIN_GUEST = 'Only a guest with no role of their own can be someone’s +1 here.';

/**
 * Change a guest's PRIMARY role (the seating-tier / invite-defaults one).
 * If the new role was sitting in extra_roles, it's removed from there to
 * avoid a duplicate. Bride/Groom singletons surface the friendly 23505.
 */
export async function setGuestPrimaryRole(
  eventId: string,
  guestId: string,
  rawRole: string,
  ask?: RoleDragAsk,
): Promise<QuickRoleResult> {
  const helperRefusal = await limitedHelperRefusal(eventId, 'guest_list');
  if (helperRefusal) return { ok: false, error: helperRefusal };
  const role = rawRole as GuestRole;
  // ✅ The role must be one this event OFFERS — the same check `addSingleGuest` makes (`resolveRoleSetForEvent`).
  const roleSet = await resolveRoleSetForEvent(eventId);
  if (!roleSet.offeredRoles.includes(role)) {
    return { ok: false, error: 'That role isn’t valid.' };
  }
  const drag = ask?.via === 'list-drag';
  if (drag && isHonoreeRole(role)) return { ok: false, error: 'The couple and the honoree aren’t moved by dragging.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  const { data: g, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, event_id, role, extra_roles, plus_one_of_guest_id, plus_one_count')
    .eq('guest_id', guestId)
    .maybeSingle();
  if (readErr || !g || g.event_id !== eventId) {
    return { ok: false, error: 'Couldn’t find that guest.' };
  }
  if (drag && isHonoreeRole(g.role as GuestRole)) return { ok: false, error: 'The couple and the honoree aren’t moved by dragging.' };

  // 👥 A drop on "Guests of [Role]" — or its Undo: whose +1 they are, never their role.
  if (drag && ask && 'broughtBy' in ask) {
    if (role !== 'guest') return { ok: false, error: ONLY_A_PLAIN_GUEST };
    const linked = await bringAsPlusOne(supabase, eventId, g as PlusOneLinkRow, ask.broughtBy ?? null);
    if (!linked.ok) return linked;
    revalidatePath(`/dashboard/${eventId}/guests`);
    return { ok: true, guest: { guest_id: g.guest_id, role: g.role, extra_roles: (g.extra_roles ?? []) as GuestRole[] } };
  }

  /* 👥 The extra roles AS THEY ARE when the write lands (round 2, `updateJsonColumn`) — a role the other host added
     meanwhile stays; only the new primary leaves the list. */
  let nextExtras = ((g.extra_roles ?? []) as GuestRole[]).filter((r) => r !== role);
  let updErr: { message: string; code?: string } | null = null;
  try {
    await updateJsonColumn<GuestRole[]>(
      supabase as unknown as JsonColumnClient,
      { table: 'guests', row: { guest_id: guestId, event_id: eventId }, column: 'extra_roles', what: 'That role', spell: pgArrayLiteral },
      (cur) => {
        nextExtras = ((cur ?? []) as GuestRole[]).filter((r) => r !== role);
        return { next: nextExtras, also: { role } };
      },
    );
  } catch (e) {
    updErr = { message: e instanceof Error ? e.message : String(e), code: (e as { code?: string }).code };
  }
  if (updErr) {
    const dupRole =
      (updErr as { code?: string }).code === '23505'
        ? singletonRoleFromIndexError(updErr.message)
        : null;
    const friendly = dupRole
      ? singletonRoleDuplicateMessage(dupRole)
      : (updErr.message ?? 'Couldn’t change that role.');
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Set guest primary role (update)',
      file_path: 'app/dashboard/[eventId]/guests/quick-add-actions.ts',
      error_message: updErr.message,
      payload_snapshot: { eventId, guestId, role },
    });
    return { ok: false, error: friendly };
  }

  // Smart seat-plan Phase 5: the primary role drives the seating tier, so
  // re-place this guest (and their +1) next to their new tier/group.
  await applyReconcileForEvent(supabase, eventId, { reseatGuestIds: [guestId] });

  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, guest: { guest_id: g.guest_id, role, extra_roles: nextExtras } };
}

type PlusOneLinkRow = {
  guest_id: string;
  role: GuestRole;
  extra_roles: GuestRole[] | null;
  plus_one_of_guest_id: string | null;
  plus_one_count: number | null;
};
type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 👥 Make `g` the +1 of `hostId` (null → nobody's), and keep each guest's "+N" equal to the +1 rows they bring — the
 * database's rule (`a_plus_ones_count_is_their_rows`): the link moves FIRST, then each number is set to the rows that
 * are there, so the trigger finds nothing to mint or remove. Every refusal is asked before anything is written.
 */
async function bringAsPlusOne(
  supabase: ServerClient,
  eventId: string,
  g: PlusOneLinkRow,
  hostId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (g.role !== 'guest' || (g.extra_roles ?? []).length > 0) return { ok: false, error: ONLY_A_PLAIN_GUEST };
  const old = g.plus_one_of_guest_id && g.plus_one_of_guest_id !== g.guest_id ? g.plus_one_of_guest_id : null;
  if (old === hostId) return { ok: true };
  if (hostId === g.guest_id) return { ok: false, error: 'A guest can’t be their own +1.' };
  if (hostId) {
    if ((g.plus_one_count ?? 0) > 0) return { ok: false, error: A_PLUS_ONE_BRINGS_NO_ONE };
    const { count: brings, error: bErr } = await supabase
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('plus_one_of_guest_id', g.guest_id)
      .is('deleted_at', null);
    if (bErr) return { ok: false, error: 'Couldn’t check who they bring — nothing was changed.' };
    if ((brings ?? 0) > 0) return { ok: false, error: A_PLUS_ONE_BRINGS_NO_ONE };
    const { data: host, error: hErr } = await supabase
      .from('guests')
      .select('guest_id, plus_one_of_guest_id, plus_one_count')
      .eq('event_id', eventId)
      .eq('guest_id', hostId)
      .is('deleted_at', null)
      .maybeSingle();
    if (hErr || !host) return { ok: false, error: 'Couldn’t find the guest who brings them.' };
    if (host.plus_one_of_guest_id) return { ok: false, error: A_PLUS_ONE_BRINGS_NO_ONE };
    if ((host.plus_one_count ?? 0) >= MOST_PLUS_ONES) return { ok: false, error: `They already bring ${MOST_PLUS_ONES} — that’s the most.` };
  }
  // 🔒 A finalized list moves no seats — asked of both guests before anything is saved (`checkExtraSeats`).
  for (const [who, step] of [[old, -1], [hostId, 1]] as const) {
    if (!who) continue;
    const check = await checkExtraSeats(supabase as never, eventId, who, (n) => Math.max(0, Math.min(MOST_PLUS_ONES, n + step)));
    if (!check.ok) return check;
  }
  const { data: moved, error: mErr } = await supabase
    .from('guests')
    .update({ plus_one_of_guest_id: hostId, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('guest_id', g.guest_id)
    .select('guest_id');
  if (mErr || !moved || moved.length === 0) {
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Drag a guest into Guests of a role (link)',
      file_path: 'app/dashboard/[eventId]/guests/quick-add-actions.ts',
      error_message: mErr?.message ?? 'no row updated',
      payload_snapshot: { eventId, guestId: g.guest_id, hostId },
    });
    return { ok: false, error: 'Couldn’t move them. Try again.' };
  }
  for (const who of [old, hostId]) {
    if (!who) continue;
    const { count, error: cErr } = await supabase
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('plus_one_of_guest_id', who)
      .is('deleted_at', null);
    if (cErr) return { ok: false, error: 'Moved — but a +N could not be recounted. Refresh to see it.' };
    const { error: uErr } = await supabase
      .from('guests')
      .update({ plus_one_count: Math.min(MOST_PLUS_ONES, count ?? 0), updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('guest_id', who);
    if (uErr) return { ok: false, error: 'Moved — but a +N could not be recounted. Refresh to see it.' };
  }
  // Beside the person who brings them (the seat engine pulls a +1 in next to their guest).
  await applyReconcileForEvent(supabase, eventId, { reseatGuestIds: [hostId ?? g.guest_id] });
  return { ok: true };
}
