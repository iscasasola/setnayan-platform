import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SEARCH_SCOPES } from './search-scope';

/**
 * TWO SEARCH BOXES CAN COEXIST — THEY MAY NOT MAKE THE SAME PROMISE.
 *
 * Owner 2026-08-20, pointing at the marketplace's own box on `/explore`:
 * *"why is there a search bar for this? shouldn't this be same on the top
 * search bar?"* Measured: both were on screen at once, ~140px apart, and both
 * said "…vendors" — the shared bar reads "Search events, people, vendors" and
 * the in-page one read "Search vendors, services, or places".
 *
 * They do different jobs and merging them would drop the seven filter values
 * the in-page one preserves. So the rule this guard keeps is narrower and
 * durable: **the in-page control must not advertise itself as a second global
 * search over the same noun.**
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

const code = (rel: string) =>
  readFileSync(join(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

const TAXONOMY = code('app/(shell)/explore/_components/taxonomy-search.tsx');
const TOPBAR = code('app/dashboard/(launcher)/_components/home-command-bar.tsx');

test('the guards read real source, not a stub', () => {
  assert.ok(TAXONOMY.length > 1000, 'taxonomy-search.tsx is missing or a stub');
  assert.ok(TOPBAR.length > 1000, 'home-command-bar.tsx is missing or a stub');
});

/**
 * The bar-variant placeholder, anchored to the `placeholder=` prop.
 *
 * 🪤 THE FIRST CUT OF THIS GUARD MATCHED THE WRONG TERNARY. `isHero ? … : …`
 * appears more than once in that component — the className branch too — so an
 * un-anchored search returned a Tailwind class list and the assertion failed
 * with a message about CSS. Anchor to the PROP, never to the condition.
 */
function inPagePlaceholder(src: string): string {
  const m = /placeholder=\{[\s\S]{0,200}?isHero[\s\S]{0,160}?:\s*'([^']+)'/.exec(src);
  assert.ok(m, 'could not find the bar-variant placeholder — re-aim this guard');
  const label = m[1];
  assert.ok(label, 'the placeholder matched but captured nothing — re-aim this guard');
  return label;
}

test('the in-page marketplace box does not advertise a global search', () => {
  const label = inPagePlaceholder(TAXONOMY);

  assert.doesNotMatch(
    label,
    /^Search\b/i,
    `The in-page box reads "${label}". Leading with "Search" beside a magnifier ` +
      'is what made it read as a rival to the bar directly above it. Name what ' +
      'it narrows instead.',
  );
  assert.match(
    label,
    /narrow|refine|filter/i,
    `The in-page box reads "${label}" and no longer says what it does to the ` +
      'results already on screen.',
  );
});

test('the two boxes do not promise the same noun', () => {
  const inPage = inPagePlaceholder(TAXONOMY).toLowerCase();

  /*
    ⚠ RE-AIMED 2026-09-23, AND IT NOW READS THE REAL VALUES. This used to pull
    the top bar's placeholder out of the component source with
    `/'(Search [^']*?)'/`. That worked only while the words were a hard-coded
    literal in the JSX; they now come from `SEARCH_SCOPES`, because the box
    announces WHICH PLACE it is pointed at (owner 2026-09-23). The regex found
    nothing and the guard fired its own "re-aim this guard" message — which is
    exactly what a guard keyed on a spelling should do, and why this one now
    imports the module instead.

    🔑 STRONGER THAN BEFORE, NOT WEAKER. It used to check ONE string. It now
    checks EVERY scope's placeholder, long and short — so a scope added later
    cannot reintroduce the collision on a screen nobody re-tested.
  */
  const topPlaceholders = Object.values(SEARCH_SCOPES).flatMap((s) => [
    s.placeholder.toLowerCase(),
    s.shortPlaceholder.toLowerCase(),
  ]);
  assert.ok(topPlaceholders.length > 0, 'no scope placeholders — re-aim this guard');

  /*
    The overlap that actually confused a person: BOTH naming the people who
    sell. Whichever noun the product settles on, the two controls must not
    both lead with it while sitting on the same screen.
  */
  for (const noun of ['vendor', 'supplier']) {
    for (const topWords of topPlaceholders) {
      assert.ok(
        !(inPage.includes(noun) && topWords.includes(noun)),
        `Both search boxes now promise "${noun}" — top: "${topWords}", ` +
          `in-page: "${inPage}". That is the exact duplication the owner ` +
          'reported: one control drawn twice.',
      );
    }
  }
});
