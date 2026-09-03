import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTIRE_LIBRARY } from './palette-styles';
import { nearestColorName } from './color-names';

/**
 * How many of the palette engine's 38 ATTIRE_LIBRARY colours does the app's
 * own `nearestColorName` (`color-names.ts`, CIELAB) name the same way the
 * engine's library entry is labelled? Ported from the prototype's
 * `spec/namer-check.mjs`.
 *
 * 🔑 A MISS HERE IS NOT NECESSARILY A BUG. `ATTIRE_LIBRARY` is a WEARABILITY
 * guarantee for the OKLCH palette engine — a curated set of hexes an engine
 * needs to be able to place someone in, tuned to fill gaps in the ladder.
 * `color-names.ts`'s `WEDDING_NAMES` is a DIFFERENT curated vocabulary — the
 * words a couple, florist or stylist actually says out loud — tuned
 * independently and living in CIELAB. The two tables are not the same
 * project and were never meant to agree exactly: "Forest" (engine) vs
 * "Forest Green" (namer) is a naming-convention difference, not a colour
 * disagreement; "Olive" (engine, #8A8B5C) vs "Olive Grove" (namer,
 * literally renamed off a nearby hex 2026-09-03 to fix a hue lie) is a
 * documented, deliberate divergence.
 *
 * What DOES matter: the miss count is a BASELINE, not a target of zero. If
 * this number climbs, something about one of the two tables moved further
 * apart than it already was — worth a look, not necessarily a defect. If it
 * drops, someone tightened the vocabularies together, which is also worth
 * noticing rather than silently accepting.
 */

const KNOWN_MISSES = new Set([
  // MB5 (2026-09-03): color-names.ts retired its curated "Burgundy" entry —
  // #7A1F2B sat ΔE 4.1 from the newly-added "Garnet", i.e. the same colour
  // under two names — and repointed the word "burgundy" to Garnet via an
  // alias. ATTIRE_LIBRARY's own #7A1F2B is untouched (a wearability
  // guarantee, not the naming vocabulary), so this hex now names itself
  // differently in the two tables: a documented divergence, not a colour
  // disagreement, same as "Olive" below.
  'Burgundy',
  'Oyster',
  'Capiz Pearl',
  'Champagne',
  'Sand',
  'Shell Pink',
  'Pale Eucalyptus',
  'Warm Taupe',
  'Bronze',
  'Clay',
  'Eucalyptus',
  'Sage',
  'Olive',
  'Dusty Blue',
  'Slate Blue',
  'Stone',
  'Pearl Grey',
  'Wine',
  'Forest',
  'Deep Teal',
  'Deep Plum',
  'Chinese Red',
  'Old Gold',
]);

test(`ATTIRE_LIBRARY vs nearestColorName: ${KNOWN_MISSES.size} of ${ATTIRE_LIBRARY.length} known misses, no new ones`, () => {
  const newMisses: string[] = [];
  const nowMatching: string[] = [];
  for (const entry of ATTIRE_LIBRARY) {
    const got = nearestColorName(entry.hex);
    const matches = got === entry.name;
    if (!matches && !KNOWN_MISSES.has(entry.name)) {
      newMisses.push(`${entry.name} ${entry.hex} -> "${got}" (not a previously known miss)`);
    }
    if (matches && KNOWN_MISSES.has(entry.name)) {
      nowMatching.push(entry.name);
    }
  }
  // A new miss means the two vocabularies drifted further apart — surface it.
  assert.deepEqual(newMisses, []);
  // A known miss that now matches means they drifted CLOSER — not a failure,
  // but worth surfacing so KNOWN_MISSES can be trimmed rather than going stale.
  assert.deepEqual(nowMatching, [], 'these library colours now match nearestColorName — remove them from KNOWN_MISSES');
});
