/**
 * THE DAY'S OWN PARTS ARE IN THE MAKER — Find your seat, each guest's own
 * photos, the announcements and the live hub (and the entourage) each get a
 * tile, a panel with their ONE Style row, and a place on the Maker's canvas —
 * so the couple can pick their style (owner 2026-09-29, "every scene … at least
 * three premade styles"; controller: "their Format tab with the Style row only").
 *
 * Held here:
 *   1. the navigator lists them on the stages where guests meet them, at their
 *      places in the approved order (owner 2026-10-05), and the canvas draws
 *      its stand-ins in that SAME list, order and places (`makerDayPartsOn` is
 *      read by both);
 *   2. a tile tap and a canvas tap make the same selection, and its panel is
 *      never blank;
 *   3. the stand-ins are drawn on the Maker's canvas only — never for a guest;
 *   4. the fixed panel carries the Style row for exactly these five.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { makerDayPartsOn, makerStageList, type MakerStageInput } from './maker-scene-list';
import { anchorOfTile } from './maker-navigator-tabs';
import { fixedScenePanel, selectionForCanvasKey, selectionForTile } from './maker-selection';
import { FIXED_STYLE_SCENES } from './fixed-scene-styles';
import { stripComments } from './strip-comments';

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = ['hero', 'greeting', 'qr_card', 'schedule', 'rsvp', 'venue_map', 'photo_moments', 'special_message'];
const widgets: InvitationWidgetRow[] = ORDER.map((t, i) => ({
  widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
  is_always_on: ALWAYS.has(t), tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
}));
const input = (stage: MakerStageInput['stage'], dayParts = true): MakerStageInput => ({
  stage,
  widgets,
  openBrowse: false,
  content: { schedule: true, venue_map: true, special_message: true },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: false,
  dayParts,
});

test('1 · the day’s parts are listed where guests meet them, in the approved order (owner 2026-10-05)', () => {
  const day = makerStageList(input('event')).shown.map((t) => t.key);
  assert.ok(day.includes('f:entourage'), 'the fixture draws the entourage');
  // 📑 DECISION_LOG 2026-10-05 "APPROVED — EVERY GUEST PAGE'S DEFAULT SECTION
  // ORDER": Live + Announcements first, then find your seat · schedule · venue,
  // then photo moments · your photos · photos of you, then the entourage.
  assert.deepEqual(
    day.filter((k) => k !== 'f:hero' && k !== 'f:greeting' && k !== 'f:pass' && k !== 'f:rsvp'),
    ['f:announcements', 'f:live_hub', 'f:find_your_seat', 'w:schedule', 'w:venue_map', 'w:photo_moments', 'f:photos_of_you', 'f:entourage'],
    `The Day lists ${day.join(' · ')}`,
  );
  assert.deepEqual(makerDayPartsOn('event'), ['announcements', 'live_hub', 'find_your_seat', 'photos_of_you'], 'the canvas draws the same list');
  assert.deepEqual(makerDayPartsOn('event', 'before'), ['announcements', 'live_hub', 'find_your_seat']);
  assert.deepEqual(makerDayPartsOn('event', 'after'), ['photos_of_you']);
  assert.deepEqual(makerDayPartsOn('event', 'last'), []);

  const inv = makerStageList(input('rsvp')).shown.map((t) => t.key);
  assert.deepEqual(inv.filter((k) => ['f:announcements', 'f:find_your_seat', 'f:live_hub', 'f:photos_of_you'].includes(k)), ['f:announcements']);
  assert.equal(inv[inv.length - 1], 'f:announcements', 'the Invitation’s announcement stays after the entourage');
  assert.deepEqual(makerDayPartsOn('rsvp', 'last'), ['announcements']);
  assert.deepEqual(makerStageList(input('save_the_date')).shown.filter((t) => t.key === 'f:announcements'), []);
  assert.deepEqual(
    makerStageList(input('event', false)).shown.filter((t) => t.key.startsWith('f:') && t.key !== 'f:entourage' && t.key !== 'f:hero'),
    makerStageList(input('event', false)).shown.filter((t) => ['f:greeting', 'f:pass', 'f:rsvp'].includes(t.key)),
    'without the Maker’s flag nothing is added',
  );
  for (const k of ['f:announcements', 'f:find_your_seat', 'f:live_hub', 'f:photos_of_you']) {
    assert.equal(anchorOfTile(k), 'details', `${k} sits under Details with the entourage`);
  }
});

test('2 · a tile tap and a canvas tap are the same selection, and the panel is never blank', () => {
  for (const tile of makerStageList(input('event')).shown.filter((t) => t.kind === 'fixed')) {
    if (!['f:announcements', 'f:find_your_seat', 'f:live_hub', 'f:photos_of_you'].includes(tile.key)) continue;
    assert.deepEqual(selectionForTile(tile), selectionForCanvasKey(tile.key, []), tile.key);
    const panel = fixedScenePanel(tile.kind === 'fixed' ? tile.fixed : 'hero');
    assert.ok(panel.label && panel.line, `${tile.key} has a panel`);
  }
});

const WEB = join(__dirname, '..');

test('3 · the stand-ins are the Maker canvas’s alone — never a guest’s — at the navigator’s three places', () => {
  const body = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/site-body.tsx'), 'utf8'));
  const at = body.indexOf('makerDayPartsOn(pageStage, place)');
  assert.ok(at > 0, 'the canvas reads the navigator’s list, place by place');
  assert.match(body.slice(at - 40, at), /isMakerCanvas\s*\?\s*$/, 'drawn only on the Maker’s canvas');
  assert.match(body.slice(at, at + 200), /makerMark\(`f:\$\{part\}`\)/, 'each with its navigator marker');
  // The three places sit where the navigator lists them: before the stage's
  // sections, right after them, and after the entourage.
  const before = body.indexOf("makerDayStandIns('before')");
  const scenes = body.indexOf('{group(scenesTab, plan.openBrowse ? (');
  const after = body.indexOf("makerDayStandIns('after')");
  const entourage = body.indexOf('<EntourageSection groups={entourage} id="site-entourage" sceneStyle={entourageStyle} />');
  const last = body.indexOf("makerDayStandIns('last')");
  assert.ok(before > 0 && scenes > 0 && after > 0 && entourage > 0 && last > 0, 'every place is drawn');
  assert.ok(before < scenes && scenes < after && after < entourage && entourage < last, 'before · sections · after · entourage · last');
  for (const k of ['before', 'after', 'last']) {
    assert.equal(body.split(`makerDayStandIns('${k}')`).length - 1, 1, `${k} is drawn exactly once`);
  }
});

test('4 · the fixed panel carries the one Style row for exactly the five parts', () => {
  const shell = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'));
  assert.match(shell, /if \(!fixed \|\| !isFixedStyleScene\(fixed\)\) return null;/);
  assert.match(shell, /<FixedSceneStyleRow/);
  const panelAt = shell.indexOf('data-maker-fixed-panel={fixed}>');
  const styleAt = shell.indexOf('{fixedStylePanel}', panelAt);
  assert.ok(panelAt > 0 && styleAt > panelAt && styleAt < shell.indexOf('{f.line}', panelAt), 'Style first in the panel');
  assert.deepEqual([...FIXED_STYLE_SCENES], ['entourage', 'find_your_seat', 'photos_of_you', 'announcements', 'live_hub']);
  const row = stripComments(
    readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/_components/fixed-scene-style-row.tsx'), 'utf8'),
  );
  assert.match(row, /fd\.set\('intent', 'save'\)/, 'the pick goes to the draft, never live');
  assert.match(row, /fixedStyles: \{ \[scene\]: id \}/);
});
