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
 *      the host's overlay shows it, Apply publishes it for an owning couple —
 *      and, since 2026-09-28 ("A FREE COUPLE MAY USE EVERY PRO FEATURE IN THE
 *      MAKER — PRO IS ASKED FOR AT APPLY"), HOLDS it for a couple without Pro,
 *      keeping it shown in their draft and naming it on the Apply sheet —
 *      and Restore / a stale draft for the same slot cannot leak into it;
 *   N. it appears in the navigator (the overlaid rows), and not on live;
 *   W. `addCustomSection` takes the draft door AFTER the Pro refusal (which the
 *      draft door passes — Apply is its gate) and the six-cap, inserts the row hidden, drafts it shown, and lands back on the
 *      address the couple is on (`lib/maker-stay.ts` — never a `?scene=` that
 *      would remount the Maker); the work area selects the scene that appeared;
 *   C. the six-cap holds;
 *   P. a free couple on the web gets the sheet (tried free, paid at Apply); the
 *      store shell gets nothing;
 *   T. the toolbar ＋ is no longer "coming next": the work area registers what
 *      it may do (`MakerAddScene`), the shell's ＋ (desktop) and More ▾ row
 *      (phone) open the SAME sheet as the navigator's button, and every
 *      "+ Add a scene" sheet posts `draft=1`.
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
import { makerAddShowsOn } from './maker-selection';
import { PUBLIC_STAGE_ORDER } from './public-site-stage-labels';
import type { HubSectionCanvas } from './hub-canvas';

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

  // Apply publishes it for an owning couple — and HOLDS it for a free one
  // (2026-09-28: tried free, paid at Apply), keeping it shown in their draft.
  const live = { events: {}, widgets: [liveAdded] };
  const { items, orphans } = classifyHubDraft(draft, live);
  assert.deepEqual(orphans, []);
  const show = items.find((i) => i.kind === 'widget' && i.field === 'is_visible');
  assert.ok(show && show.value === true, 'Apply must write is_visible: true for the added scene');
  const isShow = (i: { kind: string; widgetType?: string; field?: string; value?: unknown }) =>
    i.kind === 'widget' && i.widgetType === 'custom_1' && i.field === 'is_visible' && i.value === true;
  const owner = planHubDraftApply(draft, live, true);
  assert.ok(owner.apply.some(isShow), 'Apply (ownsPro) must publish the added scene');
  assert.ok(!owner.refused.some(isShow), 'Apply (ownsPro) held the added scene back');
  const free = planHubDraftApply(draft, live, false);
  assert.ok(!free.apply.some(isShow), 'Apply WITHOUT Pro put a scene of their own in front of guests');
  assert.ok(free.refused.some(isShow), 'the scene of their own is not held for Pro');
  assert.equal(free.remaining.widgets.custom_1?.is_visible, true, 'a held scene must stay SHOWN in the draft');

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

test('W · addCustomSection: Pro refusal → six-cap → draft door → hidden insert → drafted shown → back on the same address', () => {
  const body = fn(read(WIDGETS), 'addCustomSection');
  const at = {
    pro: body.search(/refuseCustomSectionWithoutPro\(eventId,/),
    cap: body.search(/nextFreeCustomSlot\(used\)/),
    door: body.search(/if \(drafting\) \{/),
    drafting: body.search(/const drafting = isHubDraftWrite\(formData\)/),
    insert: body.search(/\.\.\.ADDED_SCENE_LIVE,/),
    drafted: body.search(/saveHubDraftPatch\(\s*eventId,\s*\{\s*widgets: \{ \[slot as string\]: addedSceneDraft\([\s\S]{0,160}\{ formData, fallback: DRAFT_FALLBACK\(eventId\) \}/),
    back: body.search(/return landAfterWrite\(formData, `\/dashboard\/\$\{eventId\}\/launch\?drafted=1`/),
    live: body.search(/is_visible: true,/),
  };
  console.log(`[add-a-scene] addCustomSection anchors: ${JSON.stringify(at)}`);
  assert.ok(at.pro > 0, 'the Pro refusal is gone');
  assert.ok(at.drafting > 0 && at.drafting < at.pro, 'the draft decision must be made before the Pro refusal');
  // 💎 Outside the Maker the door still refuses a free couple; in it, Apply does.
  assert.match(body, /refuseCustomSectionWithoutPro\(eventId, \{\s*intent: 'add',\s*ownsPro: ownsPro \|\| drafting,/);
  assert.ok(at.cap > at.pro, 'the six-cap must be read after the Pro refusal');
  assert.ok(at.door > at.cap, 'the draft door must come AFTER the Pro refusal and the six-cap');
  assert.ok(at.insert > at.door, 'the draft door must insert the row hidden (ADDED_SCENE_LIVE)');
  assert.ok(at.drafted > at.insert, 'the draft must then say the scene is shown');
  assert.ok(at.back > at.drafted, 'the draft door must end by landing back in place through landAfterWrite (the Maker stays mounted)');
  assert.ok(at.live > at.back, 'the live insert (is_visible: true) must sit AFTER the draft door, unreachable from it');
  const door = body.slice(at.door, at.live);
  assert.doesNotMatch(door, /is_visible:\s*true/, 'the draft door must never insert a visible row');
  /* 🧷 Never `?scene=<id>`: a new page key remounts the whole Maker
     (`lib/maker-stay.ts`). The work area selects the scene that appeared. */
  assert.doesNotMatch(door, /searchParams\.set\(|[?&]scene=/, 'the draft door must not change the page key to select the scene');
  assert.deepEqual(ADDED_SCENE_LIVE, { is_visible: false });

  // …and the work area does the selecting: remembers the scenes it had at the
  // tap, then picks the custom scene that was not among them.
  const work = read(`${C}editor-shell.tsx`);
  assert.match(work, /onPick=\{onPickTemplate\}/, 'the sheet does not tell the work area a tile was tapped');
  assert.match(work, /scenesBeforeAdd\.current = new Set\(scenes\.map\(\(s\) => s\.type\)\)/);
  assert.match(work, /scenes\.find\(\(s\) => !before\.has\(s\.type\)\)[\s\S]{0,200}select\(\{ kind: 'scene', id: added\.id \}\)/);
});

test('C · the six-cap holds: a seventh scene has no slot', () => {
  assert.equal(nextFreeCustomSlot([...CUSTOM_SECTION_TYPES]), null);
  assert.equal(nextFreeCustomSlot(CUSTOM_SECTION_TYPES.slice(0, 5)), CUSTOM_SECTION_TYPES[5]);
  // …and the Maker offers the sheet only where a slot is free.
  assert.match(read(PAGE), /!nextFreeCustomSlot\(allWidgets\.map\(\(w\) => w\.widget_type\)\)\s*\?\s*\{ note:/);
});

test('P · 💎 a free couple gets the sheet on the web (Apply asks for Pro); the store shell → nothing', () => {
  const page = read(PAGE);
  assert.match(
    page,
    /addScene=\{\s*storeShell\s*\?\s*null\s*:\s*!nextFreeCustomSlot\(/,
    'the store shell must get nothing, and every other couple the sheet (or the six-cap note)',
  );
  assert.doesNotMatch(page, /Scenes of your own, from 25 templates, come with Event Hub Pro/, 'a free couple is still turned away at the door');
  // The work area registers the answer — ready opens the sheet, refused
  // carries only the six-cap note: there is no Pro refusal any more.
  const work = read(`${C}editor-shell.tsx`);
  const reg = work.slice(work.indexOf('const setAddScene = maker?.setAddScene'), work.indexOf('const scenesBeforeAdd'));
  assert.ok(reg.length > 0, 'the work area no longer registers ＋ Add a scene with the shell');
  assert.match(reg, /'action' in addScene\s*\?\s*\{ kind: 'ready', open: \(\) => setAddOpen\(true\), tried: addScene\.tried === true \}\s*:\s*\{ kind: 'refused', note: addScene\.note \}/);
  // …and the shell draws no padlock and no link to the buy page on either door
  // (owner 2026-09-28: "they can Add. only pay when apply is tirggered").
  const shell = read(SHELL);
  const tool = fn(shell, 'AddSceneTool');
  assert.doesNotMatch(tool, /state="locked"|See Event Hub Pro|unlockHref/, 'the toolbar ＋ still wears a Pro padlock');
  assert.match(tool, /state="try"/, 'the toolbar ＋ does not wear ◆ PRO for a couple trying it');
  assert.doesNotMatch(tool, /<form\b|formAction|action=/, 'the refused ＋ must not be able to post anything');
  const row = shell.slice(shell.indexOf("stageAdd?.kind === 'refused' ? ("), shell.indexOf('Snap grid'));
  assert.doesNotMatch(row, /state="locked"/, 'the phone row still wears a Pro padlock');
});

test('T · the toolbar ＋ is not "coming next" any more — it opens the same drafted sheet', () => {
  // `MAKER_COMING_NEXT` itself is gone (2026-09-28) — `the-maker-promises-nothing.test.ts`.
  const shell = read(SHELL);
  assert.doesNotMatch(shell, /MAKER_COMING_NEXT\.add|<ComingNext label="Add a scene"/);
  // Two doors in the shell, both drawn from the registration: the desktop
  // toolbar's ＋ and the phone's More ▾ row.
  assert.match(shell, /<AddSceneTool addScene=\{stageAdd\} \/>/, 'the toolbar has no ＋');
  assert.match(fn(shell, 'AddSceneTool'), /onClick=\{addScene\.open\}/, 'the ready ＋ must open the work area\'s sheet');
  assert.match(
    shell,
    /stageAdd\?\.kind === 'ready' \? \(\s*<MenuItem className="md:hidden" onClick=\{\(\) => \{ close\(\); stageAdd\.open\(\); \}\}>/,
    'the phone has no Add a scene row',
  );
  // …and the same sheet: the navigator's picker is controlled by the state the registration opens.
  const work = read(`${C}editor-shell.tsx`);
  assert.match(work, /<SceneTemplatePicker\s+overlay\s+draft\s+open=\{addOpen\}\s+onOpenChange=\{setAddOpen\}\s+onPick=\{onPickTemplate\}\s+tour=\{addScene\.tour \?\? null\}\s+action=\{addScene\.action\}/);
  // First-visit tour, the shipped mechanism (`MiniTour`), mounted with the sheet.
  assert.match(read(PAGE), /tour: <MiniTour tourKey="customer_add_scene_v1" storeShell=\{storeShell\} \/>/);
  assert.match(read(`${C}scene-template-picker.tsx`), /\{tour\}/);
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

test('S · ＋ Add a scene shows ONLY on a stage — hidden on every page (owner 2026-09-28: "it should only show on stages")', () => {
  // A stage: nothing, a scene, a row or the Main background selected.
  for (const sel of [null, { kind: 'scene', id: 'W1' }, { kind: 'row', key: 'colors' }, { kind: 'main' }] as const) {
    assert.equal(makerAddShowsOn(sel as never), true, `＋ hidden on a stage (${JSON.stringify(sel)})`);
  }
  // Every page: Logo · Hero · Reveal · Love Story · Post Event · Prints · Details · RSVP.
  for (const key of ['logo', 'hero', 'reveal', 'love-story', 'post-event', 'prints', 'details', 'rsvp-page'] as const) {
    assert.equal(makerAddShowsOn({ kind: 'tool', key }), false, `＋ shows on the ${key} page`);
  }
  // Both doors ask it — the toolbar ＋ and the phone's More ▾ row read ONE value.
  const shell = read(SHELL);
  assert.match(shell, /const stageAdd = makerAddShowsOn\(selection\) \? addScene : null;/);
  const doors = shell.slice(shell.indexOf('const stageAdd'));
  assert.doesNotMatch(doors, /<AddSceneTool addScene=\{addScene\}|addScene\?\.kind === 'ready'|addScene\?\.kind === 'refused'/, 'a door reads the registration without asking the stage rule');
});
