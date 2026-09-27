/**
 * the-maker-adds-a-scene-to-the-draft.test.ts — "+ ADD A SCENE" WORKS IN THE
 * EVENT HUB MAKER (DECISION_LOG 2026-09-27; owner: *"yes add the add a scene"*).
 *
 * Measured on origin/main before this: the toolbar's ＋ was a `ComingNext`
 * bubble (it did nothing), and the navigator's "+ Add a scene" wrote the new
 * scene LIVE — a half-made scene a guest could meet before the couple pressed
 * Apply. This holds:
 *
 *   D. the added scene is in the DRAFT: live it is hidden on both guest paths,
 *      the host's overlay shows it, Apply publishes it (never held as Pro), and
 *      Restore / a stale draft for the same slot cannot leak into it;
 *   N. it appears in the navigator (the overlaid rows), and not on live;
 *   W. `addCustomSection` takes the draft door AFTER the Pro refusal and the
 *      six-cap, inserts the row hidden, drafts it shown, and lands back with
 *      `?scene=` so it is selected with its panel open;
 *   C. the six-cap holds;
 *   P. the Pro lock holds: a free couple gets the note with the padlock, never
 *      the sheet; the store shell gets nothing;
 *   T. the toolbar ＋ is no longer "coming next": it opens the SAME sheet as the
 *      navigator's button, and every "+ Add a scene" sheet posts `draft=1`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { ADDED_SCENE_LIVE, addedSceneDraft } from './scene-writes';
import { sceneTemplateDefaults } from './scene-templates';
import {
  classifyHubDraft,
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftWidgets,
  planHubDraftApply,
} from './hub-draft';
import { openBrowseSectionVisible, widgetShouldRender, type InvitationWidgetRow, type WidgetType } from './invitation-widgets';
import { CUSTOM_SECTION_TYPES, nextFreeCustomSlot } from './custom-sections';
import { makerStageList, stageTakesOwnScenes } from './maker-scene-list';
import { PUBLIC_STAGE_ORDER } from './public-site-stage-labels';
import type { HubSectionCanvas } from './hub-canvas';
import { MAKER_COMING_NEXT } from '../app/dashboard/[eventId]/launch/_components/maker-bar';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const WIDGETS = 'app/dashboard/[eventId]/website/widgets/actions.ts';
const C = 'app/dashboard/[eventId]/website/editor/_components/';
const PAGE = 'app/dashboard/[eventId]/website/editor/page.tsx';
const SHELL = 'app/dashboard/[eventId]/launch/_components/maker-shell.tsx';

/** The text of one function, up to the next top-level function. */
function fn(src: string, name: string): string {
  const start = src.search(new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`, 'm'));
  assert.ok(start >= 0, `function ${name} not found`);
  const rest = src.slice(start + 1);
  const next = rest.search(/^(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/m);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

function row(type: WidgetType, over: Partial<InvitationWidgetRow> = {}): InvitationWidgetRow {
  return {
    widget_id: `id-${type}`, event_id: 'e1', widget_type: type, display_order: 1, is_visible: true,
    is_always_on: false, tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto',
    ...over,
  };
}

const CANVAS = sceneTemplateDefaults(1, true) as HubSectionCanvas;

/** The row exactly as `addCustomSection`'s draft door inserts it. */
const liveAdded = row('custom_1', { ...ADDED_SCENE_LIVE, display_order: 20, config_json: { canvas: CANVAS } });

test('D · the added scene is hidden from guests live, and shown only through the draft', () => {
  // Live: hidden on BOTH guest paths.
  assert.equal(widgetShouldRender(liveAdded), false, 'a guest (flag-off path) would meet the new scene before Apply');
  assert.equal(openBrowseSectionVisible(liveAdded), false, 'a guest (open-browse path) would meet the new scene before Apply');

  // The host's canvas: the draft overlay shows it, with its template.
  const draft = mergeHubDraft(emptyHubDraft(), {
    widgets: { custom_1: addedSceneDraft({ displayOrder: 20, canvas: CANVAS }) },
  });
  const [host] = overlayHubDraftWidgets([liveAdded], draft);
  assert.equal(widgetShouldRender(host!), true, 'the host canvas must draw the scene just added');
  assert.equal(openBrowseSectionVisible(host!), true);
  assert.deepEqual((host!.config_json as { canvas?: unknown }).canvas, CANVAS);

  // Apply publishes it — and a free couple's Apply does not hold it as Pro.
  const live = { events: {}, widgets: [liveAdded] };
  const { items, orphans } = classifyHubDraft(draft, live);
  assert.deepEqual(orphans, []);
  const show = items.find((i) => i.kind === 'widget' && i.field === 'is_visible');
  assert.ok(show && show.value === true, 'Apply must write is_visible: true for the added scene');
  for (const ownsPro of [false, true]) {
    const plan = planHubDraftApply(draft, live, ownsPro);
    const isShow = (i: (typeof plan.apply)[number]) =>
      i.kind === 'widget' && i.widgetType === 'custom_1' && i.field === 'is_visible' && i.value === true;
    assert.ok(plan.apply.some(isShow), `Apply (ownsPro=${ownsPro}) must publish the added scene`);
    assert.ok(!plan.refused.some(isShow), `Apply (ownsPro=${ownsPro}) held the added scene back`);
  }

  // Restore throws the draft away: the preview matches the guest link again.
  const [restored] = overlayHubDraftWidgets([liveAdded], null);
  assert.equal(widgetShouldRender(restored!), false);
});

test('D · a stale draft for the same slot (removed, then added again) cannot leak into the new scene', () => {
  const stale = mergeHubDraft(emptyHubDraft(), {
    widgets: { custom_1: { mode: 'hidden', display_order: 3, canvas: sceneTemplateDefaults(9, true) as HubSectionCanvas } },
  });
  const draft = mergeHubDraft(stale, { widgets: { custom_1: addedSceneDraft({ displayOrder: 20, canvas: CANVAS }) } });
  const [host] = overlayHubDraftWidgets([liveAdded], draft);
  assert.equal(host!.mode, 'auto', 'an old "Hidden" must not hide the new scene');
  assert.equal(host!.display_order, 20, 'the new scene goes to the end, not an old place');
  assert.deepEqual((host!.config_json as { canvas?: unknown }).canvas, CANVAS, "an old template must not replace the one just picked");
});

test('N · it appears in the navigator (the overlaid rows), and live alone keeps it folded as hidden', () => {
  const base = { stage: 'rsvp' as const, openBrowse: false, content: {}, solemn: false, hasHeroMedia: false, hasEntourage: false, storyRenders: false };
  const draft = mergeHubDraft(emptyHubDraft(), { widgets: { custom_1: addedSceneDraft({ displayOrder: 20, canvas: CANVAS }) } });
  for (const openBrowse of [false, true]) {
    const drafted = makerStageList({ ...base, openBrowse, widgets: overlayHubDraftWidgets([liveAdded], draft) });
    const tile = drafted.shown.find((t) => t.key === 'w:custom_1');
    assert.ok(tile && tile.kind === 'scene' && tile.widgetId === liveAdded.widget_id, `openBrowse=${openBrowse}: the added scene is not in the navigator`);
    const liveOnly = makerStageList({ ...base, openBrowse, widgets: [liveAdded] });
    assert.ok(!liveOnly.shown.some((t) => t.key === 'w:custom_1'), `openBrowse=${openBrowse}: live alone must not draw it`);
    assert.ok(liveOnly.folded.some((f) => f.key === 'w:custom_1' && f.hiddenByCouple));
  }
  console.log('[add-a-scene] navigator: shown with the draft, folded (hidden) live — both paths');
});

test('W · addCustomSection: Pro refusal → six-cap → draft door → hidden insert → drafted shown → back with ?scene=', () => {
  const body = fn(read(WIDGETS), 'addCustomSection');
  const at = {
    pro: body.search(/refuseCustomSectionWithoutPro\(eventId,/),
    cap: body.search(/nextFreeCustomSlot\(used\)/),
    door: body.search(/if \(isHubDraftWrite\(formData\)\) \{/),
    insert: body.search(/\.\.\.ADDED_SCENE_LIVE,/),
    drafted: body.search(/saveHubDraftPatch\(eventId, \{\s*widgets: \{ \[slot as string\]: addedSceneDraft\(/),
    scene: body.search(/searchParams\.set\('scene',/),
    live: body.search(/is_visible: true,/),
  };
  console.log(`[add-a-scene] addCustomSection anchors: ${JSON.stringify(at)}`);
  assert.ok(at.pro > 0, 'the Pro refusal is gone');
  assert.ok(at.cap > at.pro, 'the six-cap must be read after the Pro refusal');
  assert.ok(at.door > at.cap, 'the draft door must come AFTER the Pro refusal and the six-cap');
  assert.ok(at.insert > at.door, 'the draft door must insert the row hidden (ADDED_SCENE_LIVE)');
  assert.ok(at.drafted > at.insert, 'the draft must then say the scene is shown');
  assert.ok(at.scene > at.drafted, 'the draft door must land back with ?scene= so the new scene is selected');
  assert.ok(at.live > at.scene, 'the live insert (is_visible: true) must sit AFTER the draft door, unreachable from it');
  const door = body.slice(at.door, at.scene);
  assert.doesNotMatch(door, /is_visible:\s*true/, 'the draft door must never insert a visible row');
  assert.match(body.slice(at.scene, at.live), /redirect\(/, 'the draft door must end in a redirect');
  assert.deepEqual(ADDED_SCENE_LIVE, { is_visible: false });
});

test('C · the six-cap holds: a seventh scene has no slot', () => {
  assert.equal(nextFreeCustomSlot([...CUSTOM_SECTION_TYPES]), null);
  assert.equal(nextFreeCustomSlot(CUSTOM_SECTION_TYPES.slice(0, 5)), CUSTOM_SECTION_TYPES[5]);
  // …and the Maker offers the sheet only where a slot is free.
  assert.match(read(PAGE), /!nextFreeCustomSlot\(allWidgets\.map\(\(w\) => w\.widget_type\)\)\s*\?\s*\{ note:/);
});

test('P · the Pro lock holds: free → the note with the padlock; the store shell → nothing; only an owner gets the sheet', () => {
  const page = read(PAGE);
  assert.match(
    page,
    /addScene=\{\s*storeShell\s*\?\s*null\s*:\s*!ownsPro\s*\?\s*\{ note: '[^']*Event Hub Pro\.', locked: true \}/,
    'a free couple must get the Pro note (locked), and the store shell nothing',
  );
  const shell = read(`${C}editor-shell.tsx`);
  const portal = shell.slice(shell.indexOf('addHost && addScene'), shell.indexOf('addHost,', shell.indexOf('addHost && addScene')));
  assert.ok(portal.length > 0, 'the toolbar ＋ portal is gone');
  assert.match(portal, /'action' in addScene \?[\s\S]*onClick=\{\(\) => setAddOpen\(true\)\}[\s\S]*: \(\s*<AddSceneRefused note=\{addScene\.note\} locked=\{addScene\.locked === true\}/);
  const refused = fn(shell, 'AddSceneRefused');
  assert.match(refused, /\{locked \? \([\s\S]*<PaidMark state="locked"/, 'a Pro refusal must wear the padlock');
  assert.doesNotMatch(refused, /<form\b|formAction|action=/, 'the refused ＋ must not be able to post anything');
});

test('T · the toolbar ＋ is not "coming next" any more — it opens the same drafted sheet', () => {
  assert.ok(!('add' in MAKER_COMING_NEXT), 'MAKER_COMING_NEXT still says Add a scene is coming');
  const shell = read(SHELL);
  assert.doesNotMatch(shell, /MAKER_COMING_NEXT\.add|<ComingNext label="Add a scene"/);
  assert.match(shell, /<span id=\{MAKER_ADD_SCENE_SLOT_ID\}/, 'the toolbar has no ＋ slot');
  const work = read(`${C}editor-shell.tsx`);
  assert.match(work, /setAddHost\(document\.getElementById\(MAKER_ADD_SCENE_SLOT_ID\)\)/);
  // One sheet, two doors: the navigator's picker is controlled by the same state.
  assert.match(work, /<SceneTemplatePicker\s+overlay\s+draft\s+open=\{addOpen\}\s+onOpenChange=\{setAddOpen\}\s+action=\{addScene\.action\}/);
  // Every "+ Add a scene" sheet in the Maker posts draft=1.
  let adds = 0;
  for (const file of [`${C}editor-shell.tsx`, `${C}sections-panel.tsx`]) {
    for (const m of read(file).matchAll(/<SceneTemplatePicker\b[\s\S]*?\/>/g)) {
      if (!/triggerLabel="\+ Add a scene"/.test(m[0])) continue;
      adds += 1;
      assert.match(m[0], /\sdraft\s/, `${file}: an "+ Add a scene" sheet that writes live`);
    }
  }
  console.log(`[add-a-scene] "+ Add a scene" sheets, all drafted: ${adds}`);
  assert.equal(adds, 2);
});

test('the stage rule: a scene of their own may be added on every stage today (one function to re-point)', () => {
  for (const stage of PUBLIC_STAGE_ORDER) assert.equal(stageTakesOwnScenes(stage), true, stage);
  // Both doors ask it.
  const work = read(`${C}editor-shell.tsx`);
  assert.ok((work.match(/stageTakesOwnScenes\(stage\)/g) ?? []).length >= 2);
});
