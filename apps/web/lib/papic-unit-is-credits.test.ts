/**
 * GUARD — ONE unit word on every Papic surface: "credits" (owner 2026-10-13,
 * "Add all" — tester item 4: "today credits / shots / points"). A shot is still
 * a photo someone takes ("That shot didn't save"); what is COUNTED, bought, left
 * or run out of is a credit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SURFACES = [
  'app/dashboard/[eventId]/studio/papic/_components/credit-stepper.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/guest-contributions-card.tsx',
  'app/dashboard/[eventId]/studio/papic/_components/papic-stage.tsx',
  'app/dashboard/[eventId]/studio/papic/extra-cameras-picker.tsx',
  'app/dashboard/[eventId]/studio/papic/couple-challenges-manager.tsx',
  'app/papic/guest/_components/papic-guest-capture.tsx',
  'app/papic/seat/[token]/_components/papic-seat-capture.tsx',
  'app/papic/order/[token]/page.tsx',
  'app/papic/_components/papic-buy-shell.tsx',
  'app/papic/demo/[token]/_components/demo-join-flow.tsx',
  'app/vendor-dashboard/on-the-day/live/[eventId]/_components/papic-capture-controller.tsx',
  'lib/papic-crew-roster.ts',
  'lib/papic-exhaustion-truth.ts',
  'lib/papic-guest-buy.ts',
];

/** The unit, counted: N shots / points left · out of shots · adds N shots · added points … */
const UNIT = /\b(?:shots?|points?) (?:left|are live|ran out|remain)|out of (?:shots|points)|adds [^'"`]{0,40}\bshots\b|added (?:points|[^'"`]{0,40}\bshots\b)|\bshots (?:are bought|into the)|Capture points/i;

for (const rel of SURFACES) {
  test(`${rel}: the unit is credits`, () => {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    const hit = src.match(UNIT);
    assert.equal(hit, null, `${rel} counts in shots/points again: "${hit?.[0]}"`);
  });
}
