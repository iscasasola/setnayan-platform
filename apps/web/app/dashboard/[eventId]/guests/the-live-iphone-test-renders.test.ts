/**
 * RENDER GUARDS — the second batch of the owner's live iPhone test (2026-10-02/03),
 * checked on what the components actually DRAW, not on their source text.
 *
 *   ⑥ The card's Reply dropdown did not stick (every FormPick posted its old value).
 *   ⑦ A swiped Delete came back silently; delete is now allowed in any reply
 *      state, behind ONE in-page warning, from the card, the swipe and the bar.
 *   ⑧ Home's "coming / no reply" read differently from the Guests list?
 *   ⑨ The guest's mobile was buried in a closed row.
 *   ⑩ "The card inside a frame inside the popup" — three nested frames.
 *   ⑪ The card's header scrolls away; the × is an oval.
 *   ⑫ The Guests page top: uneven gaps, a floating Finalize button.
 *
 * 🛡 Sabotaged once (see the PR): putting `rounded-2xl border` back on the
 * ticket section turns ⑩ red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { computeGuestStats, fetchGuestsByEventMeasured, type GuestRow } from '@/lib/guests';

(globalThis as unknown as { React: unknown }).React = React;

// `server-only` / `client-only` resolve to an empty module, as in home-numbers-move.test.ts.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_live_iphone__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

function guest(over: Partial<GuestRow> = {}): GuestRow {
  return {
    guest_id: 'g-ana',
    event_id: 'e1',
    first_name: 'Ana',
    last_name: 'Cruz',
    role: 'guest',
    side: 'both',
    rsvp_status: 'attending',
    group_category: 'other',
    meal_preference: 'no_preference',
    invited_to_blocks: [],
    custom_tags: [],
    extra_roles: [],
    qr_token: 'tok',
    mobile: '0917 555 0101',
    entry_source: 'host_seeded',
    ...over,
  } as unknown as GuestRow;
}

async function paintCard(over: Partial<GuestRow> = {}, opts: { withMenu?: boolean } = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestCardBody } = await import('./_components/guest-card-body');
  const { GuestMoreMenu } = await import('./_components/guest-ticket-parts');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const g = guest(over);
  const data = {
    guest: g,
    isCouple: g.role === 'bride' || g.role === 'groom',
    hasSides: false,
    availableRoles: ['guest'],
    groupOptions: ['other'],
    isIncWedding: false,
    showTeaCeremony: false,
    plusOneStateLabel: null,
    plusOneGuestId: null,
    initialInvited: [],
    seatedAt: null,
    customGroups: [],
    recordedAt: null,
    access: null,
    canManageAccess: true,
    offersThisIsMe: false,
    nameLinked: false,
    linkedAccount: null,
    profileName: null,
    roleNames: {},
    tables: [],
    seatTableId: null,
    groupChoices: { options: [], memberIds: [] },
  };
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1',
    data,
    invitationBase: 'https://www.setnayan.com/ana-and-ben',
    photoDisplayUrl: null,
    variant: 'panel',
    headerShown: true,
    returnTo: '/dashboard/e1/guests',
    errorMessage: null,
    inviteFlash: null,
    ...(opts.withMenu ? { MoreMenu: GuestMoreMenu } : {}),
  });
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(ToastProvider as React.FC<{ children: React.ReactNode }>, null, card),
    ),
  );
}

/** Opening tags whose class draws a FULL frame: a rounded box with a border on every side. */
function framedContainers(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<(div|section|aside|article|fieldset)\b[^>]*\bclass="([^"]*)"/g)) {
    const cls = ` ${m[2]} `;
    const rounded = /\srounded-(?:md|lg|xl|2xl|3xl)\s/.test(cls);
    const fullBorder = /\sborder\s/.test(cls);
    if (rounded && fullBorder) out.push(m[0]);
  }
  return out;
}

// ── ⑥ the card's dropdowns post what was picked ─────────────────────────────
test('⑥ every card dropdown posts its PICKED value — the hidden input is driven by state, not defaultValue', () => {
  // On a hidden input the default IS the value, and React re-applies
  // `defaultValue` on every re-render (react-dom `updateInput` →
  // `setDefaultValue`), so the re-render a pick causes put the server's old
  // answer back before the autosave read the form: Reply "No reply" saved as
  // "Attending" with `updated_at` moving. Driven by `current`, the re-render
  // writes the pick.
  const fields = read('_components', 'card-fields.tsx');
  const pick = fields.slice(fields.indexOf('export function FormPick('));
  const hidden = pick.match(/<input\b[^>]*type="hidden"[^>]*data-form-pick=""[^>]*\/>/);
  assert.ok(hidden, 'FormPick lost its hidden input');
  assert.match(hidden[0], /\bvalue=\{current\}/, 'the hidden input is not driven by the picked value');
  assert.doesNotMatch(hidden[0], /defaultValue=/, 'defaultValue on a hidden input resets the pick on every re-render');
  assert.match(pick, /setCurrent\(next\)/, 'a pick no longer moves the state the input reads');
});

test('⑥ the card renders its Reply as the guest’s current answer, inside the autosaving form', async () => {
  const html = await paintCard({ rsvp_status: 'pending' });
  const form = html.slice(html.indexOf('<form'), html.lastIndexOf('</form>'));
  assert.match(form, /<input[^>]*name="rsvp_status"[^>]*value="pending"|<input[^>]*value="pending"[^>]*name="rsvp_status"/, 'the Reply posts something other than the answer on file');
});

// ── ⑦ delete, any reply, one warning ────────────────────────────────────────
test('⑦ the warning names what goes with them, in page — Delete and Cancel', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DeleteGuestSheet, deleteWarningText } = await import('./_components/guest-delete');
  const html = renderToStaticMarkup(
    React.createElement(DeleteGuestSheet, { open: true, names: ['Ana Cruz'], onConfirm() {}, onClose() {} }),
  );
  assert.match(html, /Delete Ana Cruz\?/);
  assert.match(html, /Their reply and answers, seat, \+1, song request and the link to their account go with them\./);
  assert.match(html, /data-guest-delete-confirm=""[^>]*>Delete</);
  assert.match(html, />Cancel</);
  assert.equal(deleteWarningText(['A', 'B', 'C']).title, 'Delete 3 guests?', 'the selection does not get ONE warning for all of them');
  const refused = renderToStaticMarkup(
    React.createElement(DeleteGuestSheet, { open: true, names: ['Ana Cruz'], error: 'Nope.', onConfirm() {}, onClose() {} }),
  );
  assert.match(refused, /role="alert"[^>]*>Nope\.</, 'a refused delete is not said where the host pressed Delete');
});

test('⑦ an ACCEPTED guest’s card offers Delete in its ⋯; the couple’s does not', async () => {
  const accepted = await paintCard({ rsvp_status: 'attending' }, { withMenu: true });
  // Each ⋯ line leads with its icon (owner 2026-10-04), so an <svg> may sit before the words.
  assert.match(accepted, /data-guest-delete=""[^>]*>(?:<svg[\s\S]*?<\/svg>)?Delete guest</, 'an attending guest’s card has no Delete');
  const couple = await paintCard({ role: 'bride', rsvp_status: 'attending' }, { withMenu: true });
  assert.doesNotMatch(couple, /data-guest-delete=""/, 'the couple’s card offers a Delete that can only fail');
});

test('⑦ swipe, bar and card all go through the one warning and the one delete with Undo', () => {
  const list = read('_components', 'guest-list-multiselect.tsx');
  const swipe = list.slice(list.indexOf('function SwipeToDelete('));
  assert.match(swipe.slice(0, swipe.indexOf('function GroupChipList(')), /<DeleteGuestSheet\b/, 'the swipe deletes without the warning');
  const bar = list.slice(list.indexOf('function RosterBulkBar('), list.indexOf('function NewGroupInlineForm('));
  assert.match(bar, /<DeleteGuestSheet\b/, 'the selection bar deletes without the warning');
  assert.match(bar, /label: `Delete \$\{formatCount\(count\)\}/, 'the bar does not say "Delete N guests"');
  const del = read('_components', 'guest-delete.tsx');
  const hook = del.slice(del.indexOf('export function useGuestRemoval('), del.indexOf('export function DeleteGuestSheet('));
  assert.match(hook, /pushUndo\(/, 'a delete with no Undo');
  assert.match(hook, /restoreDeletedGuests\(/, 'Undo does not restore the guest');
  assert.match(hook, /if \(!result\.ok\)[\s\S]{0,200}toast\.error\(result\.error\)[\s\S]{0,40}return result\.error/, 'a refusal is swallowed again');
  const action = read('groups-actions.ts');
  const fn = action.slice(action.indexOf('export async function bulkSoftDeleteGuestsForUndo('), action.indexOf('export async function restoreDeletedGuests('));
  assert.match(fn, /\.in\('plus_one_of_guest_id'/, 'their +1 stays behind although the warning says it goes with them');
});

// ── ⑧ Home and the Guests list count the same rows ─────────────────────────
type Row = Record<string, unknown>;
function fakeSupabase(rows: Row[]) {
  return {
    from() {
      const filters: ((r: Row) => boolean)[] = [];
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? false) === v), q),
        neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), q),
        is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), q),
        order: () => q,
        then: (ok: (x: { data: Row[]; error: null }) => unknown) => ok({ data: rows.filter((r) => filters.every((f) => f(r))), error: null }),
      };
      return q;
    },
  };
}

test('⑧ Home’s "coming / no reply" and the Guests list count the SAME rows — and move together', async () => {
  const live = (over: Row): Row => ({ ...guest(), deleted_at: null, passed_away: false, ...over });
  const rows: Row[] = [
    live({ guest_id: 'bride', role: 'bride', rsvp_status: 'attending' }),
    live({ guest_id: 'groom', role: 'groom', rsvp_status: 'attending' }),
    live({ guest_id: 'a', rsvp_status: 'attending' }),
    live({ guest_id: 'p', rsvp_status: 'pending' }),
    live({ guest_id: 'req', rsvp_status: 'attending', entry_source: 'self_added_unlisted' }),
    live({ guest_id: 'rip', rsvp_status: 'pending', passed_away: true }),
    live({ guest_id: 'gone', rsvp_status: 'attending', deleted_at: '2026-10-02T00:00:00Z' }),
  ];
  const counts = async (opts: Parameters<typeof fetchGuestsByEventMeasured>[2]) => {
    const r = await fetchGuestsByEventMeasured(fakeSupabase(rows) as never, 'e1', opts);
    const s = computeGuestStats(r.rows);
    // The read carries its own counts (root-map waves 2+3) — they must be these.
    assert.deepEqual(r.stats, s, 'the read\'s own stats are not computeGuestStats of its rows');
    return { coming: s.attending, noReply: s.pending };
  };
  // Home reads the accepted living list; the Guests list reads everything it draws.
  const home = await counts(undefined);
  const list = await counts({ includeRequests: true, includePassedAway: true });
  assert.deepEqual(home, list, 'Home and the Guests list disagree about the same event');
  // The basis: the couple counts, a request does not until kept, a deleted row never.
  assert.deepEqual(home, { coming: 3, noReply: 1 });
  // Move the input → the output moves, on both.
  (rows[3] as Row).rsvp_status = 'attending';
  (rows[4] as Row).entry_source = 'host_seeded';
  assert.deepEqual(await counts(undefined), { coming: 5, noReply: 0 });
  assert.deepEqual(await counts({ includeRequests: true, includePassedAway: true }), { coming: 5, noReply: 0 });
  // …and both pages really run this chain.
  const homePage = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));
  // Since root-map waves 2+3 both pages take the counts the read worked out ONCE
  // (`MeasuredGuests.stats` = computeGuestStats(rows), lib/guests.ts) — never a second count.
  assert.match(homePage, /fetchGuestsByEventMeasured\(supabase, eventId\)/);
  assert.match(homePage, /stats: guestStats \}/);
  const guestsPage = read('page.tsx');
  assert.match(guestsPage, /fetchGuestsByEventMeasured\(supabase, eventId, \{ includeRequests: true, includePassedAway: true \}\)/);
  assert.match(guestsPage, /const stats = guestsRead\.stats;/);
  assert.match(stripComments(readFileSync(join(HERE, '..', '..', '..', '..', 'lib', 'guests.ts'), 'utf8')), /return \{ rows, measured: true, stats: computeGuestStats\(rows\) \};/);
});

// ── ⑨ the mobile up front ───────────────────────────────────────────────────
test('⑨ the guest’s mobile is in the card’s first (open) section, not a closed row', async () => {
  const html = await paintCard();
  const first = html.slice(html.indexOf('data-guest-card-name=""'), html.indexOf('</section>', html.indexOf('data-guest-card-name=""')));
  assert.match(first, /name="mobile"[^>]*value="0917 555 0101"|value="0917 555 0101"[^>]*name="mobile"/, 'the mobile is not in the first section');
  assert.match(first, /type="tel"/, 'the mobile box does not bring up the phone keypad');
  assert.equal((html.match(/name="mobile"/g) ?? []).length, 1, 'the mobile is drawn twice');
});

// ── ⑩ no frame inside the frame; no explainer captions ──────────────────────
test('⑩ the card draws NO framed box — the panel is the only frame', async () => {
  const html = await paintCard({}, { withMenu: true });
  const frames = framedContainers(html.replace(/<div[^>]*role="menu"[\s\S]*?<\/div>/, ''));
  assert.deepEqual(frames, [], `the card draws a frame inside its panel:\n${frames.join('\n')}`);
  assert.doesNotMatch(html, /saves as you type/, 'the "saves as you type" caption is back');
  assert.doesNotMatch(html, /Tags are set from the fields above/, 'the Tags explainer caption is back');
});

test('⑩ inside the sheet the panel is plain content — no rail width, border or padding of its own', () => {
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  const rule = css.match(/\.sn-inspector-sheet \.sn-inspector-panel \{([^}]*)\}/)?.[1] ?? '';
  for (const decl of [/width:\s*auto/, /max-width:\s*100%/, /padding:\s*0/, /border:\s*0/, /box-shadow:\s*none/]) {
    assert.match(rule, decl, `the panel inside the sheet keeps a frame: missing ${decl}`);
  }
  assert.match(css, /@media \(min-width: 768px\) \{\s*\.sn-inspector-sheet \{ left: auto; width: min\(36rem/, 'from a tablet up the sheet is the whole window again');
});

// ── ⑪ the header stays; the × is round ──────────────────────────────────────
test('⑪ the card’s header is sticky (below the safe area), and its × is a circle', async () => {
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  const sticky = css.match(/\.sn-inspector-sheet \.sn-inspector-head \{\s*position: sticky;([^}]*)\}/);
  assert.ok(sticky, 'the card header scrolls away with the body');
  assert.match(sticky[1] ?? '', /top:\s*env\(safe-area-inset-top,\s*0px\)/, 'the sticky header sits under the phone’s status bar');
  assert.match(css, /\.sn-inspector-sheet \.sn-inspector-head\[data-scrolled='true'\] \{ border-bottom-color/, 'the divider is not tied to scrolling');
  const close = css.match(/\.sn-inspector-close \{([^}]*)\}/)?.[1] ?? '';
  const w = close.match(/\bwidth:\s*(\d+)px/)?.[1];
  const h = close.match(/\bheight:\s*(\d+)px/)?.[1];
  assert.ok(w && h && w === h, `the × is ${w} × ${h} — an oval`);
  assert.ok(Number(w) >= 44, 'the × is under the 44 px touch minimum');
  assert.match(close, /min-height:\s*0/, 'the base 44 px min-height can stretch the × into an oval again');

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InspectorColumn } = await import('@/app/_components/inspector/inspector-column');
  const html = renderToStaticMarkup(
    React.createElement(
      InspectorColumn as unknown as React.FC<Record<string, unknown>>,
      { eyebrow: 'Guest', title: 'Ana Cruz', badge: '✓ Attending', swapKey: 'g' },
      'body',
    ),
  );
  const head = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  for (const bit of ['Guest', 'Ana Cruz', '✓ Attending', 'Close details']) {
    assert.ok(head.includes(bit), `the sticky header is missing "${bit}"`);
  }
  assert.match(head, /data-scrolled="false"/, 'the header starts with its divider showing');
});

// ── ⑫ one spacing scale under the title ─────────────────────────────────────
test('⑫ every block under the title is one flex column with ONE gap — no per-block margins', async () => {
  const page = read('page.tsx');
  const open = page.indexOf('data-guests-blocks=""');
  assert.ok(open > 0, 'the blocks under the title are not one group');
  const tag = page.slice(page.lastIndexOf('<div', open), page.indexOf('>', open));
  assert.match(tag, /flex min-w-0 flex-col gap-4/, 'the blocks are not spaced by one gap');
  const blocks = page.slice(open, page.indexOf('<AddGuestSheet'));
  for (const piece of ['data-requests-strip=""', '<FinalizeGuestListControl', 'data-roster-head=""']) {
    assert.ok(blocks.includes(piece), `${piece} is not one of the evenly spaced blocks`);
  }
  assert.match(page, /className="sn-col max-w-none flex flex-col gap-6" data-roster-full-width=""/, 'the title row has no step after it');
  assert.doesNotMatch(page.slice(page.indexOf('data-roster-full-width'), open), /space-y-/, 'per-element margins are back above the blocks');
  assert.match(page, /<div className="gl-settle" data-roster-head="">/, 'the roster head brings its own spacing again');

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { FinalizeGuestListControl } = await import('./_components/finalize-guest-list-control');
  const html = renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(FinalizeGuestListControl, { eventId: 'e1', locked: false, finalPax: null }),
    ),
  );
  const row = html.match(/<div[^>]*data-guest-list-finalize="open"[^>]*class="([^"]*)"|<div[^>]*class="([^"]*)"[^>]*data-guest-list-finalize="open"/);
  const cls = row?.[1] ?? row?.[2] ?? '';
  for (const c of ['flex', 'flex-col', 'gap-3', 'sm:flex-row', 'sm:items-center', 'sm:justify-between']) {
    assert.ok(cls.split(/\s+/).includes(c), `the finalize row lacks ${c}`);
  }
  assert.doesNotMatch(cls, /\b(?:p[xy]?|m[tbxy]?)-\d/, 'the finalize row brings its own padding or margin');
  const button = html.match(/<button[^>]*data-guest-list-finalize-button=""[^>]*>/)?.[0] ?? '';
  for (const c of ['min-h-[44px]', 'rounded-full', 'w-full', 'sm:w-auto']) {
    assert.ok(button.includes(c), `the Finalize button lacks ${c}`);
  }
  const filterRow = read('_components', 'find-add-row.tsx');
  assert.doesNotMatch(filterRow, /border-ink\/\[0\.07\] py-/, 'the Filter row brings its own top padding again');
});

// ── ⑬ the row's ⋯ opens where it can be seen ────────────────────────────────
test('⑬ a phone row’s ⋯ list is drawn on the page, not clipped inside the row (RAGE_TAP "More for …")', () => {
  const menu = read('_components', 'guest-ticket-parts.tsx');
  const body = menu.slice(menu.indexOf('export function GuestMoreMenu('));
  assert.match(body, /portal \? createPortal\(node, portal\) : node/, 'the ⋯ list renders inside the row again');
  assert.match(body, /portalled\(\s*<div\s+ref=\{menuRef\}/, 'the ⋯ list is not the portalled element');
  assert.match(body, /className="fixed z-\[96\]/, 'the ⋯ list is not pinned to the screen');
  assert.match(body, /menuRef\.current\?\.contains\(t\)/, 'a tap inside the list counts as "outside" and closes it first');
  const list = read('_components', 'guest-list-multiselect.tsx');
  assert.match(list, /transform: tx === 0 && !dragging \? undefined :/, 'a resting row holds a transform, trapping its sheets inside it');
});
