/**
 * change-requests.ts — A SUPPLIER'S PROPOSED CHANGE TO THE GUEST LIST, THE SEAT PLAN OR THE SUPPLIERS (owner 8 Nov
 * 2026: *"any supplier that is not a coordinator still has to request a host or coordinator to accept the change"*).
 *
 * The TS half of `event_change_requests` (migration 20271331202840). Pure — no imports beyond types and pure modules —
 * so a unit test executes every rule. The database holds the same whitelist (`change_request_payload_ok`) and is the
 * one that decides; this module only builds a payload the database will take, and the words both sides read.
 *
 *   guest_list · guest_add     — add a guest            {first_name, last_name, side?}
 *   guest_list · guest_edit    — change a guest         target guest, {changes}
 *   guest_list · guest_remove  — remove a guest         target guest
 *   seat_plan  · seat_move     — seat a guest           target guest, {table_id | null}
 *   vendors    · supplier_edit — change a supplier row  target booking, {changes}
 *
 * Never a price, a status or a payment — the whitelist names none of them.
 */
import type { DelegateArea } from './delegate-areas';

export type ChangeArea = Extract<DelegateArea, 'guest_list' | 'seat_plan' | 'vendors'>;
export type ChangeOp = 'guest_add' | 'guest_edit' | 'guest_remove' | 'seat_move' | 'supplier_edit';
export type ChangeStatus = 'open' | 'accepted' | 'declined' | 'withdrawn';

/** The parts a change request can touch. Schedule and Mood Board keep their own shipped request paths. */
export const CHANGE_AREAS: readonly ChangeArea[] = ['guest_list', 'seat_plan', 'vendors'];

/** Each change, the part it belongs to, and the words in the "What to change" dropdown. */
export const CHANGE_OPS: Readonly<Record<ChangeOp, { area: ChangeArea; label: string; needsTarget: boolean }>> = {
  guest_add: { area: 'guest_list', label: 'Add a guest', needsTarget: false },
  guest_edit: { area: 'guest_list', label: 'Change a guest’s details', needsTarget: true },
  guest_remove: { area: 'guest_list', label: 'Remove a guest', needsTarget: true },
  seat_move: { area: 'seat_plan', label: 'Seat a guest at a table', needsTarget: true },
  supplier_edit: { area: 'vendors', label: 'Change a supplier’s contact or crew', needsTarget: true },
};

/** The guest fields a supplier may propose — the same six the database's whitelist names. */
export const GUEST_EDIT_FIELDS = ['first_name', 'last_name', 'mobile', 'email', 'meal_preference', 'dietary_restrictions'] as const;
export type GuestEditField = (typeof GUEST_EDIT_FIELDS)[number];
// A tuple list, not an object literal: `meal_preference: '…'` reads to the enum guard as a write of that value.
export const GUEST_FIELD_LABEL: Readonly<Record<GuestEditField, string>> = Object.fromEntries([
  ['first_name', 'First name'],
  ['last_name', 'Last name'],
  ['mobile', 'Mobile'],
  ['email', 'Email'],
  ['meal_preference', 'Meal'],
  ['dietary_restrictions', 'Dietary needs'],
] as const) as Record<GuestEditField, string>;

/** The supplier-row fields a supplier may propose — never a price or a status. */
export const SUPPLIER_EDIT_FIELDS = ['contact_phone', 'contact_email', 'crew_size'] as const;
export type SupplierEditField = (typeof SUPPLIER_EDIT_FIELDS)[number];
export const SUPPLIER_FIELD_LABEL: Readonly<Record<SupplierEditField, string>> = {
  contact_phone: 'Contact number',
  contact_email: 'Contact email',
  crew_size: 'Crew size',
};

export const MEAL_CHOICES = ['beef', 'chicken', 'fish', 'vegetarian', 'vegan', 'kids', 'no_preference'] as const;

/** Which changes a supplier may propose, given the parts they were shared. */
export function proposableOps(held: Partial<Record<DelegateArea, 'edit' | 'view' | null>>): ChangeOp[] {
  return (Object.keys(CHANGE_OPS) as ChangeOp[]).filter((op) => Boolean(held[CHANGE_OPS[op].area]));
}

export type ProposeInput = {
  op: ChangeOp;
  targetId?: string | null;
  /** What the target is called on screen ("Lorna Reyes", "Bloom & Co.") — for the summary only. */
  targetName?: string | null;
  /** guest_add: the new guest. */
  firstName?: string;
  lastName?: string;
  /** guest_edit / supplier_edit: field → new value ('' clears it). */
  changes?: Record<string, string>;
  /** seat_move: the table, or null to take the seat away. */
  tableId?: string | null;
  tableName?: string | null;
};

export type BuiltChange =
  | { ok: true; area: ChangeArea; op: ChangeOp; targetId: string | null; payload: Record<string, unknown>; summary: string }
  | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * Turn what the supplier picked into the row `event_change_requests` will take — or the sentence that says why not.
 * Mirrors `change_request_payload_ok`: an unknown field, an empty change, a bad id or a meal that is not on the list
 * never reaches the database.
 */
export function buildChange(input: ProposeInput): BuiltChange {
  const meta = CHANGE_OPS[input.op];
  if (!meta) return { ok: false, error: 'Pick what you want to change.' };
  const target = input.targetId ?? null;
  if (meta.needsTarget && (!target || !UUID_RE.test(target))) {
    return { ok: false, error: input.op === 'supplier_edit' ? 'Pick the supplier.' : 'Pick the guest.' };
  }
  const who = clip(input.targetName ?? '', 80) || (input.op === 'supplier_edit' ? 'a supplier' : 'a guest');

  switch (input.op) {
    case 'guest_add': {
      const first = clip(input.firstName ?? '', 80);
      const last = clip(input.lastName ?? '', 80);
      if (!first) return { ok: false, error: 'Type the guest’s first name.' };
      return {
        ok: true,
        area: 'guest_list',
        op: 'guest_add',
        targetId: null,
        payload: { first_name: first, last_name: last },
        summary: clip(`Add ${[first, last].filter(Boolean).join(' ')} to the guest list`, 240),
      };
    }
    case 'guest_edit':
    case 'supplier_edit': {
      const allowed: readonly string[] = input.op === 'guest_edit' ? GUEST_EDIT_FIELDS : SUPPLIER_EDIT_FIELDS;
      const changes: Record<string, string | null> = {};
      for (const [k, raw] of Object.entries(input.changes ?? {})) {
        if (!allowed.includes(k)) continue;
        const v = clip(String(raw ?? ''), 200);
        changes[k] = v === '' ? null : v;
      }
      const keys = Object.keys(changes);
      if (keys.length === 0) return { ok: false, error: 'Change at least one thing.' };
      if (input.op === 'guest_edit') {
        if (changes.first_name === null) return { ok: false, error: 'A guest needs a first name.' };
        const meal = changes.meal_preference;
        if (meal != null && !(MEAL_CHOICES as readonly string[]).includes(meal)) return { ok: false, error: 'Pick a meal from the list.' };
      } else if (changes.crew_size != null && !/^[0-9]{1,3}$/.test(changes.crew_size)) {
        return { ok: false, error: 'Crew size is a number.' };
      }
      const labels = input.op === 'guest_edit' ? GUEST_FIELD_LABEL : SUPPLIER_FIELD_LABEL;
      const what = keys.map((k) => (labels as Record<string, string>)[k]?.toLowerCase() ?? k).join(', ');
      return {
        ok: true,
        area: input.op === 'guest_edit' ? 'guest_list' : 'vendors',
        op: input.op,
        targetId: target,
        payload: { changes },
        summary: clip(`Change ${who}’s ${what}`, 240),
      };
    }
    case 'guest_remove':
      return { ok: true, area: 'guest_list', op: 'guest_remove', targetId: target, payload: {}, summary: clip(`Remove ${who} from the guest list`, 240) };
    case 'seat_move': {
      const table = input.tableId ?? null;
      if (table !== null && !UUID_RE.test(table)) return { ok: false, error: 'Pick the table.' };
      const tableName = clip(input.tableName ?? '', 60) || 'a table';
      return {
        ok: true,
        area: 'seat_plan',
        op: 'seat_move',
        targetId: target,
        payload: { table_id: table },
        summary: clip(table ? `Seat ${who} at ${tableName}` : `Take ${who}’s seat away`, 240),
      };
    }
  }
}

/** What the supplier reads about their own change. */
export function changeStatusWords(status: ChangeStatus): string {
  switch (status) {
    case 'open':
      return 'Waiting for the host or the coordinator';
    case 'accepted':
      return 'Accepted — it is in';
    case 'declined':
      return 'Declined — nothing changed';
    case 'withdrawn':
      return 'You took it back';
  }
}

/** The in-app notice to the hosts and the coordinator (`change_requested`) — in-app only, never email. */
export function changeRequestedNotice(input: { eventId: string; supplierName: string | null; summary: string }) {
  const who = input.supplierName?.trim() || 'A supplier';
  return {
    title: `${who} proposed a change`.slice(0, 160),
    body: input.summary.slice(0, 200),
    relatedUrl: `/dashboard/${input.eventId}/schedule`,
  };
}

/** The in-app notice to the supplier when their change is answered (`change_answered`). */
export function changeAnsweredNotice(input: { eventId: string; accepted: boolean; summary: string; eventName: string | null }) {
  const who = input.eventName?.trim() || 'The couple';
  return {
    title: (input.accepted ? `${who} accepted your change` : `${who} declined your change`).slice(0, 160),
    body: input.summary.slice(0, 200),
    relatedUrl: `/vendor-dashboard/clients/${input.eventId}`,
  };
}

/** `answer_event_change_request`'s refusals, in words. Nothing changed in any of them. */
export function changeAnswerRefusal(message: string): string {
  if (/already answered/.test(message)) return 'That change was already answered.';
  if (/their own change/.test(message)) return 'You cannot accept your own change.';
  if (/only a host or the coordinator/.test(message)) return 'Only the host or the coordinator can answer this. Nothing has changed.';
  if (/is gone|no such change/.test(message)) return 'Nothing changed — the guest, table or supplier is gone.';
  return 'We could not apply that just now. Nothing has changed. Please try again.';
}
