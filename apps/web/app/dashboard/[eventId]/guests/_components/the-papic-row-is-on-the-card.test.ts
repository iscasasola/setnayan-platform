/**
 * the-papic-row-is-on-the-card.test.ts — 📸 PAPIC, ONE GUEST AT A TIME, ON THEIR CARD (owner 2026-10-23: *"do you think it is
 * better to set papic setting per guest on each guest card instead? … if on, then on guests, we can further customize it"*;
 * prototype `Setnayan-specs/prototypes/guest_card_groups_and_papic_2026-10-23.html`, frames 3–4).
 *
 *  1 · THE THREE CHOICES ARE THE SHIPPED CEILING, NOTHING NEW: Shares with everyone ⇄ no row (NULL) · A set number ⇄ N ≥ 1 ·
 *      No camera ⇄ 0 (`papic_guest_spend_ceilings`, "may not spend"). One writer: `setGuestAllotment`, quiet, one RPC per guest.
 *  2 · THE EVENT'S PAPIC OFF → ONE LINE, "Papic is off · Turn on ›" (the door to Home), and the face switches hidden — but
 *      their answers still POST (`updateGuest` writes every column it reads; a hidden switch must never clear one).
 *  3 · A FAILED READ NEVER RENDERS AS A CHOICE: a check that did not answer says so; a camera that could not be read offers
 *      no control (a couple must never save a choice worked out from a failure).
 *  4 · "Their camera ▾" never posts with the card's autosave form, and never enters the Maker's first load.
 *  5 · Select → Set… ▾ gains a Papic group only while the event's Papic is on, for the couple.
 *
 * SABOTAGE (each seen RED, then restored): the off branch's hidden carriers dropped · the camera drawn on an unread ceiling ·
 * a `name=` given to the camera's dropdown · the Papic options offered with Papic unknown · `guestCameraOf(0)` read as 'set'.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GuestRow } from '@/lib/guests';
import { stripComments } from '@/lib/strip-comments';
import { checkGuestCredits, guestCameraOf, guestCameraPost, guestCameraSummary, type GuestPapicState } from '@/lib/papic-guest-camera';

(globalThis as unknown as { React: unknown }).React = React;

type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_card_papic__.js');
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
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };
const FACE = ['photo_consent', 'faceblock_enabled', 'face_recognition_excluded'] as const;

function guest(over: Partial<GuestRow> = {}): GuestRow {
  return {
    guest_id: 'g-ana', event_id: 'e1', first_name: 'Ana', last_name: 'Cruz', name_prefix: null, middle_name: null, name_suffix: null, display_name: null,
    role: 'guest', side: 'both', rsvp_status: 'attending', group_category: 'other', meal_preference: 'no_preference', dietary_restrictions: null,
    invited_to_blocks: [], custom_tags: [], extra_roles: [], plus_one_allowed: false, plus_one_count: 0, photo_consent: false, faceblock_enabled: false,
    face_recognition_excluded: false, passed_away: false, attire: 'neutral', seniority_rank: null, relation: null, email: null, notes: null,
    guest_note: null, qr_token: 'tok', mobile: null, entry_source: 'host_seeded', invitation_sent_at: null, ...over,
  } as unknown as GuestRow;
}

async function paint(over: Partial<GuestRow>, papic: GuestPapicState | null, opts: { templated?: boolean; camera?: boolean; canManage?: boolean; storeShell?: boolean } = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestCardBody } = await import('./guest-card-body');
  const { TEMPLATE_KIT } = await import('./guest-card-template-kit');
  const { GuestPapicCamera } = await import('./guest-papic-camera');
  const data = {
    isCouple: false, hasSides: false, availableRoles: ['guest'], groupOptions: ['other'], isIncWedding: false, showTeaCeremony: false,
    plusOneLines: [], plusOneGuestId: null, initialInvited: [] as string[], seatedAt: null, customGroups: [] as Array<{ label: string }>,
    recordedAt: null, access: null, canManageAccess: opts.canManage ?? true, offersThisIsMe: false, nameLinked: false, linkedAccount: null,
    profileName: null, roleNames: {}, tables: null, seatTableId: null, groupChoices: null, guest: guest(over),
  };
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data, invitationBase: 'https://www.setnayan.com/ana-and-ben', photoDisplayUrl: null, variant: 'panel', headerShown: true,
    returnTo: '/dashboard/e1/guests', errorMessage: null, inviteFlash: null,
    ...(opts.templated ? { kit: TEMPLATE_KIT } : {}),
    ...(papic ? { papic } : {}),
    ...(opts.camera ? { PapicCamera: GuestPapicCamera } : {}),
    ...(opts.storeShell ? { storeShell: true } : {}),
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, card));
}

/** What the autosave form posts for the three face columns — a hidden input posts its value, a checkbox only when checked. */
function facePosted(html: string): Record<string, string[]> {
  const at = html.indexOf('name="quiet"');
  const form = html.slice(html.lastIndexOf('<form', at), html.indexOf('</form>', at));
  const out: Record<string, string[]> = {};
  for (const m of form.matchAll(/<input\b[^>]*>/g)) {
    const name = /\sname="([^"]+)"/.exec(m[0])?.[1];
    if (!name || !(FACE as readonly string[]).includes(name)) continue;
    const hidden = /\stype="hidden"/.test(m[0]);
    if (hidden || /\schecked(=|\s|\/|>)/.test(m[0])) (out[name] ??= []).push(/\svalue="([^"]*)"/.exec(m[0])?.[1] ?? 'on');
  }
  return out;
}

test('1 · the three choices ARE the shipped ceiling — NULL shares, 0 is no camera, N is a set number', () => {
  assert.equal(guestCameraOf(null), 'share');
  assert.equal(guestCameraOf(0), 'none');
  assert.equal(guestCameraOf(40), 'set');
  assert.equal(guestCameraPost('share'), '', 'sharing does not un-name them (a blank posts NULL)');
  assert.equal(guestCameraPost('none'), '0');
  assert.equal(guestCameraPost('set', 50), '50');
  assert.throws(() => guestCameraPost('set'), 'a set number without its figure was posted');
  assert.throws(() => guestCameraPost('set', 0), 'a set number of 0 is "No camera", never a set number');
  assert.deepEqual([guestCameraSummary(null), guestCameraSummary(0), guestCameraSummary(1), guestCameraSummary(1500)], ['Shares with everyone', 'No camera', '1 credit', '1,500 credits']);
  assert.equal(checkGuestCredits('50'), null);
  assert.ok(checkGuestCredits('0') && checkGuestCredits('2.5') && checkGuestCredits('-3') && checkGuestCredits('ten'));
});

test('2 · the event’s Papic OFF → ONE line with its door, the face switches hidden — and every face answer still posts', async () => {
  for (const templated of [false, true]) {
    for (const on of [false, true]) {
      const over = { photo_consent: on, faceblock_enabled: on, face_recognition_excluded: on };
      const offCard = await paint(over, { access: 'off', ceiling: undefined }, { templated, camera: true });
      const onCard = await paint(over, { access: 'on', ceiling: null }, { templated, camera: true });
      const kit = templated ? 'template kit' : 'Maker kit';
      assert.match(offCard, /data-card-door="card-papic-off"/, `${kit}: no "Papic is off" line`);
      assert.match(offCard, />Papic is off</, `${kit}: the line does not say Papic is off`);
      assert.match(offCard, /href="\/dashboard\/e1"/, `${kit}: the line has no door to Home's Papic`);
      assert.doesNotMatch(offCard, /data-guest-papic-camera|Tag them in photos|Keep out of face recognition/, `${kit}: Papic is off and its controls still show`);
      assert.deepEqual(facePosted(offCard), facePosted(onCard), `${kit}: with Papic off the face answers post differently (${on ? 'all on' : 'all off'})`);
      if (on) assert.deepEqual(Object.keys(facePosted(offCard)).sort(), [...FACE].sort(), `${kit}: an on answer is dropped while Papic is off`);
    }
  }
});

test('3 · a check or a read that did not answer SAYS so — and offers no camera', async () => {
  const unknown = await paint({}, { access: 'unknown', ceiling: undefined }, { templated: true, camera: true });
  assert.match(unknown, /Couldn’t check whether Papic is on/, 'an unanswered check is drawn as an answer');
  assert.doesNotMatch(unknown, /data-guest-papic-camera/, 'a camera is offered while Papic could not be checked');
  assert.doesNotMatch(unknown, /Papic is off/, 'an unanswered check reads as "off"');
  const unread = await paint({}, { access: 'on', ceiling: undefined }, { templated: true, camera: true });
  assert.match(unread, /Couldn’t read their camera/, 'an unread camera is drawn as a choice');
  assert.doesNotMatch(unread, /data-guest-papic-camera/, 'a camera is offered on an unread ceiling');
  // Not the couple's to see → no camera and no claim about it: the face answers only.
  const helper = await paint({}, { access: 'on', ceiling: undefined }, { templated: true, camera: true, canManage: false });
  assert.doesNotMatch(helper, /data-guest-papic-camera|Couldn’t read their camera/);
  assert.match(helper, /Tag them in photos/);
});

test('4 · Papic on: "Their camera ▾" with the row’s summary — and it never posts with the card', async () => {
  const set = await paint({ faceblock_enabled: true }, { access: 'on', ceiling: 40 }, { templated: true, camera: true });
  assert.match(set, /data-guest-papic-camera=""/, 'no camera on the Papic row');
  assert.match(set, /> · 40 credits · Blurred</, 'the Papic row’s summary is not the camera and the blur');
  const camera = set.slice(set.indexOf('data-guest-papic-camera=""'), set.indexOf('data-card-field="photo_consent"'));
  assert.doesNotMatch(camera, /\sname="/, 'the camera posts with the card’s autosave form');
  const src = read('guest-papic-camera.tsx');
  assert.match(src, /onInput=\{stop\} onChange=\{stop\}/, 'the camera’s taps wake the card’s autosave');
  assert.match(src, /const \{ setGuestAllotment \} = useGuestActions\(\);/, 'the camera does not take the shipped writer from the context');
  assert.match(src, /fd\.set\('quiet', '1'\);/, 'the camera’s save would redirect the card away');
  // The Maker's cards hand no camera: the body only TYPES it (its first load stays as it is).
  const body = read('guest-card-body.tsx');
  assert.match(body, /import type \{ GuestPapicCamera \} from '\.\/guest-papic-camera';/);
  assert.doesNotMatch(body, /import \{[^}]*\} from '\.\/guest-papic-camera'/, 'the card imports the camera for real');
  const maker = await paint({}, null);
  assert.match(maker, />Photos</, 'the Maker’s card lost its Photos group');
  assert.match(maker, /name="photo_consent"/, 'the Maker’s card lost the face switches');
  assert.doesNotMatch(maker, /data-guest-papic-camera|Papic/, 'the Maker’s card names Papic (it is drawn in the app too)');
});

test('4b · 🍎 in the iPhone / Android app the card never names Papic — the shipped Photos row, its three switches, in every state', async () => {
  for (const state of [{ access: 'on', ceiling: 40 }, { access: 'off', ceiling: undefined }, { access: 'unknown', ceiling: undefined }] as GuestPapicState[]) {
    for (const templated of [false, true]) {
      const app = await paint({ photo_consent: true }, state, { templated, camera: true, storeShell: true });
      assert.doesNotMatch(app, /Papic|data-guest-papic-camera|data-card-door/, `the app's card names Papic (${state.access})`);
      assert.match(app, />Photos</, `the app's card lost its Photos row (${state.access})`);
      for (const f of FACE) assert.match(app, new RegExp(`name="${f}"`), `the app's card lost ${f} (${state.access})`);
    }
  }
});

test('5 · the writer: quiet answers in place, several guests one RPC each, the same target — no new action', () => {
  const actions = stripComments(readFileSync(join(HERE, '..', '..', 'studio', 'papic', 'actions.ts'), 'utf8'));
  const fn = actions.slice(actions.indexOf('export async function setGuestAllotment('), actions.indexOf('function revalidateAllotmentReaders('));
  assert.match(fn, /const quiet = formData\.get\('quiet'\) === '1';/);
  assert.match(fn, /formData\.getAll\('guest_id'\)/, 'one guest only — the bulk sheet cannot use it');
  assert.match(fn, /for \(const guestId of guestIds\) \{\s*const \{ error \} = await admin\.rpc\(ALLOTMENT_RPC\.setOne, \{/, 'not one RPC per guest');
  assert.match(fn, /p_points: points,/, 'a guest’s figure is not the one target');
  assert.match(fn, /if \(quiet\) \{\s*revalidateAllotmentReaders\(eventId\);\s*return \{ ok: true, set \};/);
  assert.doesNotMatch(fn, /redirect\([^)]*\)\s*;\s*\}\s*if \(quiet\)/, 'a quiet save can still be redirected');
});

test('6 · Select → Set… ▾ gains Papic only while the event’s Papic is on — and opens the one sheet', () => {
  const screen = read('guests-screen.tsx');
  assert.match(screen, /\.\.\.\(live\.papic === 'on' && !copy \? PAPIC_SET_OPTIONS : \[\]\),/, 'the Papic options are offered while Papic is not on');
  assert.match(screen, /if \(k\.startsWith\('papic:'\)\) return setPapicSheet\(k\.slice\(6\) as GuestCamera\);/);
  assert.match(screen, /\{papicSheet \? \(\s*<GuestPapicBulkSheet/, 'the sheet is mounted while closed');
  const page = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));
  assert.match(page, /papic=\{viewer\.isCouple && !storeShell \? eventPapic : null\}/, 'the list is handed Papic for someone who is not the couple, or in the app');
  const sheet = read('guest-papic-bulk.tsx');
  assert.match(sheet, /for \(const id of ids\) fd\.append\('guest_id', id\);/);
  assert.match(sheet, /`Papic · set \$\{each === null \? 'N' : formatCount\(each\)\} each`/, 'the button does not say "Papic · set N each"');
  assert.match(sheet, /<GuestPopup\b/, 'the sheet is not the guest list’s one pop-up');
});

test('7 · Passed Away sits below Access and still posts with the card — the autosave hears a field drawn outside it', () => {
  const body = read('guest-card-body.tsx');
  assert.ok(body.indexOf('<K.Fold summary="Passed Away"') > body.indexOf('</AutosaveForm>'), 'Passed Away is back inside the form, above Access');
  assert.match(body, /<K\.Toggle\s+name="passed_away"\s+form=\{formId\}/, 'Passed Away no longer posts with the autosave form');
  assert.match(body, /<AutosaveForm action=\{updateAction\} returnTo=\{returnTo\} id=\{formId\}>/);
  const auto = read('guest-card-autosave.tsx');
  assert.match(auto, /if \(el && el\.form === form && !form\.contains\(el\)\) schedule\(\);/, 'a change to a field outside the form is not heard');
  assert.match(read('guest-card-rows.tsx'), /fieldName=\{name\} formId=\{form\}/, 'the templated switch does not carry its form');
});
