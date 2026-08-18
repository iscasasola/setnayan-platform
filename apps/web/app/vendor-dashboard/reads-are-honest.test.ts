/**
 * reads-are-honest.test.ts — a supplier's screen may not state an absence it
 * did not measure.
 *
 * ── The defect, in one sentence ────────────────────────────────────────────
 * Supabase RESOLVES with `{ error }` instead of throwing. So a refused read —
 * a phantom column, a stale enum value, an unapplied migration, a missing
 * grant — arrives as `data: null`, `?? []` turns it into an empty list, and the
 * page says "you have none" to somebody who has some. On the supplier's side
 * that sentence is read by a person running their business:
 *
 *   packages ......... "No packages yet. Build one" → to a shop already selling
 *   earnings ......... ₱0 pending · ₱0 released · ₱0 on hold
 *   partnerships ..... an incoming proposal waiting on THEM simply is not there
 *   manpower ......... claimable paid gigs, reported as hosts posting none
 *   calendar ......... "isn't part of your current plan. Upgrade" → to a payer
 *   production sheet . "No portion rules yet" → to a caterer, on the day
 *
 * ── What this file pins, and why it is only the render layer ───────────────
 * The 16 files below RENDER. An absence in them becomes a claim on screen, so
 * the error has to be bound and, where it changes what is stated, said.
 *
 * ⚠ `actions.ts` FILES ARE DELIBERATELY OUT OF SCOPE. There an absence DENIES —
 * `const { data: profile } = …; if (!profile) return { error }` — and failing
 * closed is the fix, not the defect. Pulling them in would make this guard cry
 * wolf on ~160 correct call sites, and a guard that cries wolf teaches you to
 * skim past the one time it is right.
 *
 * 🛡 Mutation-checked: each rule was broken on purpose, the occurrence count
 * printed before and after to prove the sabotage landed, and the test confirmed
 * RED before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Every supplier-facing file whose reads were made honest on 2026-08-18.
 * A new unbound read in any of them fails this test.
 */
const RENDER_FILES = [
  'activities/page.tsx',
  'calendar/surface.tsx',
  'clients/surface.tsx',
  'clients/[eventId]/page.tsx',
  'clients/[eventId]/production-sheet/page.tsx',
  'contracts/surface.tsx',
  'customers/page.tsx',
  'earnings/surface.tsx',
  'locked-qr/page.tsx',
  'manpower/surface.tsx',
  'on-the-day/page.tsx',
  'packages/page.tsx',
  'partnerships/page.tsx',
  'services/_components/services-manager.tsx',
  'shop/page.tsx',
  'website/page.tsx',
];

const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

const read = (rel: string) => code(readFileSync(join(HERE, rel), 'utf8'));

/**
 * `const { data: { user } } = await supabase.auth.getUser()` is the session
 * read, not a table read: it has no `{ error }` half worth branching on, and
 * every one of these files already redirects when `user` is absent. Exempt by
 * SHAPE, not by a file name, so the exemption cannot quietly widen.
 */
const AUTH_DESTRUCTURE = /const\s*\{\s*\n?\s*data:\s*\{\s*user\s*\}/;

test('every read on a supplier-facing screen binds the error it may be refused with', () => {
  const offenders: string[] = [];
  for (const rel of RENDER_FILES) {
    const src = read(rel);
    // Each `const { data … }` destructure, with the text up to its closing brace.
    for (const match of src.matchAll(/const\s*\{[^}]*\bdata\b[^}]*\}/g)) {
      const destructure = match[0];
      if (AUTH_DESTRUCTURE.test(destructure)) continue;
      if (/\berror\b/.test(destructure)) continue;
      const line = src.slice(0, match.index).split('\n').length;
      offenders.push(`${rel}:${line} → ${destructure.replace(/\s+/g, ' ').slice(0, 60)}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A read here can be REFUSED, and an unbound error means the refusal ' +
      'arrives as `data: null` and renders as "you have none". Bind it, log it ' +
      'with logQueryError(…, "graceful_degrade"), and where the absence changes ' +
      `what the screen states, say so on screen. Offenders: ${offenders.join(' · ')}`,
  );
});

test('the screens that state an absence carry a measured flag, not just a log line', () => {
  // POSITIVE CONTROL. Rule 1 can be satisfied by binding an error and throwing
  // it away — logging never changed a single pixel. These six are the surfaces
  // where the empty state is a CLAIM about the supplier's own work, so each one
  // must gate that claim on whether the read actually happened.
  const mustGate = [
    'packages/page.tsx',
    'locked-qr/page.tsx',
    'partnerships/page.tsx',
    'activities/page.tsx',
    'clients/[eventId]/production-sheet/page.tsx',
    'website/page.tsx',
  ];
  const missing = mustGate.filter((rel) => {
    const src = read(rel);
    return !/Measured|measured/.test(src) || !/We couldn/.test(src);
  });
  assert.deepEqual(
    missing,
    [],
    'Each of these renders "you have none" somewhere. That sentence must be ' +
      'gated on a measured flag AND the refusal must be visible to the person ' +
      `reading it. Missing: ${missing.join(', ')}`,
  );
});

test('a refused read never renders as a money figure or a headcount of zero', () => {
  // The two places a zero is worst: the supplier's payout totals, and the live
  // headcount on the screen they open at the venue on the day.
  const earnings = read('earnings/surface.tsx');
  assert.match(
    earnings,
    /payoutsMeasured\s*\?/,
    'Payout totals must be computed only when the payouts were actually read; ' +
      'formatCentavosPhp(null) renders an em-dash, and ₱0 is a claim that ' +
      'nothing is owed.',
  );
  assert.doesNotMatch(
    earnings,
    /const (pending|paid|onHold)Centavos = payouts\s*\n?\s*\.filter/,
    'Reintroducing the direct reduce puts the zero back.',
  );

  const dayOf = read('on-the-day/page.tsx');
  assert.match(
    dayOf,
    /briefMeasured \? brief\?\.pax\.(invited|attending) \?\? 0 : null/,
    'The day-of headcount must be null when the brief was not read. "0 / 0 ' +
      'attending" is not a number anybody should set a room up from.',
  );
});
