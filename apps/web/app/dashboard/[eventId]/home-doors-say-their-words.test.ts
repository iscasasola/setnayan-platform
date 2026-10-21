/**
 * home-doors-say-their-words.test.ts — HOME'S THREE DOORS KEEP THEIR WORDS ON EVERY PHONE.
 *
 * Owner 2026-10-22, "Yes to all" (`Setnayan/prototypes/journey_fixes_2026-10-22.html` § Host 2,
 * DECISION_LOG "HOME'S THREE DOORS SAY GUESTS · SUPPLIERS · EVENT HUB"). The doors read
 * "Edit your Guest list · Edit your Suppliers · Edit your Event Hub"; BUTTON_RULE 3a moves the row
 * as one (icon + word → word → icon), and at 375 px the long labels pushed it to ICON ONLY — a
 * first-timer's first screen was three unlabelled grey pills.
 *
 * WHAT THIS HOLDS (each a property, not a phrase):
 *   1 · A DOOR IS NAMED BY WHAT IS BEHIND IT — the tab it opens. Each rendered door's word ends with
 *       the bottom bar's own label for the same key ("Guests", "Suppliers", "…Hub") and is at most two
 *       words, so no verb phrase ("Edit your …") can come back and push the row to icons.
 *   2 · THE DOOR PRESSES AT 44 PX. The pill clips its own overflow — that is how `fitAsOne` reads a word that
 *       does not fit as one box and drops the icons as one — which also clips the `.ab::after` expander, so the
 *       PAINT is the press. Any rule on the door pill that clips its overflow must paint it at least 44 px tall
 *       (the 44 is #6756's, rd/fits-every-phone; this holds it from the door's side).
 *
 * SABOTAGE (each seen RED, then restored — see the PR): the old "Edit your Guest list" label · the door
 * pill's height put back to 40px while it clips its overflow.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildCustomerMenuTree } from '@/lib/customer-menu';
import { stripComments } from '@/lib/strip-comments';
import { HOME_DOOR_LABELS, HomeDoorways, doorsFor } from './_components/home-parts';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = import.meta.dirname;
const WEB = join(HERE, '..', '..', '..');
const KEYS = ['guests', 'explore', 'launch'] as const;

test('1 · each door says the word of the tab it opens — short enough to keep its word at 320', () => {
  const tree = buildCustomerMenuTree('S89E-DOORWORDS1', { websiteEnabled: true });
  const html = renderToStaticMarkup(React.createElement(HomeDoorways, { eventId: 'e1', navSlots: null }));
  const anchors = html.match(/<a [^>]*data-testid="home-door-[a-z]+"[^>]*>[\s\S]*?<\/a>/g) ?? [];
  assert.equal(anchors.length, KEYS.length, `expected ${KEYS.length} doors, rendered ${anchors.length} — the scan is blind`);
  for (const key of KEYS) {
    const tab = tree.find((t) => t.key === key);
    assert.ok(tab, `the bar has no ${key} tab — the comparison is blind`);
    const a: string | undefined = anchors.find((x: string) => x.includes(`data-testid="home-door-${key}"`));
    assert.ok(a, `the ${key} door is missing`);
    const word: string = /<span class="lbl">([^<]*)<\/span>/.exec(a!)?.[1] ?? '';
    assert.equal(word, HOME_DOOR_LABELS[key], `the ${key} door shows "${word}", not its label`);
    assert.ok(
      word.endsWith(tab!.label),
      `the ${key} door says "${word}" but opens the "${tab!.label}" tab — a door says what is behind it`,
    );
    assert.ok(word.split(/\s+/).length <= 2, `the ${key} door says "${word}" — a phrase, not the thing; it pushes the row to icons`);
    assert.match(a!, new RegExp(`aria-label="${word}"`), `the ${key} door's name is not its word`);
  }
  // A door whose need is off is absent — the words never depend on the event's other switches.
  assert.deepEqual(doorsFor('e1', ['explore']).map((d) => d.label), [HOME_DOOR_LABELS.guests, HOME_DOOR_LABELS.launch]);
});

/* ── 2 · the door presses at 44 ── */
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) cssFiles(rel, out);
    else if (rel.endsWith('.css')) out.push(rel);
  }
  return out;
}

test('2 · a door pill that clips its overflow paints at least 44 px — the paint is the press', () => {
  const files = cssFiles('app');
  let doorRules = 0;
  let clipping = 0;
  for (const rel of files) {
    const css = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sels = m[1]!.split(/,(?![^(]*\))/).map((s) => s.trim());
      // The subject (last compound) is the pill itself: `.home-doors … .ab…`, not something inside it.
      const onPill = sels.filter((s) => /\.home-doors\b/.test(s) && /\.ab(?![-\w])[^\s>+~]*$/.test(s));
      if (onPill.length === 0) continue;
      doorRules += 1;
      if (!/overflow(-x|-y)?\s*:\s*(hidden|clip)/.test(m[2]!)) continue;
      clipping += 1;
      const h = /(?:^|[;\s])(?:min-)?height\s*:\s*(\d+(?:\.\d+)?)px/.exec(m[2]!);
      assert.ok(
        h && Number(h[1]) >= 44,
        `${rel}: "${onPill.join(', ')}" clips its overflow (and with it the .ab::after press expander) but paints ` +
          `${h ? h[1] + 'px' : 'no height'} — a door must press at 44`,
      );
    }
  }
  assert.ok(doorRules >= 2, `found ${doorRules} door-pill rules across ${files.length} stylesheets — the scan is blind`);
  console.log(`door-pill rules: ${doorRules}, clipping: ${clipping}`);
});
