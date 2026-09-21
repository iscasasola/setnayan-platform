import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ARRANGE_COLUMNS,
  buildRosterSections,
  compareByKeys,
  groupingFromParams,
  groupingKeyOf,
  orderingKeysOf,
  parseGrouping,
  toggleGrouping,
  type ArrangeCtx,
  type ArrangeKey,
} from './roster-arrangement';

type P = { name: string; last: string; side: string; role: string; grp: string | null; rsvp: string; seat: string | null };

const ctx: ArrangeCtx<P> = {
  lastName: (g) => g.last,
  sideLabel: (g) => g.side,
  roleGroupLabel: (g) => g.role,
  groupLabel: (g) => g.grp,
  rsvpLabel: (g) => g.rsvp,
  seatLabel: (g) => g.seat,
  seatRank: (g) =>
    g.seat === null ? [2, ''] : g.seat.startsWith('Suggested') ? [1, g.seat] : [0, g.seat],
};
// Mirrors the app: sides in the owner's sequence (2026-09-20), roles in the
// roster's curated hierarchy. A key with no known order sorts alphabetically.
const order = (k: ArrangeKey): readonly string[] =>
  k === 'side'
    ? ["Groom's side", "Bride's side", 'Both sides']
    : k === 'role'
      ? ['Parents', 'Guests']
      : [];

const p = (name: string, o: Partial<P> = {}): P => ({
  name,
  last: name,
  side: 'Both sides',
  role: 'Guests',
  grp: null,
  rsvp: 'Pending',
  seat: null,
  ...o,
});

test('an unknown or repeated key is dropped, never refused', () => {
  // A stale bookmark must still render a guest list.
  assert.deepEqual(parseGrouping('side,nonsense,role'), ['side', 'role']);
  // A key is one nesting level. Twice would bucket a bucket into itself and
  // print every row under the heading twice.
  assert.deepEqual(parseGrouping('side,side'), ['side']);
  assert.deepEqual(parseGrouping(' side , role '), ['side', 'role']);
});

test('an ABSENT ?by= derives the old sectioning; an EMPTY one means no headings', () => {
  // ⚠ The distinction is the whole backwards-compatibility story: ?sort=side
  // has sectioned by side for months and is in people's bookmarks.
  assert.deepEqual(groupingFromParams(undefined, 'side'), ['side']);
  assert.deepEqual(groupingFromParams(undefined, 'group'), ['group']);
  assert.deepEqual(groupingFromParams(undefined, 'importance'), ['role']);
  assert.deepEqual(groupingFromParams(undefined, 'rsvp'), []);
  // Present-and-empty is a host saying "take the headings off", and it has to
  // beat the derivation or that choice is unexpressable.
  assert.deepEqual(groupingFromParams('', 'importance'), []);
  assert.deepEqual(groupingFromParams('rsvp', 'side'), ['rsvp']);
});

test('ticking appends at the END, so ticking order is nesting order', () => {
  assert.deepEqual(toggleGrouping(['side'], 'role'), ['side', 'role']);
  assert.deepEqual(toggleGrouping(['role'], 'side'), ['role', 'side']);
  assert.deepEqual(toggleGrouping(['side', 'role'], 'side'), ['role']);
});

test('ONLY the first ticked column makes headings', () => {
  // ⚖ Owner 2026-09-20: "first one only groups[,] the second and succeeding
  // just arranges and does not group." Nesting was the other available
  // reading, and it turns a long list into forty headings of two rows.
  assert.equal(groupingKeyOf(['side', 'role', 'name']), 'side');
  assert.deepEqual(orderingKeysOf(['side', 'role', 'name']), ['role', 'name']);
  assert.equal(groupingKeyOf([]), null);
  assert.deepEqual(orderingKeysOf(['side']), []);
});

test('the second column ORDERS inside a heading without adding one', () => {
  const rows = [
    p('Ana', { side: "Bride's side", role: 'Guests' }),
    p('Ben', { side: "Bride's side", role: 'Parents' }),
    p('Cy', { side: "Groom's side", role: 'Parents' }),
  ];
  const keys: ArrangeKey[] = ['side', 'role'];
  // The caller sorts, then sections — exactly as the page does.
  const sorted = [...rows].sort((a, b) => compareByKeys(orderingKeysOf(keys), a, b, ctx, order));
  const secs = buildRosterSections(sorted, groupingKeyOf(keys)!, ctx, order);
  assert.deepEqual(secs.map((s) => s.label), ["Groom's side", "Bride's side"]);
  // Role ordered them INSIDE the side heading; no role heading was created.
  assert.deepEqual(secs[1]!.guests.map((g) => g.name), ['Ben', 'Ana']);
});

test('a count is everybody under the heading', () => {
  const rows = [
    p('Ana', { side: "Bride's side" }),
    p('Ben', { side: "Bride's side" }),
    p('Cy', { side: "Groom's side" }),
  ];
  const secs = buildRosterSections(rows, 'side', ctx, order);
  assert.deepEqual(secs.map((s) => [s.label, s.count]), [["Groom's side", 1], ["Bride's side", 2]]);
  assert.equal(secs.reduce((t, s) => t + s.count, 0), rows.length, 'a guest fell out');
});

test('ordering by name uses the whole surname, not the bucket letter', () => {
  // 🪤 Bucketing by name is a first letter; ordering by it must not be, or
  // every B sorts as one block in whatever order they arrived.
  const rows = [p('Bz', { last: 'Bz' }), p('Ba', { last: 'Ba' })];
  const sorted = [...rows].sort((a, b) => compareByKeys(['name'], a, b, ctx, order));
  assert.deepEqual(sorted.map((g) => g.last), ['Ba', 'Bz']);
});

test('a placed table orders ahead of a suggested one', () => {
  // 🪤 By label alone "Suggested T1" beats "Table 3" alphabetically, which
  // puts every guess ahead of every real assignment.
  const rows = [
    p('Sug', { seat: 'Suggested T1' }),
    p('None', { seat: null }),
    p('Placed', { seat: 'Table 3' }),
    p('Placed12', { seat: 'Table 12' }),
  ];
  const sorted = [...rows].sort((a, b) => compareByKeys(['seat'], a, b, ctx, order));
  assert.deepEqual(sorted.map((g) => g.name), ['Placed', 'Placed12', 'Sug', 'None']);
});

test('the ORDER THE CALLER SORTED IN survives inside every bucket', () => {
  // This is what lets a host pick "role sections, ordered by RSVP inside each"
  // — the thing one ?sort= could never express. If this function re-sorted,
  // the sort control would silently stop applying below a heading.
  const rows = [p('Zed'), p('Ana'), p('Mia')]; // deliberately NOT alphabetical
  const secs = buildRosterSections(rows, 'role', ctx, order);
  assert.deepEqual(secs[0]!.guests.map((g) => g.name), ['Zed', 'Ana', 'Mia']);
});

test('every guest lands somewhere — a missing value is a bucket, not a hole', () => {
  const rows = [p('Ana', { grp: 'Barkada' }), p('Ben', { grp: null }), p('Cy', { last: '' })];
  const byGroup = buildRosterSections(rows, 'group', ctx, order);
  assert.deepEqual(byGroup.map((n) => n.label), ['Barkada', 'No group yet']);
  assert.equal(byGroup.reduce((t, n) => t + n.count, 0), 3);
  // A first initial is not a surname initial: a guest with no last name gets
  // their own bucket rather than joining whatever letter they start with.
  const byName = buildRosterSections(rows, 'name', ctx, order);
  assert.ok(byName.some((n) => n.label === 'No last name'), byName.map((n) => n.label).join(' · '));
});

test('every heading has its own key, so folding one folds only it', () => {
  const rows = [
    p('Ana', { side: "Bride's side" }),
    p('Ben', { side: "Groom's side" }),
    p('Cy', { side: 'Both sides' }),
  ];
  const keys = buildRosterSections(rows, 'side', ctx, order).map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, `duplicate section keys: ${keys.join(' · ')}`);
});

test('a "No …" bucket trails its named siblings', () => {
  const rows = [p('Ana', { grp: 'Office' }), p('Ben', { grp: null }), p('Cy', { grp: 'Barkada' })];
  assert.deepEqual(
    buildRosterSections(rows, 'group', ctx, order).map((n) => n.label),
    ['Barkada', 'Office', 'No group yet'],
  );
});

test('every arrangeable column is one the roster actually shows', () => {
  // A control for a column that is not on screen is a control nobody can
  // connect to anything. Contact has no value to group by; Meal is not a
  // column here (it is on the prototype, not in the app).
  assert.deepEqual(
    ARRANGE_COLUMNS.map((c) => c.label),
    ['Name', 'Side', 'Role', 'Groups', 'RSVP', 'Seat'],
  );
});

test("the side sequence is the owner's: Groom's, Bride's, Both, then none", () => {
  // ⚖ Owner 2026-09-20: "on side. the sequence is Groom's Side then Bride's
  // Side then Both then no Side." This REVERSED the first two — the roster had
  // listed the bride's side first on nobody's instruction.
  // ⛔ Unrelated to "Bride will always be #1 then groom" (2026-06-05), which is
  // about the two PEOPLE and is enforced by the honoree pin.
  const rows = [
    p('B', { side: "Bride's side" }),
    p('N', { side: 'No side' }),
    p('X', { side: 'Both sides' }),
    p('G', { side: "Groom's side" }),
  ];
  assert.deepEqual(
    buildRosterSections(rows, 'side', ctx, order).map((s) => s.label),
    ["Groom's side", "Bride's side", 'Both sides', 'No side'],
  );
});
