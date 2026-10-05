/**
 * NO TWO BAR BUTTONS SHARE A LABEL (coordinator, 2026-10-04, seen live at
 * 375 px on maria-and-jose, prod 5a1e75a): the Maker's phone bottom bar read
 * "Event Details ▾ · Look · Event Details". With Event Details open, Page ▾
 * named the page covering the stage, and that page's own button sat right
 * beside it. Two buttons with one name is one button too many, and the reader
 * cannot tell which one does what.
 *
 * Executed over every stage × every page that can cover it (none · Look ·
 * Event Details · Prints) × the RSVP stage open or not, with the real guest
 * pages of each stage (`makerGuestPages`), for the desktop's top bar —
 * ✕ Exit · Page ▾ (`buttonText`) · Look · Event Details · Undo · Preview · Apply.
 * (Since 2026-10-05 a phone has no bottom bar: the lower third's menu ▾ names
 * the pick and "where you are" its part — `maker-lower-third.tsx`.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { makerGuestPages } from './maker-guest-pages';
import { PUBLIC_STAGE_ORDER } from './public-site-stage-labels';
import {
  MAKER_DETAILS_LABEL,
  MAKER_LOOK_LABEL,
  MAKER_PAGE_MENU_LABEL,
  MAKER_PRINTS_LABEL,
  makerPageMenu,
} from '../app/dashboard/[eventId]/launch/_components/maker-bar';

const WEB = join(__dirname, '..');
const SHELL = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-shell.tsx'), 'utf8'));

const pagesOf = (s: (typeof PUBLIC_STAGE_ORDER)[number]) =>
  makerGuestPages(s, [], true).map((p) => ({ key: p.key, label: p.label }));

function dupes(labels: string[]): string[] {
  const seen = new Set<string>();
  return labels.filter((l) => (seen.has(l.toLowerCase()) ? true : (seen.add(l.toLowerCase()), false)));
}

test('no two buttons of either Maker bar share a label — on every stage, whatever covers it', () => {
  let checked = 0;
  for (const stage of PUBLIC_STAGE_ORDER) {
    for (const openPage of [null, MAKER_LOOK_LABEL, MAKER_DETAILS_LABEL, MAKER_PRINTS_LABEL]) {
      for (const rsvpOpen of [false, true]) {
        for (const shown of [null, ...pagesOf(stage).map((p) => p.key)]) {
          const m = makerPageMenu({ stage, rsvpOpen, liveStage: null, pagesOf, shownPage: shown, hasWork: true, openPage });
          const top = ['Exit', m.buttonText, MAKER_LOOK_LABEL, MAKER_DETAILS_LABEL, 'Undo', 'Preview', 'Apply'];
          assert.deepEqual(dupes(top), [], `top bar on ${stage} (${openPage ?? 'the stage'}): ${top.join(' · ')}`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 100, `only ${checked} bars were checked — the sweep is blind`);
});

test('the exact bar seen live: Event Details open → "Page ▾ · Look · Event Details"', () => {
  const m = makerPageMenu({ stage: 'rsvp', rsvpOpen: false, liveStage: null, pagesOf, shownPage: 'welcome', hasWork: true, openPage: MAKER_DETAILS_LABEL });
  assert.equal(m.pageText, MAKER_PAGE_MENU_LABEL);
  assert.equal(m.buttonText, MAKER_PAGE_MENU_LABEL);
  assert.equal(MAKER_PAGE_MENU_LABEL, 'Page');
  // …with a stage on screen it reads the stage's page, as before.
  assert.equal(makerPageMenu({ stage: 'rsvp', rsvpOpen: false, liveStage: null, pagesOf, shownPage: 'welcome', hasWork: true }).pageText, 'Welcome');
});

test('the shell draws the bar from those values — Page ▾ from the menu, the doors from their labels; a phone has no bottom bar', () => {
  assert.match(SHELL, /dataAttr="data-maker-page-menu"\s+value=\{page\.value\}\s+buttonText=\{page\.buttonText\}/);
  assert.doesNotMatch(SHELL, /data-maker-page-menu-phone|data-maker-bottom-bar/, 'the phone’s bottom bar is back — the lower third replaced it');
  assert.match(SHELL, /openPage: openDoor === 'look' \? MAKER_LOOK_LABEL : openDoor === 'details' \? MAKER_DETAILS_LABEL/);
});
