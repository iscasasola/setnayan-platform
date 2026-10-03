/**
 * round-trip.ts — "create → read back every field", as a helper over the
 * committed Root map (part 2, slice 3).
 *
 * Owner, 2026-10-02 (DECISION_LOG "THE ROOT MAP ALSO CATCHES … 'FILLED IN BUT
 * NOT SAVED'"): "every create form gets a round-trip test (create → read back
 * every field)". This follows each input of one form through the map:
 *
 *   input  →  the action's field  →  the home it is saved in  →  the screen that shows it
 *
 * and names every place the chain breaks:
 *   notSaved     the form sends it and the action throws it away
 *   passedOn     the action hands it to another function this map cannot follow
 *                (not a failure — named so a reader knows where to look)
 *   notReadBack  saved into a column the reading screen never selects
 *
 * Pure — it reads only the generated maps, so a test using it is deterministic
 * and needs no database. It proves the WIRING, not the values: a real database
 * round trip belongs in a `*.db.test.ts`, and this helper tells it which
 * columns to assert.
 */

import { isKeyFact, type UgatFieldsMap } from './fields';

export interface RoundTripInput {
  /** The component file the `<form>` is written in. */
  form: string;
  /** The action ref the form posts to (`file#export`). */
  action: string;
  /** The screen id that shows what was created. */
  reader: string;
}

export interface RoundTripResult {
  inputs: string[];
  /** input → the homes it is saved in. */
  saved: Record<string, string[]>;
  notSaved: string[];
  passedOn: string[];
  /** Homes (`table.column`) the reader does not read back. */
  notReadBack: string[];
}

const matches = (field: string, input: string) =>
  field.includes('*')
    ? new RegExp(`^${field.split('*').map((p) => p.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')).join('.*')}$`).test(input)
    : field === input;

export function roundTrip(map: UgatFieldsMap, q: RoundTripInput): RoundTripResult {
  const form = map.forms.find((f) => f.from === q.form && f.actions.includes(q.action));
  if (!form) throw new Error(`round trip: no form in ${q.form} posts to ${q.action} — re-run ugat:fields?`);
  const action = map.actions.find((a) => a.ref === q.action);
  if (!action) throw new Error(`round trip: ${q.action} is not a mapped action`);
  const reader = map.screens.find((s) => s.id === q.reader);
  if (!reader) throw new Error(`round trip: ${q.reader} is not a screen`);

  const saved: Record<string, string[]> = {};
  const notSaved: string[] = [];
  const passedOn: string[] = [];
  for (const input of form.inputs) {
    const fields = action.fields.filter((f) => matches(f, input));
    if (fields.length === 0 || fields.some((f) => action.dropped.includes(f))) {
      if (!action.readsAll) notSaved.push(input);
      else passedOn.push(input);
      continue;
    }
    const homes = [...new Set(fields.flatMap((f) => action.saves[f] ?? []))].sort();
    if (homes.length === 0) passedOn.push(input);
    else saved[input] = homes;
  }

  const reads = new Set(reader.reads);
  const readsColumn = (home: string) => {
    const [table, column] = home.split('.');
    return reads.has(`${table}.${column}`) || reads.has(`${table}.*`);
  };
  const notReadBack = [
    ...new Set(
      Object.values(saved)
        .flat()
        .filter((h) => !h.endsWith('.?') && !h.startsWith('rpc:'))
        .map((h) => h.split('.').slice(0, 2).join('.'))
        // A row's keys and stamps (`event_id`, `created_by_user_id`, `…_at`) are
        // bookkeeping the person never typed — not a field to read back.
        .filter((h) => !isKeyFact(h.split('.')[1]!))
        .filter((h) => !readsColumn(h)),
    ),
  ].sort();

  return { inputs: form.inputs, saved, notSaved: notSaved.sort(), passedOn: passedOn.sort(), notReadBack };
}

/**
 * Every create form in the map — a form whose action's name starts with a
 * creating verb. The report lists the ones no round-trip test covers yet.
 */
export function createForms(map: UgatFieldsMap): Array<{ form: string; action: string }> {
  const out: Array<{ form: string; action: string }> = [];
  for (const f of map.forms) {
    if (f.from.startsWith('app/admin/')) continue;
    for (const a of f.actions) {
      const fn = a.split('#')[1] ?? '';
      if (/^(?:create|add|new|commit|propose|post|import|invite|request|book|register|become|submit)/i.test(fn) && f.inputs.length > 0) {
        out.push({ form: f.from, action: a });
      }
    }
  }
  return [...new Map(out.map((x) => [`${x.form}\u0000${x.action}`, x])).values()].sort(
    (a, b) => a.form.localeCompare(b.form) || a.action.localeCompare(b.action),
  );
}
