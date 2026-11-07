import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  APPOINTMENT_KIND_LABEL,
  MEETING_MODES,
  MEETING_MODE_LABEL,
  meetingModeOf,
  postedKindToStored,
} from './appointments';
import {
  CREATE_ROOM_TIP,
  ENTER_ROOM_TIP,
  JITSI_HOST_TIP,
  isSetnayanJitsiLink,
  joinIsOpen,
  makeJitsiLink,
  meetingHasRoom,
  parseVirtualLocation,
  roomButtonFor,
  virtualHandoff,
  virtualLocationFromForm,
  virtualSummary,
} from './virtual-meeting';

/**
 * MEETINGS NEVER OPEN AN IN-APP CALL.
 *
 * Owner 2026-10-28 (DECISION_LOG "CHAT APPROVED — MESSENGER LOOK, ONE ＋, NO
 * CALLS"): "remove both voice and video call". The chat lost its Call tool, but
 * meetings still offered "Video call" / "Voice call" and Join opened the in-app
 * P2P room. 2026-11-04: a meeting is In-person or Virtual, and a Virtual one
 * is a Jitsi room Setnayan makes ("VIRTUAL = JITSI ONLY": "just jitsi"), with
 * ONE button that says what the room needs ("ONE BUTTON THAT SAYS WHAT THE ROOM
 * NEEDS"). What this holds — properties, not phrasings:
 *
 *   1 · Every meeting surface offers only In-person / Virtual: no file posts or
 *       lists 'voice', and none draws the words "Video call" / "Voice call".
 *   2 · No meeting surface reaches the call stack (startThreadCall,
 *       ThreadCallRoom, thread-call-*, call-webrtc).
 *   3 · Join is a hand-off: an http(s) link in a new tab — never a dial.
 *       New meetings store only a Jitsi link of ours, made on the server.
 *   5 · "Create the room" before the room exists, "Enter the room" after —
 *       for BOTH sides (rendered below).
 *   4 · Old 'video' / 'voice' rows read as Virtual; with no link they hand off
 *       nothing ("no link yet").
 */

// The card's real component imports its server action, whose chain says `server-only` — stubbed for a static render
// exactly as the guest-card audit does (that action never runs here; only the markup is read).
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
{
  const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
  const STUB = join(process.cwd(), '__server_only_stub_meetings__.js');
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
const WEB = resolve(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const MEETING_SURFACES = [
  'app/_components/negotiation-composer-menu.tsx',
  'app/_components/schedule-suggest-chip.tsx',
  'app/_components/appointments-section.tsx',
  'app/_components/appointment-join.tsx',
  'app/_components/chat-appointment-card.tsx',
  'app/_components/meeting-how-fields.tsx',
  'app/_components/virtual-meeting-fields.tsx',
  'app/dashboard/[eventId]/schedule/page.tsx',
  'app/dashboard/[eventId]/schedule/_components/vendor-meetings-section.tsx',
  'lib/appointments.ts',
  'lib/virtual-meeting.ts',
];

test('1 · no meeting surface offers a voice / video CALL', () => {
  for (const f of MEETING_SURFACES) {
    const src = read(f);
    assert.doesNotMatch(src, /(Video|Voice) call/, `${f} draws "Video call" / "Voice call"`);
    // `'voice'` may appear only on the READ side of lib/appointments.ts (old rows).
    if (f !== 'lib/appointments.ts') {
      assert.doesNotMatch(src, /['"`]voice['"`]/, `${f} names the 'voice' kind`);
    }
    assert.doesNotMatch(src, /\bAPPOINTMENT_KINDS\b/, `${f} still lists the three old kinds`);
  }
  assert.deepEqual([...MEETING_MODES], ['in_person', 'virtual']);
  assert.deepEqual(Object.values(MEETING_MODE_LABEL), ['In-person', 'Virtual']);
});

test('2 · no meeting surface reaches the in-app call stack', () => {
  for (const f of MEETING_SURFACES) {
    const src = read(f);
    assert.doesNotMatch(src, /\bstartThreadCall\b/, `${f} starts an in-app call`);
    assert.doesNotMatch(src, /\bThreadCallRoom\b/, `${f} opens the in-app call room`);
    assert.doesNotMatch(src, /thread-call-|call-webrtc/, `${f} imports the call stack`);
  }
});

test('2b · each composer posts kind from the In-person / Virtual pick, never a literal call kind', () => {
  for (const f of [
    'app/_components/negotiation-composer-menu.tsx',
    'app/_components/schedule-suggest-chip.tsx',
  ]) {
    assert.match(read(f), /<MeetingHowFields\b/, `${f} lost the shared In-person / Virtual pick`);
  }
  assert.match(read('app/_components/appointments-section.tsx'), /MEETING_MODES/);
  // The server never writes 'voice', whatever is posted.
  assert.equal(postedKindToStored('voice'), 'video');
  assert.equal(postedKindToStored('virtual'), 'video');
  assert.equal(postedKindToStored('in_person'), 'in_person');
  assert.equal(postedKindToStored('call'), null);
  for (const f of ['app/_components/appointments-actions.ts', 'app/_components/negotiation-actions.ts']) {
    const src = read(f);
    assert.match(src, /postedKindToStored\(formData\.get\('kind'\)\)/, `${f} reads kind its own way`);
    assert.match(src, /virtualLocationFromForm\(formData\)/, `${f} saves a Virtual link that is not a Jitsi link of ours`);
  }
});

test('3 · Virtual is Jitsi only — the server stores a link of ours, whatever is posted', () => {
  const fd = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  const link = makeJitsiLink();
  assert.match(link, /^https:\/\/meet\.jit\.si\/Setnayan-[0-9A-HJKMNP-TV-Z]{10}$/);
  assert.notEqual(makeJitsiLink(), link, 'two links are never the same room');
  assert.equal(virtualLocationFromForm(fd({ virtual_value: link })), `jitsi|${link}`, 'the link the composer showed is kept');
  for (const posted of [{}, { virtual_value: 'https://meet.google.com/abc' }, { via: 'viber', virtual_value: '0917 123 4567' }, { virtual_value: 'https://meet.jit.si/anything' }]) {
    const loc = virtualLocationFromForm(fd(posted as Record<string, string>));
    assert.ok(loc.startsWith('jitsi|') && isSetnayanJitsiLink(loc.slice(6)), `stored ${loc} for ${JSON.stringify(posted)}`);
  }
  // The composer has no app menu and no field to type in — the link is made, read-only, with its ⓘ.
  const fields = read('app/_components/virtual-meeting-fields.tsx');
  assert.doesNotMatch(fields, /PickMenu|data-meeting-via|Google Meet|Zoom|Messenger|Viber|Phone call/);
  assert.match(fields, /makeJitsiLink\(\)/);
  assert.match(fields, /JITSI_HOST_TIP/);
  assert.match(JITSI_HOST_TIP, /signs in once \(Google, Facebook or GitHub\)/);
  assert.match(JITSI_HOST_TIP, /without an account/);
  assert.match(JITSI_HOST_TIP, /no time limit/);
});

test('3b · Join opens the link in a new tab — never a dial; old rows still open read-only', () => {
  const link = makeJitsiLink();
  assert.deepEqual(virtualHandoff(parseVirtualLocation(`jitsi|${link}`)), { href: link, label: 'Join on Jitsi Meet', newTab: true });
  assert.equal(virtualHandoff(parseVirtualLocation('meet|https://meet.google.com/abc-defg-hij'))?.label, 'Join on Google Meet');
  assert.equal(virtualHandoff(parseVirtualLocation('zoom|https://zoom.us/j/1'))?.label, 'Join on Zoom');
  assert.equal(virtualHandoff(parseVirtualLocation('viber|+639171234567')), null, 'a meeting opened Viber');
  assert.equal(virtualHandoff(parseVirtualLocation('phone|+639171234567')), null, 'a meeting dialled');
  assert.equal(virtualHandoff(parseVirtualLocation('meet|javascript:alert(1)')), null);
  assert.equal(meetingHasRoom(parseVirtualLocation(`jitsi|${link}`)), true);
  assert.equal(meetingHasRoom(parseVirtualLocation(null)), true, 'no link yet → the room makes one');
  assert.equal(meetingHasRoom(parseVirtualLocation('zoom|https://zoom.us/j/1')), false, 'an old Zoom link just opens');
  for (const f of MEETING_SURFACES) assert.doesNotMatch(read(f), /\b(?:tel|viber):(?:\/\/|\+|\$\{|\d)/, `${f} dials`);
});

test('4 · old video / voice rows read as Virtual · no link yet', () => {
  assert.equal(APPOINTMENT_KIND_LABEL.voice, 'Virtual');
  assert.equal(APPOINTMENT_KIND_LABEL.video, 'Virtual');
  assert.equal(meetingModeOf('voice'), 'virtual');
  const old = parseVirtualLocation(null);
  assert.equal(virtualSummary(old), 'Virtual');
  assert.equal(virtualHandoff(old), null);
  // A bare link on an old row still works, its app inferred.
  assert.equal(parseVirtualLocation('https://meet.google.com/x').via, 'meet');
});

test('4b · the button shows from 15 minutes before start', () => {
  const start = Date.parse('2026-11-14T02:00:00Z');
  assert.equal(joinIsOpen('2026-11-14T02:00:00Z', start - 16 * 60_000), false);
  assert.equal(joinIsOpen('2026-11-14T02:00:00Z', start - 15 * 60_000), true);
  assert.equal(joinIsOpen(null, start), true);
});

test('5 · ONE button: "Create the room" before it exists, "Enter the room" after — for BOTH sides', async () => {
  for (const isProposer of [true, false]) {
    const before = roomButtonFor(null, isProposer);
    assert.equal(before.kind, 'create');
    assert.equal(before.label, 'Create the room');
    assert.equal(before.tip, CREATE_ROOM_TIP);
    assert.equal(before.primary, isProposer, 'the proposer is offered Create first');
    const after = roomButtonFor('2026-11-14T01:50:00Z', isProposer);
    assert.equal(after.kind, 'enter');
    assert.equal(after.label, 'Enter the room');
    assert.equal(after.lead, 'Room created');
    assert.equal(after.tip, ENTER_ROOM_TIP);
  }
  assert.equal(CREATE_ROOM_TIP, 'You open the room — sign in once with Google, Facebook or GitHub.');
  assert.equal(ENTER_ROOM_TIP, 'No account needed.');

  // Rendered, as each side sees the card — the same answer from the real component.
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppointmentJoin } = await import('../app/_components/appointment-join');
  const link = makeJitsiLink();
  const paint = (isProposer: boolean, roomCreatedAt: string | null) =>
    renderToStaticMarkup(
      React.createElement(AppointmentJoin, {
        appointmentId: 'a1',
        location: `jitsi|${link}`,
        scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        confirmed: true,
        isProposer,
        roomCreatedAt,
        returnPath: '/dashboard/e1/messages/t1',
      }),
    );
  for (const isProposer of [true, false]) {
    const side = isProposer ? 'the proposer' : 'the other side';
    const before = paint(isProposer, null);
    assert.match(before, /data-meeting-room="create"/, `${side} is not offered Create before the room exists`);
    assert.match(before, />Create the room</);
    assert.doesNotMatch(before, /Enter the room/, `${side} sees Enter before anyone created the room`);
    const after = paint(isProposer, '2026-11-14T01:50:00Z');
    assert.match(after, /data-meeting-room="enter"/, `${side} is not offered Enter after the room exists`);
    assert.match(after, /Room created/);
    assert.match(after, new RegExp(`href="${link.replace(/[.]/g, '\\.')}"[^>]*target="_blank"`));
    assert.doesNotMatch(after, /Create the room/, `${side} is still offered Create after the room exists`);
  }
  // Too early → neither button, the link read-only.
  const early = renderToStaticMarkup(
    React.createElement(AppointmentJoin, {
      appointmentId: 'a1', location: `jitsi|${link}`, scheduledAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
      confirmed: true, isProposer: true, roomCreatedAt: null, returnPath: '/x',
    }),
  );
  assert.match(early, /data-meeting-readonly/);
  assert.doesNotMatch(early, /data-meeting-room=/);
});
