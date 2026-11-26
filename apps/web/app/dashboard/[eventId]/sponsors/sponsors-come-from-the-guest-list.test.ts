/**
 * sponsors-come-from-the-guest-list.test.ts — owner, brief Add 41 (final check A2-I14, plan batch A-5):
 * "One list; a sponsor is a guest with the sponsor role."
 *
 * Holds: the Sponsors page draws its sponsors from guest rows (`sponsorsFromGuests`, behaviour below); Add, Edit,
 * Remove, Invite and Mark-response write the GUEST LIST; `event_sponsors` is DROPPED (owner 27 Nov 2026, migration
 * 20271364844438) and nothing in the app names it; a
 * principal sponsor added here is `principal_sponsor`, never ninong or ninang from the side; removing a sponsor
 * takes the role, not the person.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  SPONSOR_ROLE_BY_TIER,
  giveSponsorRole,
  sponsorsFromGuests,
  takeSponsorRole,
  type SponsorGuestRow,
} from '@/lib/sponsor-guests';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..', '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(here, rel), 'utf8'));

const g = (over: Partial<SponsorGuestRow>): SponsorGuestRow => ({
  guest_id: 'g1',
  event_id: 'e1',
  first_name: 'Ramon',
  last_name: 'Cruz',
  display_name: null,
  side: 'groom',
  role: 'guest',
  extra_roles: [],
  email: null,
  mobile: null,
  notes: null,
  rsvp_status: 'pending',
  rsvp_set_by: null,
  rsvp_responded_at: null,
  sponsor_asked_at: null,
  entourage_order: null,
  created_at: '2026-11-25T00:00:00Z',
  ...over,
});

test('a guest with a sponsor role is a sponsor; a plain guest is not', () => {
  assert.deepEqual(sponsorsFromGuests([g({})]), []);
  const [s] = sponsorsFromGuests([g({ role: 'principal_sponsor_ninong', entourage_order: 2, mobile: '0917', notes: 'Tito' })]);
  assert.deepEqual(
    { id: s!.id, tier: s!.sponsor_tier, pair: s!.pair_index, side: s!.side, name: s!.full_name, phone: s!.phone, note: s!.relationship_note, role: s!.role },
    { id: 'g1', tier: 'principal', pair: 2, side: 'groom', name: 'Ramon Cruz', phone: '0917', note: 'Tito', role: 'principal_sponsor_ninong' },
  );
});

test('a guest holding two tiers is drawn once per tier; a role in extra_roles counts', () => {
  const rows = sponsorsFromGuests([g({ role: 'bridesmaid', extra_roles: ['veil_sponsor', 'candle_sponsor'], side: 'both' })]);
  assert.deepEqual(rows.map((r) => r.sponsor_tier).sort(), ['candle', 'veil']);
  assert.ok(rows.every((r) => r.side === 'neutral' && r.pair_index === null));
});

test('the invitation’s state is the guest’s own reply plus whether it was sent', () => {
  const st = (over: Partial<SponsorGuestRow>) => sponsorsFromGuests([g({ role: 'cord_sponsor', ...over })])[0]!.invitation_status;
  assert.equal(st({}), 'pending');
  assert.equal(st({ sponsor_asked_at: '2026-11-20T00:00:00Z' }), 'invited');
  assert.equal(st({ rsvp_status: 'attending' }), 'accepted');
  assert.equal(st({ rsvp_status: 'declined', sponsor_asked_at: '2026-11-20T00:00:00Z' }), 'declined');
});

test('giving and taking a sponsor role keeps the person and their own role', () => {
  assert.deepEqual(giveSponsorRole({ role: 'guest', extra_roles: [] }, 'principal'), { role: 'principal_sponsor' });
  assert.deepEqual(giveSponsorRole({ role: 'bridesmaid', extra_roles: [] }, 'veil'), { extra_roles: ['veil_sponsor'] });
  assert.equal(giveSponsorRole({ role: 'principal_sponsor_ninang', extra_roles: [] }, 'principal'), null, 'already holds the tier');
  assert.deepEqual(takeSponsorRole({ role: 'cord_sponsor', extra_roles: [] }, 'cord'), { role: 'guest', extra_roles: [] });
  assert.deepEqual(takeSponsorRole({ role: 'bridesmaid', extra_roles: ['veil_sponsor', 'candle_sponsor'] }, 'veil'), { extra_roles: ['candle_sponsor'] });
});

test('a principal sponsor added here is "not yet specified" — never ninong or ninang from the side', () => {
  assert.equal(SPONSOR_ROLE_BY_TIER.principal, 'principal_sponsor');
  assert.doesNotMatch(src('actions.ts'), /principal_sponsor_nin(ong|ang)/);
});

test('every Sponsors action writes the guest list; nothing in the app reads or writes event_sponsors', () => {
  const actions = src('actions.ts');
  for (const fn of ['addSponsor', 'updateSponsor', 'removeSponsor', 'sendInvitation', 'markResponse']) {
    const start = actions.indexOf(`export async function ${fn}(`);
    const next = actions.indexOf('\nexport async function ', start + 10);
    const body = actions.slice(start, next === -1 ? undefined : next);
    assert.match(body, /\.from\('guests'\)/, `${fn} does not write the guest list`);
  }
  const writers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        const s = stripComments(readFileSync(p, 'utf8'));
        if (/\.from\(\s*['"`]event_sponsors['"`]\s*\)/.test(s)) writers.push(relative(web, p));
      }
    }
  };
  walk(join(web, 'app'));
  walk(join(web, 'lib'));
  assert.deepEqual(writers, [], 'event_sponsors is dropped (owner 27 Nov 2026, brief Add 41)');
});

test('event_sponsors is dropped by a migration that runs after the guest-list move', () => {
  const dir = join(web, '..', '..', 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => /^\d{14}_.*\.sql$/.test(f)).sort();
  const move = files.indexOf('20271363480132_sponsors_join_the_guest_list.sql');
  const drop = files.findIndex((f) => /DROP TABLE IF EXISTS public\.event_sponsors;/.test(readFileSync(join(dir, f), 'utf8')));
  assert.ok(move >= 0, 'the guest-list move migration is missing');
  assert.ok(drop > move, 'event_sponsors must be dropped AFTER its rows join the guest list');
  const sql = readFileSync(join(dir, files[drop]), 'utf8');
  const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.generate_event_connections('));
  assert.ok(fn.length < sql.length, 'generate_event_connections is re-created before the drop');
  assert.doesNotMatch(fn.slice(0, fn.indexOf('$$;')), /event_sponsors/, 'the live function no longer reads the table');
});

test('the page draws the guest list’s sponsors, and a refused read stops it', () => {
  const page = src('page.tsx');
  assert.match(page, /readEventSponsorGuests\(admin, eventId\)/);
  assert.doesNotMatch(page, /\.from\('event_sponsors'\)/);
  assert.match(page, /const sponsorRowsError = sponsorRows === null;/, 'the refusal is the guest read’s own');
  const refused = page.indexOf('if (sponsorRowsError) {');
  assert.ok(refused > 0 && refused < page.indexOf('slots filled'), 'never "0 of N slots" over a refused read');
});
