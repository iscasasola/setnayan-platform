import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  const top = /'(Search [^']*?)'/.exec(TOPBAR);
  assert.ok(top?.[1], 'could not find the top bar placeholder — re-aim this guard');
  const topWords = top[1].toLowerCase();

  /*
    The overlap that actually confused a person: BOTH naming the people who
    sell. Whichever noun the product settles on, the two controls must not
    both lead with it while sitting on the same screen.
  */
  for (const noun of ['vendor', 'supplier']) {
    assert.ok(
      !(inPage.includes(noun) && topWords.includes(noun)),
      `Both search boxes now promise "${noun}" — top: "${topWords}", ` +
        `in-page: "${inPage}". That is the exact duplication the owner ` +
        'reported: one control drawn twice.',
    );
  }
});
