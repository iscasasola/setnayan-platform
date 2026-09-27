/**
 * THE SAVE-THE-DATE FILM NEVER SHOWS A STREET ADDRESS TO SOMEONE THE VENUE
 * GATE WITHHOLDS FROM (2026-09-27).
 *
 * Owner rule (DECISION_LOG 2026-09-27, and the 2026-09-20 ruling it restates):
 * the exact venue stays locked until the guest has replied; strangers never
 * see it. The Venue scene obeyed it. The Save-the-Date film did not: its place
 * line was `std_film_venue_city ?? venue_address`, built in the loader and
 * handed to the film for every viewer — so the address also became the film's
 * "add to calendar" location, in a link anyone can forward.
 *
 * The first half of this file RUNS the pipeline a real request runs — loader
 * (`stdFilmOwnCity` on the raw row) → the page's gate (`venueIsOpen` →
 * `withheldVenue`) → the film's mount (`stdFilmPlaceLine`) → the film's own
 * content (`resolveStdFilmContent`, which builds the calendar links) — and
 * searches EVERYTHING the film receives for the street. The second half pins
 * that the real files are wired that way, so the run above is the run prod does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { resolveStdFilmContent } from './save-the-date-content';
import {
  stdFilmOwnCity,
  stdFilmPlaceLine,
  venueIsOpen,
  withheldVenue,
} from './venue-disclosure';

const STREET = '12 Sampaguita Street';
const ADDRESS = `${STREET}, Barangay Poblacion, Tagaytay City, Cavite`;
const FAR_OFF = new Date('2026-09-27T12:00:00+08:00');
const WEDDING_DAY = '2027-02-14';

type Row = {
  venue_name: string;
  venue_address: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  std_film_venue_city: string | null;
};
const base = { venue_name: 'Taal Vista', venue_latitude: 14.1, venue_longitude: 120.9 };

/** The three rows the leak can take. */
const EVENTS = {
  'the Save-the-Date city is set': { ...base, venue_address: ADDRESS, std_film_venue_city: 'Tagaytay' },
  'only the street address is set': { ...base, venue_address: ADDRESS, std_film_venue_city: null },
  // The builder's old "Autofill" copied the address INTO the city field, and
  // "Render" saved it — a city field holding the address is the address.
  'the city field holds a copy of the address': {
    ...base,
    venue_address: ADDRESS,
    std_film_venue_city: `  ${ADDRESS.toUpperCase()} `,
  },
} satisfies Record<string, Row>;

type Viewer = { label: string; rsvpStatus: 'pending' | 'attending' | 'declined' | null | undefined };
const STRANGER: Viewer = { label: 'a stranger with a forwarded link', rsvpStatus: undefined };
const UNREPLIED: Viewer = { label: 'a guest who has not replied', rsvpStatus: 'pending' };
const REPLIED: Viewer = { label: 'a guest who has replied', rsvpStatus: 'attending' };

/** Exactly what one request does, from the raw row to the film's content. */
function filmFor(row: Row, viewer: Viewer) {
  // _lib/loaders.ts — the un-gated stdVenues object every viewer receives.
  const stdVenues = { ceremony: null, reception: row.venue_name, receptionCity: stdFilmOwnCity(row) };
  // app/[slug]/page.tsx — the shared props are withheld; only a guest's own
  // reply opens them (a stranger never reaches the opening branch at all).
  const open =
    viewer.rsvpStatus !== undefined &&
    venueIsOpen({ rsvpStatus: viewer.rsvpStatus, eventDate: WEDDING_DAY, now: FAR_OFF, timeZone: 'Asia/Manila' });
  const gated = open ? row : withheldVenue(row);
  // _components/site-body.tsx — the film's mount.
  const receptionCity = stdFilmPlaceLine(stdVenues.receptionCity, gated);
  // _components/save-the-date.tsx → the film's content (gcal + ics included).
  const content = resolveStdFilmContent({
    displayName: 'Maria & Jose',
    dateIso: WEDDING_DAY,
    ceremonyVenue: stdVenues.ceremony,
    receptionVenue: stdVenues.reception,
    receptionCity,
    publicId: 'S89E-TEST000000',
  });
  return { stdVenues, receptionCity, content };
}

/** Everything the film receives, with URL-encoding and ICS line folding undone. */
function haystack(x: unknown): string {
  const raw = JSON.stringify(x);
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw.replace(/%[0-9A-F]{2}/gi, (m) => {
      try {
        return decodeURIComponent(m);
      } catch {
        return m;
      }
    });
  }
  return `${raw}\n${decoded.replace(/\r?\n[ \t]/g, '').replace(/\\r\\n[ \t]/g, '').replace(/\+/g, ' ')}`.toLowerCase();
}
const leaks = (x: unknown) => haystack(x).includes(STREET.toLowerCase());

for (const [name, row] of Object.entries(EVENTS) as [string, Row][]) {
  for (const viewer of [STRANGER, UNREPLIED]) {
    test(`${viewer.label} never gets the street — ${name}`, () => {
      const film = filmFor(row, viewer);
      assert.equal(
        leaks(film),
        false,
        `the street reached the film's props: ${JSON.stringify(film.receptionCity)}`,
      );
    });
  }
}

test('the stranger still gets the couple’s own city — the line is not simply deleted', () => {
  assert.equal(filmFor(EVENTS['the Save-the-Date city is set'], STRANGER).receptionCity, 'Tagaytay');
  assert.equal(filmFor(EVENTS['only the street address is set'], STRANGER).receptionCity, null);
});

test('a guest who has replied still gets what they were allowed before', () => {
  // City set → the city (it always won over the address, for everyone).
  assert.equal(filmFor(EVENTS['the Save-the-Date city is set'], REPLIED).receptionCity, 'Tagaytay');
  // Only the address → the address, exactly as before this fix.
  const onlyAddress = filmFor(EVENTS['only the street address is set'], REPLIED);
  assert.equal(onlyAddress.receptionCity, ADDRESS);
  // 🔬 The detector's own control: it CAN see the street through the calendar
  // link's URL-encoding, so the "never" results above are not a blind search.
  assert.equal(leaks(onlyAddress), true, 'the search must be able to find the street when it IS there');
  assert.equal(leaks({ gcal: onlyAddress.content.gcalUrl }), true, 'inside the encoded calendar link too');
  assert.ok(onlyAddress.content.icsHref, 'precondition: the film carries a calendar file');
  assert.equal(leaks({ ics: onlyAddress.content.icsHref }), true, 'and inside the encoded, folded .ics file');
  // A declined reply is still a reply (the gate's rule, not a new one).
  assert.equal(filmFor(EVENTS['only the street address is set'], { label: 'declined', rsvpStatus: 'declined' }).receptionCity, ADDRESS);
});

test('the loader half can never be an address, whatever is saved in the city field', () => {
  assert.equal(stdFilmOwnCity({ std_film_venue_city: 'Tagaytay', venue_address: ADDRESS }), 'Tagaytay');
  assert.equal(stdFilmOwnCity({ std_film_venue_city: null, venue_address: ADDRESS }), null);
  assert.equal(stdFilmOwnCity({ std_film_venue_city: '   ', venue_address: ADDRESS }), null);
  assert.equal(stdFilmOwnCity({ std_film_venue_city: ADDRESS, venue_address: ADDRESS }), null);
  assert.equal(stdFilmOwnCity({ std_film_venue_city: ` ${ADDRESS.replace(/ /g, '  ')} `, venue_address: ADDRESS }), null);
  assert.equal(stdFilmOwnCity({ std_film_venue_city: 'Makati', venue_address: null }), 'Makati');
});

// ── The real files are wired the way the run above assumes ──────────────────

const APP = join(__dirname, '..', 'app', '[slug]');
const read = (...p: string[]) => stripComments(readFileSync(join(...p), 'utf8'));

test('the loader hands every viewer the Save-the-Date’s own city only', () => {
  const src = read(APP, '_lib', 'loaders.ts');
  const start = src.indexOf('const stdVenues = {');
  assert.ok(start >= 0, 'precondition: the loader builds stdVenues');
  const literal = src.slice(start, src.indexOf('};', start) + 2);
  assert.match(literal, /receptionCity:\s*stdFilmOwnCity\(/, `receptionCity must come from stdFilmOwnCity:\n${literal}`);
  // Outside that one call, the un-gated object may not read the address at all.
  const call = literal.slice(literal.indexOf('stdFilmOwnCity('));
  const withoutCall = literal.replace(call.slice(0, call.indexOf('})') + 2), '');
  assert.doesNotMatch(withoutCall, /venue_address/, `the un-gated stdVenues reads the street address:\n${literal}`);
});

test('the film’s mount reads the address only through the gated event', () => {
  const src = read(APP, '_components', 'site-body.tsx');
  const all = src.match(/receptionCity=\{[^}]*\}/g) ?? [];
  const gated = all.filter((p) => /^receptionCity=\{stdFilmPlaceLine\(stdVenues\?\.receptionCity, event\)\}$/.test(p));
  assert.ok(all.length >= 1, 'precondition: site-body mounts the Save-the-Date film');
  assert.deepEqual(all, gated, `every film mount must go through stdFilmPlaceLine(…, event): ${all.join(' · ')}`);
  // …and no other guest-page file feeds the film a place line of its own.
  const hits = execFileSync('git', ['grep', '-l', '-e', 'receptionCity=', '--', ':(literal)app/[slug]'], {
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter((f) => f && !f.endsWith('.test.ts'));
  assert.deepEqual(hits, ['app/[slug]/_components/site-body.tsx'], `another mount passes receptionCity: ${hits.join(', ')}`);
});

test('the builder’s Autofill no longer copies the street address into the “City or area” field', () => {
  const src = read(
    __dirname,
    '..',
    'app',
    'dashboard',
    '[eventId]',
    'studio',
    'save-the-date',
    '_components',
    'StdBuilderClient.tsx',
  );
  const fill = src.slice(src.indexOf('const handleAutofill'));
  const body = fill.slice(0, fill.indexOf('\n  };'));
  assert.ok(/setVenueCity\(/.test(body), 'precondition: Autofill still fills the city field');
  assert.doesNotMatch(body, /setVenueCity\([^)]*initialContent\.receptionCity/, 'Autofill copies the address-backed value into a field every viewer sees');
});
