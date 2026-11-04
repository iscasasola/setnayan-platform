import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  VIRTUAL_VIAS,
  VIRTUAL_VIA_META,
  createLinkHref,
  makeJitsiLink,
  joinIsOpen,
  normalizeVirtualValue,
  parseVirtualLocation,
  readVirtualFields,
  virtualHandoff,
  virtualSummary,
} from './virtual-meeting';

/**
 * MEETINGS NEVER OPEN AN IN-APP CALL.
 *
 * Owner 2026-10-28 (DECISION_LOG "CHAT APPROVED — MESSENGER LOOK, ONE ＋, NO
 * CALLS"): "remove both voice and video call". The chat lost its Call tool, but
 * meetings still offered "Video call" / "Voice call" and Join opened the in-app
 * P2P room. Approved 2026-11-04: a meeting is In-person or Virtual, and a
 * Virtual one is the proposer's own Google Meet / Zoom / Messenger / Viber /
 * phone. What this holds — properties, not phrasings:
 *
 *   1 · Every meeting surface offers only In-person / Virtual: no file posts or
 *       lists 'voice', and none draws the words "Video call" / "Voice call".
 *   2 · No meeting surface reaches the call stack (startThreadCall,
 *       ThreadCallRoom, thread-call-*, call-webrtc).
 *   3 · Join is a hand-off: an http(s) link in a new tab, viber://, or tel: —
 *       executed below, including the refusals.
 *   4 · Old 'video' / 'voice' rows read as Virtual; with no link they hand off
 *       nothing ("no link yet").
 */

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
    assert.match(src, /readVirtualFields\(formData\)/, `${f} saves the link unvalidated`);
  }
});

test('3 · Join hands off to the right app', () => {
  assert.deepEqual(virtualHandoff(parseVirtualLocation('meet|https://meet.google.com/abc-defg-hij')), {
    href: 'https://meet.google.com/abc-defg-hij',
    label: 'Join on Google Meet',
    newTab: true,
  });
  assert.equal(virtualHandoff(parseVirtualLocation('zoom|https://zoom.us/j/1'))?.label, 'Join on Zoom');
  assert.equal(virtualHandoff(parseVirtualLocation('messenger|https://m.me/shop'))?.label, 'Open in Messenger');
  assert.deepEqual(virtualHandoff(parseVirtualLocation('viber|+639171234567')), {
    href: 'viber://chat?number=%2B639171234567',
    label: 'Open in Viber',
    newTab: false,
  });
  assert.deepEqual(virtualHandoff(parseVirtualLocation('phone|+639171234567')), {
    href: 'tel:+639171234567',
    label: 'Call 0917 123 4567',
    newTab: false,
  });
  // Nothing unsafe ever becomes a Join.
  assert.equal(virtualHandoff(parseVirtualLocation('meet|javascript:alert(1)')), null);
  assert.equal(virtualHandoff(parseVirtualLocation('zoom|ftp://x.y/z')), null);
  assert.equal(virtualHandoff(parseVirtualLocation('viber|12345')), null);
});

test('3b · each value is validated before anything is saved', () => {
  assert.equal(normalizeVirtualValue('meet', 'meet.google.com/abc').ok, true);
  assert.equal(normalizeVirtualValue('meet', 'not a link').ok, false);
  assert.equal(normalizeVirtualValue('messenger', 'm.me/yourshop').ok, true);
  assert.deepEqual(normalizeVirtualValue('viber', '0917 123 4567'), { ok: true, value: '+639171234567' });
  assert.equal(normalizeVirtualValue('viber', '02 8123 4567').ok, false, 'Viber is a mobile number');
  assert.deepEqual(normalizeVirtualValue('phone', '02 8123 4567'), { ok: true, value: '+63281234567' });
  assert.equal(normalizeVirtualValue('phone', '555-1234').ok, false);
  const fd = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  assert.deepEqual(readVirtualFields(fd({ via: 'viber', virtual_value: '+63 917 123 4567' })), {
    ok: true,
    location: 'viber|+639171234567',
  });
  assert.equal(readVirtualFields(fd({ via: 'zoom', virtual_value: 'hello' })).ok, false);
  assert.equal(readVirtualFields(fd({ via: 'skype', virtual_value: 'x' })).ok, false);
  // Meet / Zoom get a "Create a … link" in the person's own account; the rest do not.
  assert.equal(createLinkHref('meet'), 'https://meet.google.com/new');
  assert.equal(createLinkHref('zoom'), 'https://zoom.us/start/videomeeting');
  assert.equal(createLinkHref('viber'), null);
  assert.deepEqual(
    VIRTUAL_VIAS.map((v) => VIRTUAL_VIA_META[v].label),
    ['Jitsi Meet', 'Google Meet', 'Zoom', 'Messenger', 'Viber', 'Phone call'],
  );
  assert.equal(VIRTUAL_VIA_META.meet.freeNote, 'Free · 60 min for 3 or more people');
  assert.equal(VIRTUAL_VIA_META.zoom.freeNote, 'Free Zoom ends at 40 min');
});

test('3c · Jitsi: Setnayan makes the link itself — and accepts only a link it made', () => {
  const link = makeJitsiLink();
  assert.match(link, /^https:\/\/meet\.jit\.si\/Setnayan-[0-9A-HJKMNP-TV-Z]{10}$/);
  assert.notEqual(makeJitsiLink(), link, 'two links are never the same room');
  assert.deepEqual(normalizeVirtualValue('jitsi', link), { ok: true, value: link });
  assert.equal(normalizeVirtualValue('jitsi', 'https://meet.jit.si/anything').ok, false);
  assert.equal(normalizeVirtualValue('jitsi', 'https://evil.example/Setnayan-ABCDEFGHJK').ok, false);
  assert.deepEqual(virtualHandoff(parseVirtualLocation(`jitsi|${link}`)), {
    href: link,
    label: 'Join on Jitsi Meet',
    newTab: true,
  });
  assert.equal(createLinkHref('jitsi'), null, 'no "Create a … link" — it is already made');
});

test('4 · old video / voice rows read as Virtual · no link yet', () => {
  assert.equal(APPOINTMENT_KIND_LABEL.voice, 'Virtual');
  assert.equal(APPOINTMENT_KIND_LABEL.video, 'Virtual');
  assert.equal(meetingModeOf('voice'), 'virtual');
  const old = parseVirtualLocation(null);
  assert.equal(virtualSummary(old), 'Virtual');
  assert.equal(virtualHandoff(old), null);
  assert.equal(virtualHandoff(parseVirtualLocation('meet|')), null);
  // A bare link on an old row still works, its app inferred.
  assert.equal(parseVirtualLocation('https://meet.google.com/x').via, 'meet');
});

test('4b · Join shows from 15 minutes before start', () => {
  const start = Date.parse('2026-11-14T02:00:00Z');
  assert.equal(joinIsOpen('2026-11-14T02:00:00Z', start - 16 * 60_000), false);
  assert.equal(joinIsOpen('2026-11-14T02:00:00Z', start - 15 * 60_000), true);
  assert.equal(joinIsOpen(null, start), true);
});
