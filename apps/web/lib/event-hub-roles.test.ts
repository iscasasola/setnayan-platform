/**
 * VIEW AS — the gate, and the six reads.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 🚨 WHY THE FIRST BLOCK EXISTS, AND WHY IT USES A `guest` ROW
 * ══════════════════════════════════════════════════════════════════════════
 * `loadHostMembership` once selected `member_type` and never compared it,
 * returning `Boolean(memberRow)`. `event_members` is the event's PEOPLE table —
 * 'guest' is one of its member_type values — so any row counted as a host, and
 * a guest could open a PRIVATE site and use `?phase=` to jump to phases the
 * couple had not launched, including their own unsent save-the-date.
 *
 * `hubPreviewRoles` ships that same override to FIVE roles. So the row this
 * suite feeds it is a REAL row belonging to a REAL person who is not a host —
 * the exact input `Boolean(...)` cannot tell apart from a couple's row. A
 * suite that only tested `null`/`undefined` would pass against the sabotage and
 * prove nothing, which is the trap the original defect walked into.
 *
 * MUTATION TARGET (measured, both directions, in the PR body):
 *   lib/event-hub-control.ts — `if (!isHostMemberType(input.memberType)) return [];`
 *   relaxed to               — `if (!input.memberType) return [];`
 * must turn the "a guest row is refused" tests RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_ROLES,
  HUB_GENERIC_ROLES,
  hubPreviewRoles,
  resolveHubRoleView,
  resolveHubStanding,
  NOT_SHARED,
  type HubEventRead,
  type HubGuestRead,
  type HubRole,
} from './event-hub-control';

const MNL = 'Asia/Manila';
const at = (iso: string) => new Date(iso).getTime();
/** 14 days before the wedding — the run-up, where the switcher is used. */
const NOW = at('2026-11-28T10:00:00+08:00');

const EVENT: HubEventRead = {
  measured: true,
  eventDate: '2026-12-12',
  eventEndDate: null,
  clearedAt: null,
  timezone: MNL,
  slug: 'maria-and-jomar',
};
const GUESTS: HubGuestRead = { shared: true, measured: true, invited: 90, replied: 61 };

const standing = (read: HubEventRead = EVENT) => resolveHubStanding(read, NOW);
const view = (role: HubRole, o: Partial<{ read: HubEventRead; guests: HubGuestRead }> = {}) =>
  resolveHubRoleView({
    role,
    standing: standing(o.read ?? EVENT),
    slug: (o.read ?? EVENT).slug ?? null,
    guests: o.guests ?? GUESTS,
  });

// ── 1 · THE GATE ───────────────────────────────────────────────────────────

test('a `guest`-typed event_members row is REFUSED — no role, no chip, no door', () => {
  // The row EXISTS. This is the person `Boolean(memberRow)` waved through.
  const offered = hubPreviewRoles({ memberType: 'guest', namedGuestEnabled: false });
  assert.deepEqual(offered, [], 'a guest row must be offered NOTHING to preview');
  assert.equal(offered.length, 0);
});

test('a guest row is refused on EVERY preview path — including with the flag on', () => {
  const withFlag = hubPreviewRoles({ memberType: 'guest', namedGuestEnabled: true });
  assert.deepEqual(withFlag, [], 'the named-guest flag must never widen WHO may preview');
  // And every other non-host member_type the table can hold.
  for (const notAHost of ['guest', 'GUEST', 'vendor', 'supplier', 'moderator', 'member', '']) {
    assert.deepEqual(
      hubPreviewRoles({ memberType: notAHost, namedGuestEnabled: true }),
      [],
      `member_type "${notAHost}" is not a host and must preview nothing`,
    );
  }
  // Absence is not a host either.
  assert.deepEqual(hubPreviewRoles({ memberType: null, namedGuestEnabled: true }), []);
  assert.deepEqual(hubPreviewRoles({ memberType: undefined, namedGuestEnabled: true }), []);
});

test('the two host member types ARE offered — the gate refuses, it does not close', () => {
  for (const host of ['couple', 'coordinator']) {
    const offered = hubPreviewRoles({ memberType: host, namedGuestEnabled: false });
    assert.equal(offered.length, HUB_GENERIC_ROLES.length);
    assert.ok(offered.includes('host'), `${host} must be offered the host read`);
    assert.ok(offered.includes('stranger'), `${host} must be able to check the stranger read`);
  }
});

test('the NAMED role is dark by default and appears only with the flag', () => {
  const off = hubPreviewRoles({ memberType: 'couple', namedGuestEnabled: false });
  assert.ok(!off.includes('named_guest'), 'named_guest must not be offered while the flag is off');
  assert.equal(off.length, 5, 'five generic chips ship unconditionally');

  const on = hubPreviewRoles({ memberType: 'couple', namedGuestEnabled: true });
  assert.ok(on.includes('named_guest'));
  assert.equal(on.length, HUB_ROLES.length);
});

// ── 2 · THE SIX READS ──────────────────────────────────────────────────────

test('six roles, six DIFFERENT reads — a switcher whose columns agree is decoration', () => {
  const headlines = HUB_ROLES.map((r) => view(r).headline);
  assert.equal(new Set(headlines).size, HUB_ROLES.length, 'every role reads differently');
  const names = HUB_ROLES.map((r) => view(r).name);
  assert.equal(new Set(names).size, HUB_ROLES.length);
});

test('COORDINATOR is the host column minus editing, plus the two floor powers', () => {
  const c = view('coordinator');
  const text = c.cells.map((x) => x.text).join(' | ');
  assert.match(text, /announcements/i, 'writes the announcements (#22)');
  assert.match(text, /advance the running order/i, 'the only role that may advance (#30)');
  assert.ok(
    c.cells.some((x) => x.mark === 'none' && /cannot edit the site/i.test(x.text)),
    'and cannot edit the site (#36) — the one demotion',
  );
  assert.match(c.footnote, /hired/i, 'a hired coordinator is a supplier, not this');
  // Same address as the host — that IS the finding, not an oversight.
  assert.equal(c.previewHref, view('host').previewHref);
});

test('SPECIFIC GUEST is the guest column plus four things that are theirs by name', () => {
  const n = view('named_guest');
  const text = n.cells.map((x) => x.text).join(' | ');
  assert.match(text, /their seat/i);
  assert.match(text, /photos of them/i);
  assert.match(text, /QR, bound to their name/i);
  assert.equal(n.cells.filter((x) => x.mark === 'full').length, 3);
  // The plain guest has the FINDER, not a seat.
  const g = view('guest');
  assert.ok(g.cells.some((x) => x.mark === 'partial' && /seat finder/i.test(x.text)));
});

test('a SUPPLIER sees the desk and never a guest surface — and is refused pabuya', () => {
  const s = view('supplier');
  const text = s.cells.map((x) => x.text).join(' | ');
  assert.match(text, /desk/i);
  assert.ok(
    s.cells.some((x) => x.mark === 'none' && /gifts/i.test(x.text)),
    'a supplier is refused the gifts page — they are not a guest (#26)',
  );
  assert.ok(
    s.cells.some((x) => x.mark === 'partial' && /cannot advance/i.test(x.text)),
    'sees the programme move but cannot advance it (#30)',
  );
  assert.equal(s.previewHref, null, 'there is no honest door — a booking cannot be fabricated');
});

test('a STRANGER read offers NO door — a signed-in preview cannot tell you this', () => {
  const s = view('stranger');
  assert.equal(s.previewHref, null);
  assert.equal(s.previewLabel, null);
  assert.match(s.footnote, /private window/i);
  assert.ok(
    s.cells.filter((x) => x.mark === 'none').length >= 2,
    'the stranger column is mostly ○, on purpose',
  );
  assert.match(s.blurb, /not a hint/i, 'never a hint that anything is behind it');
});

// ── 3 · DOORS ARE EXISTING, GATED ROUTES — NEVER A NEW ONE ─────────────────

test('every door is an address that already ships and re-checks the viewer itself', () => {
  assert.equal(view('host').previewHref, '/maria-and-jomar');
  assert.equal(view('coordinator').previewHref, '/maria-and-jomar');
  // The guest opens the stage the guests are ACTUALLY on — 14 days out, `rsvp`.
  assert.equal(view('guest').previewHref, '/maria-and-jomar?phase=rsvp');
  // The seat-holder rides the SHIPPED fabricated guest, not a real one.
  assert.equal(view('named_guest').previewHref, '/maria-and-jomar?phase=rsvp&as=replied');
});

test('the guest door follows the LIVE stage, never a page the couple has not launched', () => {
  const monthsOut: HubEventRead = { ...EVENT, eventDate: '2027-03-15' };
  assert.equal(
    view('guest', { read: monthsOut }).previewHref,
    '/maria-and-jomar?phase=save_the_date',
  );
});

test('no slug ⇒ no door anywhere — never a link to `/null`', () => {
  const noSlug: HubEventRead = { ...EVENT, slug: null };
  for (const role of HUB_ROLES) {
    assert.equal(view(role, { read: noSlug }).previewHref, null, `${role} must have no door`);
    assert.ok(view(role, { read: noSlug }).headline.length > 0, `${role} still describes itself`);
  }
});

test('an UNREAD event withdraws every door — we do not guess which page is live', () => {
  const refused: HubEventRead = { ...EVENT, measured: false };
  for (const role of HUB_ROLES) {
    assert.equal(view(role, { read: refused }).previewHref, null, `${role} must have no door`);
  }
});

// ── 4 · UNREAD ≠ EMPTY, ON THE ROLE CARDS TOO ──────────────────────────────

test('a guest list the host never shared says so — NOT a zero, NOT an empty state', () => {
  const notShared: HubGuestRead = { shared: false, measured: false, invited: 0, replied: 0 };
  const cell = view('guest', { guests: notShared }).cells[2];
  assert.equal(cell.text, NOT_SHARED);
  assert.equal(cell.known, true, 'not-shared is a FACT we may state');
  assert.doesNotMatch(cell.text, /\b0\b/, 'a withheld list must never render as zero');
});

test('a REFUSED guest read is a third state — unknown, and it says only that', () => {
  const refused: HubGuestRead = { shared: true, measured: false, invited: 0, replied: 0 };
  const cell = view('guest', { guests: refused }).cells[2];
  assert.equal(cell.known, false, 'unknown must reach the render');
  assert.notEqual(cell.text, NOT_SHARED, 'refused is not the same fact as not-shared');
  assert.doesNotMatch(cell.text, /\b0\b/);
});

test('a real, measured zero is spoken plainly — the honest read still works', () => {
  const allIn: HubGuestRead = { shared: true, measured: true, invited: 90, replied: 90 };
  const cell = view('guest', { guests: allIn }).cells[2];
  assert.equal(cell.known, true);
  assert.match(cell.text, /Everyone has replied/i);
});
