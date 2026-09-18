/**
 * A debut is not a wedding on the host's own pages (AREA-COUPLE, 2026-09-19).
 *
 * Five places on the host's dashboard spoke "wedding" to every celebration:
 *   · the guest mind map's root, whenever no bride+groom are listed — i.e.
 *     on EVERY debut, birthday or christening ("Your wedding");
 *   · the Preparation tab's empty state ("Set your wedding date first");
 *   · the date-lock confirmation ("This locks your wedding date.");
 *   · the invite a host sends an off-platform supplier ("…for our wedding");
 *   · the guest detail's role picker ("Role in wedding") on a sideless event.
 *
 * Each now reads `eventNoun(event_type)` (weddings byte-identical) or neutral
 * words. This guard checks both halves: the fixed wedding phrase is gone from
 * the rendering file, AND the page that mounts it actually passes the event's
 * word in — a prop that defaults to 'wedding' and is never passed would leave
 * the screen exactly as it was.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { eventNoun } from './event-noun';

const WEB = join(__dirname, '..');
const D = 'app/dashboard/[eventId]';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('eventNoun: a debut reads "event", a wedding stays "wedding"', () => {
  assert.equal(eventNoun('debut'), 'event');
  assert.equal(eventNoun('birthday'), 'event');
  assert.equal(eventNoun('wedding'), 'wedding');
});

const CASES: Array<{ name: string; file: string; banned: RegExp; mount?: { file: string; re: RegExp } }> = [
  {
    name: 'guest mind map root',
    file: `${D}/guests/_components/guest-mind-map.tsx`,
    banned: /'Your wedding'/,
    mount: { file: `${D}/guests/page.tsx`, re: /<GuestMindMap[\s\S]*?eventWord=\{eventWord\}[\s\S]*?\/>/ },
  },
  {
    name: 'preparation empty state',
    file: `${D}/schedule/_components/preparation-agenda.tsx`,
    banned: /your wedding (date|day)/,
    mount: {
      file: `${D}/schedule/page.tsx`,
      re: /<PreparationAgendaView[^>]*eventWord=\{eventNoun\(eventRow\?\.event_type\)\}/,
    },
  },
  {
    name: 'date-lock confirmation',
    file: `${D}/vendors/_components/lock-milestone.tsx`,
    banned: /wedding\s+date/,
  },
  {
    name: 'supplier invite share text',
    file: `${D}/vendors/[vendorId]/workspace/page.tsx`,
    banned: /for our wedding/,
  },
  {
    name: 'guest role picker on a sideless event',
    file: `${D}/guests/[guestId]/page.tsx`,
    banned: /label="Role in wedding"/,
  },
];

for (const c of CASES) {
  test(`${c.name}: no fixed wedding phrase`, () => {
    const src = read(c.file);
    const hits = count(src, new RegExp(c.banned.source, 'g'));
    console.log(`${c.name}: ${hits} fixed wedding phrase(s)`);
    assert.equal(hits, 0);
  });
  if (c.mount) {
    const m = c.mount;
    test(`${c.name}: the page passes the event's own word`, () => {
      const hits = count(read(m.file), new RegExp(m.re.source, 'g'));
      console.log(`${c.name}: ${hits} mount(s) passing eventWord`);
      assert.equal(hits, 1);
    });
  }
}

test('the guests page derives eventWord from the event type, not a constant', () => {
  const src = read(`${D}/guests/page.tsx`);
  assert.match(src, /const eventWord = eventNoun\(\(await resolveProfileByEvent\(eventId\)\)\.eventType\)/);
});

test('the invite share text is built from the event type', () => {
  const src = read(`${D}/vendors/[vendorId]/workspace/page.tsx`);
  assert.match(src, /eventNoun\(\(await resolveProfileByEvent\(eventId\)\)\.eventType\)/);
  assert.match(src, /for our \$\{inviteEventWord\}/);
});
