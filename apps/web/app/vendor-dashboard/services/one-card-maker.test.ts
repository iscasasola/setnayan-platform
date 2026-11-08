/**
 * one-card-maker.test.ts — a service card is made in ONE place.
 *
 * Owner, 7 Nov 2026 (DECISION_LOG "THE FOUR MAKERS ARE APPROVED — BUILD THEM AS FIXES TO THE SHIPPED SCREENS, NEVER
 * NEW ONES"): "all changes as this designs are to be fixed on the current design. we do not invent or create a new
 * one, we just fix the old one." The card maker the suppliers see is `CanvasMaker`; the 6-step `ServiceWizard` is its
 * retiring fallback behind `NEXT_PUBLIC_CANVAS_MAKER_ENABLED` (lib/canvas-maker-flag.ts) and is NOT deleted here —
 * the 2026-10-08 retirement ruling names conditions this branch could not measure (production's flag value is not
 * readable from a builder session). So this file holds the line where it is today:
 *
 *   1 · exactly two screens post the card save (`action={commitVendorService}`): the maker, and the allowlisted
 *       retiring wizard — a THIRD card form is a new maker, which the ruling forbids;
 *   2 · the wizard is reached from one place only (the new-card route, behind the flag), so it cannot spread.
 *
 * When the wizard is retired, delete it, drop it from ALLOWED and from test 2 — never widen ALLOWED.
 *
 * Sabotage, 2026-11-07: a third `<form action={commitVendorService}>` added to services-manager.tsx → test 1 red;
 * removed → green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const ALLOWED = [
  'app/vendor-dashboard/services/_components/canvas-maker.tsx',
  /** RETIRING — the flag-off fallback (lib/canvas-maker-flag.ts). Not a second maker to fix; never extend it. */
  'app/vendor-dashboard/services/_components/service-wizard.tsx',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const SOURCES = ['app', 'components', 'lib'].flatMap((d) => walk(join(WEB, d)));

test('only the card maker (and the retiring wizard) post the card save', () => {
  const posting = SOURCES.filter((p) => /action=\{commitVendorService\}/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p))
    .sort();
  assert.deepEqual(posting, [...ALLOWED].sort(), 'a new screen makes service cards — fix the shipped maker instead');
});

test('the retiring wizard is reached from the new-card route only, behind the flag', () => {
  const users = SOURCES.filter((p) => /<ServiceWizard\b/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p));
  assert.deepEqual(users, ['app/vendor-dashboard/services/new/[category]/page.tsx']);
  const page = stripComments(readFileSync(join(WEB, users[0]!), 'utf8'));
  assert.match(page, /const canvas = canvasMakerEnabled\(\);/);
  assert.ok(page.indexOf('<CanvasMaker') < page.indexOf('<ServiceWizard'), 'the wizard is no longer the fallback branch');
});
