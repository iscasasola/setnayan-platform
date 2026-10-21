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
 *   2 · A CLIPPED WORD IS "TIGHT". The pill may not clip (its 44 px press reaches past it), so the
 *       word clips itself with an ellipsis and the BUTTON never overflows. `fitAsOne` must still see
 *       the clipped word and drop the icons as one — never settle on icon + "Supp…".
 *   3 · THE PILL NEVER CLIPS ITS OWN PRESS. No stylesheet rule whose subject is a door pill sets
 *       `overflow: hidden` — that clipped the `.ab::after` expander and the doors pressed at 40 px.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): the old "Edit your Guest list" label · the
 * label check dropped from `fitAsOne` · `overflow: hidden` put back on `.home-doors > .ab.ab-neutral`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildCustomerMenuTree } from '@/lib/customer-menu';
import { stripComments } from '@/lib/strip-comments';
import { HOME_DOOR_LABELS, HomeDoorways, doorsFor, fitAsOne } from './_components/home-parts';

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
    const a = anchors.find((x) => x.includes(`data-testid="home-door-${key}"`));
    assert.ok(a, `the ${key} door is missing`);
    const word = /<span class="lbl">([^<]*)<\/span>/.exec(a!)?.[1] ?? '';
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

/* ── 2 · fitAsOne, on a stand-in DOM: the pill never overflows, only its word does. ── */
type Fake = { scrollWidth: number; clientWidth: number; offsetParent: object | null };
function fakeRow(wordFitsWith: { icon: boolean; text: boolean }) {
  let state: '' | 'text-only' | 'icon-only' = '';
  // Live getters: fitAsOne collects the words once, then re-measures them after each state change.
  const clipped = () => state !== 'icon-only' && (state === '' ? !wordFitsWith.icon : !wordFitsWith.text);
  const word = (): Fake => ({
    get scrollWidth() {
      return clipped() ? 80 : 50;
    },
    clientWidth: 50,
    get offsetParent() {
      return state === 'icon-only' ? null : {};
    },
  });
  const button = () => ({
    scrollWidth: 100,
    clientWidth: 100,
    classList: {
      remove: () => {
        state = '';
      },
      add: (c: string) => {
        state = c as typeof state;
      },
    },
  });
  const buttons = [button(), button(), button()];
  const row = {
    scrollWidth: 320,
    clientWidth: 320,
    querySelectorAll: (sel: string) => (sel === '.ab' ? buttons : sel === '.ab .lbl' ? [word(), word(), word()] : []),
  };
  return row as unknown as HTMLElement;
}

test('2 · a word that clips makes the row tight — the icons drop as one, the words stay', () => {
  assert.equal(fitAsOne(fakeRow({ icon: true, text: true })), '', 'room for icon + word: keep both');
  assert.equal(
    fitAsOne(fakeRow({ icon: false, text: true })),
    'text-only',
    'the word clipped beside its icon and fitAsOne did not see it — the row would read icon + "Supp…"',
  );
  assert.equal(fitAsOne(fakeRow({ icon: false, text: false })), 'icon-only', 'no room for a word at all: icons');
});

/* ── 3 · the pill never clips its own press expander ── */
function cssFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) cssFiles(rel, out);
    else if (rel.endsWith('.css')) out.push(rel);
  }
  return out;
}

test('3 · no rule on a door pill clips its overflow — the doors press at 44 px', () => {
  const files = cssFiles('app');
  let doorRules = 0;
  for (const rel of files) {
    const css = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sels = m[1]!.split(/,(?![^(]*\))/).map((s) => s.trim());
      // The subject (last compound) is the pill itself: `.home-doors … .ab…`, not something inside it.
      const onPill = sels.filter((s) => /\.home-doors\b/.test(s) && /\.ab(?![-\w])[^\s>+~]*$/.test(s));
      if (onPill.length === 0) continue;
      doorRules += 1;
      assert.doesNotMatch(
        m[2]!,
        /overflow(-x|-y)?\s*:\s*(hidden|clip)/,
        `${rel}: "${onPill.join(', ')}" clips the door pill — its 44 px press expander (.ab::after) is cut to the 40 px paint`,
      );
    }
  }
  assert.ok(doorRules >= 2, `found ${doorRules} door-pill rules across ${files.length} stylesheets — the scan is blind`);
});
