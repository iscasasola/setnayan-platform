/**
 * a-guest-who-passed-away-shows-only-what-applies.test.ts — THE CARD OF A GUEST WHO PASSED AWAY SHOWS ONLY WHAT STILL APPLIES,
 * AND THE CARD NEVER DRAWS TWO HAIRLINES TOGETHER (owner 2026-11-04, DECISION_LOG "A GUEST WHO PASSED AWAY: THE CARD SHOWS ONLY
 * WHAT STILL APPLIES").
 *
 * Owner, verbatim: *"if passed away, there are parts in the guest card that doesn't need to show. Additional Guest, RSVP, Photos,
 * Seat Plan, Note, Access and QR"* — and *"i see a double line in between access and not counted for"*.
 *
 * It renders the REAL card (`GuestCardBody`, the shipped kit, the shipped Invite / ticket / ⋯ / Delete pieces) and holds:
 *   (a) passed away → the seven parts are not drawn; Basic Info, Details, Passed Away and Delete are;
 *   (b) not passed away → every one of them is drawn;
 *   (c) hiding a part clears nothing: the form the card posts while a part is hidden makes `updateGuest` write NOTHING it did
 *       not write before — measured with the save's own merge (`guestCardMerge`), both ways (switched on, switched off);
 *   (d) no two hairlines touch — a PROPERTY of the drawn tree (which element draws a top / bottom rule, `first:` / `last:`
 *       applied the way CSS applies them), in light and dark, over every state here. Never a class string.
 *
 * SABOTAGE (each seen RED, then restored, 2026-11-04): the old file → (a) and eight (d) states red · the parts hidden with
 * nothing carried → both (c) red · one carrier dropped (`notes`) → both (c) red · the "Not counted for" marker moved back above
 * its row → eight (d) states red · Passed Away's rule kept with no Delete below it → the four Maker (d) states red.
 * ((c) is green on the old file because nothing was hidden there — a hiding that clears is what it is for.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { GuestRow } from '@/lib/guests';

(globalThis as unknown as { React: unknown }).React = React;

// `server-only` / `client-only` resolve to an empty module, as in the-card-posts-the-same-form.test.ts.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_passed_away__.js');
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

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

/* ── the guest, every part of the card filled ─────────────────────────────────────────────────────────────────────────── */

function guest(over: Partial<GuestRow> = {}): GuestRow {
  return {
    guest_id: 'g-ana', event_id: 'e1', first_name: 'Ana', last_name: 'Cruz', name_prefix: null, middle_name: null, name_suffix: null,
    display_name: null, role: 'guest', side: 'bride', rsvp_status: 'attending', rsvp_set_by: 'host', group_category: 'family',
    meal_preference: 'fish', dietary_restrictions: 'no nuts', invited_to_blocks: ['ceremony', 'reception'], custom_tags: [], extra_roles: [],
    plus_one_allowed: true, plus_one_count: 2, photo_consent: true, faceblock_enabled: true, face_recognition_excluded: true,
    passed_away: false, attire: 'neutral', seniority_rank: 4, relation: 'Lola', email: 'ana@example.com',
    notes: 'Driver drops her at the side gate', host_note_for_guest: 'We saved you a seat beside Lola', guest_note: null,
    qr_token: 'tok', mobile: '0917 555 0101', entry_source: 'host_seeded', invitation_sent_at: null, plus_one_of_guest_id: null,
    ...over,
  } as unknown as GuestRow;
}

const DATA = {
  isCouple: false, hasSides: true, availableRoles: ['guest', 'best_man'], groupOptions: ['family', 'other'], isIncWedding: false,
  showTeaCeremony: false, plusOneLines: ['named — Ben', 'to come'], plusOnePeople: null, plusOneGuestId: null,
  initialInvited: ['ceremony', 'reception'], seatedAt: 'Table 2', customGroups: [], recordedAt: 'Sep 12',
  access: { level: 'guest' }, canManageAccess: true, offersThisIsMe: false, nameLinked: false,
  linkedAccount: { email: 'ana@example.com', memberType: 'guest' }, profileName: null, roleNames: {},
  tables: [{ tableId: 't-1', label: 'Table 1' }, { tableId: 't-2', label: 'Table 2' }], seatTableId: 't-2',
  groupChoices: { options: [{ groupId: 'grp-b', label: 'Barkada', teamSide: 'both' }], memberIds: ['grp-b'] },
  outfit: { wear: 'Filipiniana', from: 'from Guests’ dress code' },
  inviteChapters: { chapters: [{ block_id: 'ch-cer', label: 'Ceremony' }, { block_id: 'ch-aft', label: 'After party' }], notInvited: ['ch-cer'], tag: 'After party only' },
  notCounted: { services: [{ id: 'svc-cat', label: 'Catering', shop: 'Lola’s Kitchen' }], picked: [] },
};

type State = { guest?: Partial<GuestRow>; data?: Record<string, unknown>; maker?: boolean };

/** The card as the Guest list draws it (its Invite, ticket, ⋯ and Delete handed in) — or, `maker`, as the Maker does (none). */
async function paint(s: State = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { ToastProvider } = await import('@/app/_components/toast/toast-provider');
  const { GuestCardBody } = await import('./guest-card-body');
  const { GuestInviteCell } = await import('./guest-invite-cell');
  const { GuestDeleteControl, GuestMoreMenu, GuestTicketThumb } = await import('./guest-ticket-parts');
  const parts = s.maker
    ? {}
    : {
        inviteSetup: { facts: { hostsName: 'Maria & Jose', eventWord: 'wedding', eventDate: '2026-12-12', datePrecision: 'day' }, template: null, slug: 'x' },
        SendInvite: GuestInviteCell, TicketThumb: GuestTicketThumb, MoreMenu: GuestMoreMenu, DeleteControl: GuestDeleteControl,
      };
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data: { ...DATA, ...s.data, guest: guest(s.guest) }, invitationBase: 'https://www.setnayan.com/ana-and-ben',
    photoDisplayUrl: null, variant: 'panel', headerShown: true, returnTo: '/dashboard/e1/guests', errorMessage: null, inviteFlash: null,
    ...parts,
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, React.createElement(ToastProvider as React.FC<{ children: React.ReactNode }>, null, card)));
}

const AWAY: State = { guest: { passed_away: true } };

/* ── (a) (b) what is drawn ──────────────────────────────────────────────────────────────────────────────────────────── */

/** The seven parts the owner named, each by the mark its own component draws. */
const HIDDEN_WHEN_AWAY: Array<[string, RegExp]> = [
  ['Additional Guests', /data-fold="card-additional-guests"/],
  ['RSVP Status', /data-fold="card-rsvp-status"/],
  ['Papic / Photos', /data-fold="card-(?:papic|photos)"/],
  ['Seat Plan', /data-fold="card-seat-plan"/],
  ['Note for them · Private note', /data-fold="card-note-for-them-private-note"/],
  ['Access', /data-fold="card-access"/],
  ['Access › Account', /data-form-row="card-account"/],
  ['Access › Give / Take back the seat', /data-seat-doors=""/],
  ['the ticket / QR', /data-guest-ticket-thumb=""|src="\/api\/pass-card[^"]*"|aria-label="[^"]*’s ticket"|alt="[^"]*(?:'|&#x27;)s ticket"/],
  ['the Invite pair', /data-guest-invite-pair=/],
  /* Write to NFC is the ⋯ row's own button (`GuestMoreMenu`), drawn only in a browser that can write a tag — so it is held
     through the row that holds it: New QR beside it, and the ⋯. */
  ['⋯ row › New QR', /Make a new QR for/],
  ['the ⋯', /data-guest-more-menu=""/],
];
const ALWAYS: Array<[string, RegExp]> = [
  ['Basic Info', /data-fold="card-basic-info"/],
  ['Details', /data-fold="card-details"/],
  ['Passed Away', /data-card-passed-away=""[\s\S]*data-card-field="passed_away"/],
  ['Delete', /data-fold="card-(?:reset-)?delete"[\s\S]*data-guest-delete-control=""/],
];

test('(a) a guest who passed away: the seven parts are not drawn — Basic Info, Details, Passed Away and Delete are', async () => {
  const html = await paint(AWAY);
  for (const [what, re] of HIDDEN_WHEN_AWAY) assert.doesNotMatch(html, re, `${what} is still drawn for a guest who passed away`);
  for (const [what, re] of ALWAYS) assert.match(html, re, `${what} is not drawn for a guest who passed away`);
  // The name stays (the panel's header) and so does the status line, which already says why nothing is sent.
  assert.match(html, /data-guest-invite-status=""[^>]*>[^<]*Not sent · passed away/, 'the status line no longer says “Not sent · passed away”');
  // The Maker's card (no ticket view handed in) draws a plain ticket image — that goes too.
  const maker = await paint({ ...AWAY, maker: true });
  assert.doesNotMatch(maker, /<img\b[^>]*alt="[^"]*(?:'|&#x27;)s ticket"/, 'the Maker’s card still draws the ticket of a guest who passed away');
});

test('(b) a guest who did not pass away: every one of those parts is drawn (anti-vacuity for (a))', async () => {
  const html = await paint();
  for (const [what, re] of [...HIDDEN_WHEN_AWAY, ...ALWAYS]) assert.match(html, re, `${what} is not drawn for a living guest`);
  assert.match(await paint({ maker: true }), /<img\b[^>]*alt="[^"]*(?:'|&#x27;)s ticket"/, 'the Maker’s card draws no ticket');
});

test('(b) the couple never has Passed Away, and their card keeps every part it had', async () => {
  const html = await paint({ guest: { role: 'bride', side: 'bride', plus_one_count: 0, plus_one_allowed: false }, data: { isCouple: true } });
  assert.doesNotMatch(html, /data-card-passed-away=""/);
  for (const re of [/data-fold="card-rsvp-status"/, /data-fold="card-(?:papic|photos)"/, /data-fold="card-seat-plan"/, /data-fold="card-note-for-them-private-note"/, /data-fold="card-access"/]) {
    assert.match(html, re);
  }
});

/* ── (c) nothing is cleared ─────────────────────────────────────────────────────────────────────────────────────────── */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e.toLowerCase()] ?? m),
  );
function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = tag.replace(/^<[\w:-]+/, '').replace(/\/?>$/, '');
  for (const m of body.matchAll(/([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) out[m[1]!] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

/** What `new FormData(<the autosave form>)` holds — the browser's rule, the form's own controls and those naming it by `form=`. */
function postedForm(html: string): FormData {
  const at = html.indexOf('name="quiet"');
  assert.ok(at > 0, 'the autosave form (quiet=1) is not on the page');
  const open = html.lastIndexOf('<form', at);
  const close = html.indexOf('</form>', at);
  const formId = attrsOf(html.slice(open, html.indexOf('>', open) + 1)).id;
  const fd = new FormData();
  const tags = [
    ...html.slice(open, close).matchAll(/<(input|textarea)\b[^>]*>/g),
    ...[...(html.slice(0, open) + html.slice(close)).matchAll(/<(input|textarea)\b[^>]*>/g)].filter((m) => formId && attrsOf(m[0]).form === formId),
  ];
  for (const m of tags) {
    const a = attrsOf(m[0]);
    if (!a.name || 'disabled' in a || (a.form && a.form !== formId)) continue;
    if (m[1] === 'textarea') {
      const rest = html.slice(m.index! + m[0].length);
      fd.append(a.name, decode(rest.slice(0, rest.indexOf('</textarea>'))));
      continue;
    }
    const type = (a.type ?? 'text').toLowerCase();
    if (['submit', 'button', 'reset', 'image', 'file'].includes(type)) continue;
    if (type === 'checkbox' || type === 'radio') {
      if ('checked' in a) fd.append(a.name, a.value ?? 'on');
      continue;
    }
    fd.append(a.name, a.value ?? '');
  }
  return fd;
}

/** A form as the autosave sends it: the fields, and the card it started from (`base`, `withBase` in guest-card-autosave.tsx). */
async function postFrom(fields: FormData, from: FormData): Promise<FormData> {
  const { fieldsOf } = await import('./guest-card-autosave');
  const { MERGE_BASE_FIELD } = await import('@/lib/merge-base-field');
  const out = new FormData();
  for (const [k, v] of fields.entries()) out.append(k, v);
  out.set(MERGE_BASE_FIELD, JSON.stringify(Object.fromEntries(fieldsOf(from))));
  return out;
}
const withSwitch = (fd: FormData, on: boolean) => {
  const out = new FormData();
  for (const [k, v] of fd.entries()) if (k !== 'passed_away') out.append(k, v);
  if (on) out.append('passed_away', 'on');
  return out;
};

/**
 * The fields whose write `updateGuest` gates on a `*_posted` marker — absent marker, nothing written. Only these may differ
 * between the two cards: the Table (never drawn while they passed away — `updateGuest` also refuses to seat them) and
 * "Not counted for" (a guest who passed away is counted for nothing already).
 */
const MARKER_GATED: Record<string, readonly string[]> = { table_posted: ['table_id'], not_counted_posted: ['not_counted_for'] };

async function whatTheSaveWrites(post: FormData, row: Record<string, unknown>) {
  const { guestCardMerge, guestColumnWritten, GUEST_COLUMN_FIELDS, MERGE_BASE_FIELD } = await import('@/lib/guest-card-merge');
  const merge = guestCardMerge(post.get(MERGE_BASE_FIELD), post, row);
  return { merge, columns: Object.keys(GUEST_COLUMN_FIELDS).filter((c) => guestColumnWritten(c, merge)) };
}

/** Whatever differs is a marker-gated field whose marker this post does not carry — the save leaves it as it is. */
async function onlyMarkerGated(changed: Set<string>, post: FormData, when: string) {
  const { NOT_COUNTED_POSTED, NOT_COUNTED_FIELD } = await import('@/lib/guest-not-counted');
  assert.deepEqual([NOT_COUNTED_POSTED, NOT_COUNTED_FIELD], ['not_counted_posted', 'not_counted_for'], 'the not-counted field names moved — update MARKER_GATED');
  const gated = Object.entries(MARKER_GATED).filter(([marker]) => !post.has(marker)).flatMap(([marker, fields]) => [marker, ...fields]);
  const stray = [...changed].filter((f) => f !== 'passed_away' && !gated.includes(f));
  assert.deepEqual(stray, [], `${when}: the save would rewrite ${stray.join(', ')} — a hidden part cleared its saved value`);
}

test('(c) switching Passed Away ON, then saving again with the parts hidden, clears nothing', async () => {
  const row = { ...guest({ passed_away: true }) } as unknown as Record<string, unknown>;
  // The tap: the card as it was drawn, the switch flipped on — the save the autosave sends first.
  const drawn = withSwitch(postedForm(await paint()), true);
  // The card redraws with the parts hidden; the next save (any edit) starts from the last card sent.
  const hidden = postedForm(await paint(AWAY));
  assert.equal(hidden.get('passed_away'), 'on', 'the hidden card no longer posts its Passed Away');
  const { merge, columns } = await whatTheSaveWrites(await postFrom(hidden, drawn), row);
  await onlyMarkerGated(merge.changed, hidden, 'after Passed Away was switched on');
  assert.deepEqual(columns, [], `the next save writes ${columns.join(', ')} over what is stored`);
  // A post with no base (an older page) is written whole: then the VALUES must be the very ones the drawn card posts.
  for (const [k, v] of drawn.entries()) {
    if (Object.values(MARKER_GATED).flat().includes(k) || k in MARKER_GATED) continue;
    assert.deepEqual(hidden.getAll(k), drawn.getAll(k), `the hidden card posts ${k} differently (${JSON.stringify(drawn.getAll(k))} → ${JSON.stringify(hidden.getAll(k))})`);
    void v;
  }
});

test('(c) switching Passed Away OFF brings every part back, still holding what was stored', async () => {
  const row = { ...guest({ passed_away: false }) } as unknown as Record<string, unknown>;
  // The tap on the hidden card: its form, the switch flipped off.
  const tapped = withSwitch(postedForm(await paint(AWAY)), false);
  // The save lands, the page revalidates, every part is drawn again — and the next save starts from the tap's card.
  const back = await paint();
  for (const [what, re] of HIDDEN_WHEN_AWAY) assert.match(back, re, `${what} did not come back`);
  const drawn = postedForm(back);
  const { merge, columns } = await whatTheSaveWrites(await postFrom(drawn, tapped), row);
  await onlyMarkerGated(merge.changed, tapped, 'after Passed Away was switched off');
  assert.deepEqual(columns, [], `the save after it came back writes ${columns.join(', ')} over what is stored`);
});

test('(c) anti-vacuity: the hidden parts really carry values a clearing save would destroy', async () => {
  const drawn = postedForm(await paint());
  const carried: Array<[string, string]> = [['plus_one_count', '2'], ['rsvp_status', 'attending'], ['meal_preference', 'fish'], ['dietary_restrictions', 'no nuts'], ['photo_consent', 'on'], ['faceblock_enabled', 'on'], ['face_recognition_excluded', 'on'], ['notes', 'Driver drops her at the side gate'], ['host_note_for_guest', 'We saved you a seat beside Lola'], ['invited_ceremony', 'on'], ['invited_chapters', 'ch-aft']];
  for (const [k, v] of carried) {
    assert.equal(drawn.get(k), v, `the drawn card does not post ${k}=${v} — the fixture no longer exercises it`);
  }
  // And the merge DOES see a dropped field: a card that stopped carrying `notes` would write it.
  const stripped = postedForm(await paint(AWAY));
  stripped.delete('notes');
  const { columns } = await whatTheSaveWrites(await postFrom(stripped, withSwitch(drawn, true)), guest({ passed_away: true }) as unknown as Record<string, unknown>);
  assert.ok(columns.includes('notes'), 'the merge no longer notices a field the card stopped posting — (c) would pass vacuously');
});

/* ── (d) one hairline between groups ────────────────────────────────────────────────────────────────────────────────── */

type El = { tag: string; attrs: Record<string, string>; kids: Array<El | string> };
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** React's static markup as a tree (it is well formed: every non-void tag closes). */
function tree(html: string): El {
  const root: El = { tag: '#root', attrs: {}, kids: [] };
  const stack = [root];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|([^<]+)/g)) {
    const top = stack[stack.length - 1]!;
    if (m[1]) {
      const at = stack.map((e) => e.tag).lastIndexOf(m[1]);
      if (at > 0) stack.length = at;
    } else if (m[2]) {
      const el: El = { tag: m[2], attrs: attrsOf(m[0]), kids: [] };
      top.kids.push(el);
      if (!VOID.has(m[2]) && !m[4]) stack.push(el);
    } else if (m[5]) top.kids.push(decode(m[5]));
  }
  return root;
}

/**
 * The card as a reader sees it, top to bottom: each hairline and each thing drawn between them. A rule is a horizontal border
 * an element really draws at 390 px (no `sm:`+) — `border-t` / `border-b` / `border-y` / `divide-y`, minus `…-0`, with `first:` /
 * `last:` decided the way CSS decides them (every element child counts, a hidden input too) and `dark:` only in dark. Nothing
 * inside a shut fold (`grid-rows-[0fr]`), a `hidden` / `sr-only` element or a hidden input is seen.
 */
function seen(root: El, dark: boolean): Array<{ rule: string } | 'content'> {
  const out: Array<{ rule: string } | 'content'> = [];
  const walk = (el: El, first: boolean, last: boolean, divided: boolean, where: string) => {
    const cls = (el.attrs.class ?? '').split(/\s+/).filter(Boolean);
    if ('hidden' in el.attrs || cls.includes('sr-only') || cls.includes('hidden') || (el.tag === 'input' && el.attrs.type === 'hidden')) return;
    let top = divided && !first;
    let bottom = false;
    let divides = false;
    for (const raw of cls) {
      const parts = raw.split(':');
      const tok = parts.pop()!;
      const pre = parts.join(':');
      if (pre && !(pre === 'first' && first) && !(pre === 'last' && last) && !(pre === 'dark' && dark)) continue;
      if (/^border-[ty](?:-(?:[1-9]\d*|\[.+\]))?$/.test(tok)) top = true;
      if (/^border-[by](?:-(?:[1-9]\d*|\[.+\]))?$/.test(tok)) bottom = true;
      if (tok === 'border-t-0' || tok === 'border-y-0') top = false;
      if (tok === 'border-b-0' || tok === 'border-y-0') bottom = false;
      if (/^divide-y(?:-(?:[1-9]\d*|\[.+\]))?$/.test(tok)) divides = true;
    }
    const name = `${el.tag}${Object.entries(el.attrs).filter(([k]) => k.startsWith('data-')).map(([k, v]) => `[${k}${v ? `=${v}` : ''}]`).join('')}`;
    if (top) out.push({ rule: `top of ${name} (in ${where})` });
    if (['svg', 'img', 'button', 'textarea'].includes(el.tag) || (el.tag === 'input' && !cls.includes('sr-only'))) out.push('content');
    const shut = cls.includes('grid-rows-[0fr]');
    if (!shut && !['svg', 'button'].includes(el.tag)) {
      const els = el.kids.filter((k): k is El => typeof k !== 'string');
      for (const k of el.kids) {
        if (typeof k === 'string') {
          if (k.trim()) out.push('content');
          continue;
        }
        walk(k, els[0] === k, els[els.length - 1] === k, divides, name);
      }
    }
    if (bottom) out.push({ rule: `bottom of ${name} (in ${where})` });
  };
  walk(root, true, true, false, '#root');
  return out;
}

/** Two hairlines with nothing drawn between them — a double line. */
function doubleLines(html: string, dark: boolean): string[] {
  const seq = seen(tree(html), dark);
  const out: string[] = [];
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1]!;
    const b = seq[i]!;
    if (a !== 'content' && b !== 'content') out.push(`${a.rule}  ⟂  ${b.rule}`);
  }
  return out;
}

const SEAM_STATES: Record<string, State> = {
  'a guest, every part drawn, a booked service to leave out (Access → Not counted for → Passed Away → Delete)': {},
  'a guest, nothing booked (Access → Passed Away → Delete)': { data: { notCounted: { services: [], picked: [] } } },
  'a guest who passed away (Details → Passed Away → Delete)': AWAY,
  'a guest whose own note opens RSVP by itself': { guest: { guest_note: 'See you there!' } },
  'a guest with no account (no Account ⋯)': { data: { linkedAccount: null } },
  'the couple (Access → Delete)': { guest: { role: 'bride', side: 'bride', plus_one_count: 0, plus_one_allowed: false }, data: { isCouple: true } },
  'the Maker’s card — no Delete handed in (Passed Away is the last group)': { maker: true },
  'the Maker’s card of a guest who passed away': { ...AWAY, maker: true },
};

for (const [name, state] of Object.entries(SEAM_STATES)) {
  for (const dark of [false, true]) {
    test(`(d) one hairline between groups — ${name}, ${dark ? 'dark' : 'light'}`, async () => {
      assert.deepEqual(doubleLines(await paint(state), dark), [], 'two hairlines touch');
    });
  }
}

test('(d) anti-vacuity: the reader sees the hairlines, honours first: as CSS does, and catches a double line', async () => {
  const seq = seen(tree(await paint()), false).filter((e) => e !== 'content');
  assert.ok(seq.length >= 9, `only ${seq.length} hairlines seen on a full card — the reader is blind`);
  // A row first in its box draws no top rule; behind a hidden input it is not first, and does.
  const row = '<div class="border-t border-ink/10 first:border-t-0"><span>Row</span></div>';
  assert.deepEqual(doubleLines(`<div class="border-b"><span>A</span></div><div>${row}</div>`, false), []);
  assert.equal(doubleLines(`<div class="border-b"><span>A</span></div><div><input type="hidden" name="x" value="1"/>${row}</div>`, false).length, 1);
  // Nothing inside a shut fold is seen; dark-only rules count only in dark.
  assert.equal(doubleLines('<div class="border-b"><b>A</b></div><div class="grid grid-rows-[0fr]"><div class="border-t"><b>x</b></div></div><div class="border-t"><b>B</b></div>', false).length, 1);
  assert.deepEqual(doubleLines('<div class="border-b"><b>A</b></div><div class="dark:border-t"><b>B</b></div>', false), []);
  assert.equal(doubleLines('<div class="border-b"><b>A</b></div><div class="dark:border-t"><b>B</b></div>', true).length, 1);
});
