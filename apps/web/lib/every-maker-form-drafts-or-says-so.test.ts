/**
 * every-maker-form-drafts-or-says-so.test.ts — NO SILENT LIVE WRITE IN THE MAKER.
 *
 * Owner, 2026-09-25: the host edits his own PUBLIC Event Hub in the Maker, and
 * work in progress must never reach a guest. Every edit stays in the draft until
 * Apply — or, where a writer has no draft door yet, the control SAYS on the page
 * that it saves immediately.
 *
 * So every `<form>` rendered inside the Maker carries EXACTLY ONE of:
 *
 *   <HubDraftField />        — and then its action must be bound to a writer
 *                              that really diverts on `draft=1` (the doors
 *                              `hub-draft-wiring.test.ts` proves per function);
 *   <HubSavesImmediately />  — and then it must be on LIVE below, with a reason.
 *
 * Controls that write without a `<form>` of their own (a client editor posting
 * from a transition, the address field, go-live, the theme link) are held to
 * carrying the mark beside them (NO_FORM_WRITERS).
 *
 * 🔑 THE CHAIN, NOT THE WORD. A `HubDraftField` on a form whose writer has no
 * door is a lie that renders exactly like the truth (the save goes live anyway).
 * So a draft-marked form's action expression is followed through the page's
 * props (`toggleAction={toggleWidgetVisibility}`) to the writer, and the writer
 * must be one of the doors. A writer whose door covers only one intent
 * (`saveCustomSection` → `arrange`) is draft-marked only on that intent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const C = 'app/dashboard/[eventId]/website/editor/_components/';
const PAGE = 'app/dashboard/[eventId]/website/editor/page.tsx';

/** Every file whose forms render inside the Maker. */
const MAKER_FILES = [
  `${C}editor-shell.tsx`,
  `${C}sections-panel.tsx`,
  `${C}media-panels.tsx`,
  `${C}pro-panels.tsx`,
  `${C}authoring-panels.tsx`,
  `${C}text-panel.tsx`,
  `${C}scene-slots-panel.tsx`,
  `${C}scene-template-picker.tsx`,
  PAGE,
  'app/dashboard/[eventId]/launch/page.tsx',
  'app/dashboard/[eventId]/launch/_components/hub-stage.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-shell.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-tour.tsx',
  'app/dashboard/[eventId]/launch/_components/hub-pro-offer.tsx',
];

/**
 * The writers with a draft door — the SAME list `hub-draft-wiring.test.ts`
 * proves divert before their first live `.update(`. Value: the intent the door
 * covers, when it covers only one.
 */
const DRAFT_WRITERS: Record<string, RegExp | null> = {
  toggleWidgetVisibility: null,
  setSectionMode: null,
  moveWidgetUp: null,
  moveWidgetDown: null,
  setWidgetMotion: null,
  setWidgetBackground: null,
  setWidgetCrop: null,
  saveRsvpBackdrop: null,
  clearRsvpBackdrop: null,
  // Its door covers the section's CANVAS: layout (`arrange`) and a template
  // scene's `slot` · `video` · `template`. Its words and removal stay live.
  saveCustomSection: /name="intent"\s+value="arrange"|intent:\s*'(?:slot|video|template)'/,
};

/**
 * THE LIVE ALLOWLIST — `file#Component#action` → why it has no draft door yet.
 * Each one renders "Saves immediately ⓘ". Shrink this list; never grow it
 * without a reason a couple would accept.
 */
const WORDS = 'words and content, not look — the draft holds no words column (lib/hub-draft.ts file note)';
const MEDIA = 'media — its writer verifies and screens the file; draft media is open owner decision D6';
const NEVER = 'never drafted by the build plan — address, who can view, what guests get and open browsing stay live';
const LIVE: Record<string, string> = {
  [`${C}sections-panel.tsx#SectionsPanel#saveCustomAction`]:
    `a section's own words (config_json.custom) and removing a section (deletes its row) — ${WORDS}`,
  // "+ Add a scene" (addCustomSection, inserts a row) is the template picker's
  // live half — held by the picker test at the bottom, not by a row here.
  [`${C}media-panels.tsx#HeroPhotoPanel#action`]: MEDIA,
  [`${C}media-panels.tsx#GalleryPanel#action`]: MEDIA,
  [`${C}media-panels.tsx#SiteChromePanel#action`]: MEDIA,
  [`${C}media-panels.tsx#VisibilityPanel#action`]: NEVER,
  [`${C}media-panels.tsx#OpenBrowsePanel#action`]: NEVER,
  [`${C}media-panels.tsx#LaunchPhasePanel#action`]: NEVER,
  [`${C}pro-panels.tsx#ColorsPanel#action`]:
    'colours, face and art direction are painted by app/[slug]/layout.tsx, which cannot see ?editor=1 — a drafted colour would be a save the preview never shows',
  [`${C}text-panel.tsx#TextPanel#action`]: WORDS,
  [`${C}authoring-panels.tsx#DressCodePanel#action`]: WORDS,
  [`${C}authoring-panels.tsx#StoryPanel#action`]: WORDS,
};

/** Writers the Maker's page may bind that go live — each behind a LIVE form above. */
const LIVE_WRITERS = new Set([
  'updateLandingPageVisibility',
  'setLaunchPhase',
  'setOpenBrowse',
  'updateSiteColors',
  'updateSiteChrome',
  'uploadHeroPhoto',
  'updateOurStory',
  'updateOurPhotos',
  'updateDressCode',
  'updateSpecialMessage',
  'updateWhatToBring',
  'addCustomSection',
  // saveCustomSection is BOTH: its `arrange` intent is drafted, its words are live.
]);

/** A panel's prop name → the writer the page binds it to (read, then checked). */
const PROP_TO_WRITER: Record<string, string> = {
  toggleAction: 'toggleWidgetVisibility',
  moveUpAction: 'moveWidgetUp',
  moveDownAction: 'moveWidgetDown',
  setModeAction: 'setSectionMode',
  setMotionAction: 'setWidgetMotion',
  setBackgroundAction: 'setWidgetBackground',
  setCropAction: 'setWidgetCrop',
  saveCustomAction: 'saveCustomSection',
  saveAction: 'saveRsvpBackdrop',
  clearAction: 'clearRsvpBackdrop',
};

/**
 * A prop name that means a DIFFERENT writer in one file. `scene-slots-panel.tsx`
 * is handed `saveAction={saveCustomAction}` by `SectionsPanel` (checked below);
 * everywhere else `saveAction` is the backdrop's.
 */
const PROP_OVERRIDES: Record<string, Record<string, string>> = {
  [`${C}scene-slots-panel.tsx`]: { saveAction: 'saveCustomSection' },
};

type Form = { file: string; component: string; action: string; body: string; line: number };

/** Every `<form …>…</form>` in a file, with its action expression and enclosing component. */
function formsIn(file: string, src: string): Form[] {
  const out: Form[] = [];
  const re = /<form\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + 5;
    let depth = 0;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    const tag = src.slice(m.index, i + 1);
    const close = src.indexOf('</form>', i);
    assert.ok(close > 0, `${file}: a <form> with no </form>`);
    const body = src.slice(m.index, close);
    const own = /\baction=\{([^}]*)\}/.exec(tag)?.[1]?.trim();
    const viaButtons = [...body.matchAll(/\bformAction=\{([^}]*)\}/g)].map((x) => x[1]!.trim());
    const before = src.slice(0, m.index);
    const fns = [...before.matchAll(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/gm)];
    out.push({
      file,
      component: fns.length ? fns[fns.length - 1]![1]! : '(top level)',
      action: own ?? viaButtons.join('|'),
      body,
      line: before.split('\n').length,
    });
  }
  return out;
}

/** `<SectionColourChoices action={setBackgroundAction}>` — its forms post the prop it is handed. */
function resolveLocalAction(f: Form, src: string): string[] {
  if (f.file.endsWith('sections-panel.tsx') && f.component === 'SectionColourChoices' && f.action === 'action') {
    const passed = [...src.matchAll(/<SectionColourChoices\b[\s\S]*?\baction=\{(\w+)\}/g)].map((x) => x[1]!);
    assert.ok(passed.length > 0, 'SectionColourChoices is rendered with no action');
    return passed;
  }
  return f.action.split('|');
}

test('every form inside the Maker carries exactly one mark — the draft field, or "Saves immediately"', () => {
  const page = read(PAGE);
  let drafted = 0;
  let live = 0;
  const seenLive = new Set<string>();
  for (const file of MAKER_FILES) {
    const src = read(file);
    for (const f of formsIn(file, src)) {
      const where = `${file}:${f.line} (${f.component}, action=${f.action || '(none)'})`;
      const hasDraft = /<HubDraftField\s*\/>/.test(f.body);
      const hasLive = /<HubSavesImmediately\b/.test(f.body);
      assert.ok(hasDraft !== hasLive, `${where} must carry exactly ONE of <HubDraftField /> or <HubSavesImmediately />`);

      if (hasLive) {
        const key = `${file}#${f.component}#${f.action}`;
        assert.ok(LIVE[key], `${where} writes live but is not on the reasoned LIVE allowlist (${key})`);
        seenLive.add(key);
        live += 1;
        continue;
      }

      // The template picker's mark is decided by its caller (`draft`) — held by
      // its own test below, caller by caller.
      if (f.component === 'SceneTemplatePicker') {
        assert.match(f.body, /\{draft \? <HubDraftField \/> : null\}/, `${where}: the picker's tiles must post draft=1 when drafted`);
        drafted += 1;
        continue;
      }

      // Drafted: follow the action to the writer, and the writer must have a door.
      for (const prop of resolveLocalAction(f, src)) {
        const override = PROP_OVERRIDES[file]?.[prop];
        const writer = override ?? PROP_TO_WRITER[prop];
        assert.ok(writer, `${where}: "${prop}" is draft-marked but maps to no known writer`);
        const bound = override ? [] : [...page.matchAll(new RegExp(`\\b${prop}=\\{(\\w+)`, 'g'))].map((x) => x[1]);
        if (bound.length > 0) {
          for (const b of bound) assert.equal(b, writer, `${PAGE} binds ${prop} to ${b}, not the door ${writer}`);
        }
        assert.ok(writer in DRAFT_WRITERS, `${where}: ${writer} has no draft door, so the draft field would be a lie`);
        const intent = DRAFT_WRITERS[writer];
        if (intent) assert.match(f.body, intent, `${where}: ${writer}'s door covers one intent only; this form posts another`);
      }
      drafted += 1;
    }
  }
  console.log(`[maker-forms] drafted forms: ${drafted} · live forms (marked): ${live} · allowlist rows used: ${seenLive.size}`);
  assert.ok(drafted >= 26, `only ${drafted} drafted forms seen — the scan is not reading the panels`);
  for (const key of Object.keys(LIVE)) {
    assert.ok(seenLive.has(key), `LIVE allowlist row is stale — nothing renders it any more: ${key}`);
  }
});

test('every writer the Maker page binds is either a draft door or a reasoned live writer', () => {
  const page = read(PAGE);
  const bound = new Set<string>();
  for (const m of page.matchAll(/\b\w*[aA]ction=\{(\w+)/g)) bound.add(m[1]!);
  console.log(`[maker-forms] writers bound by the Maker page: ${[...bound].sort().join(', ')}`);
  assert.ok(bound.size >= 15, `only ${bound.size} writers seen`);
  for (const w of bound) {
    assert.ok(w in DRAFT_WRITERS || LIVE_WRITERS.has(w), `${w} is wired into the Maker with neither a draft door nor a reason to be live`);
  }
});

/**
 * Controls that write without a `<form>` of their own, each held to its mark.
 * `[\s{}]*` because a JSX comment between the two strips to `{}`.
 */
const NO_FORM_WRITERS: Array<[file: string, anchor: RegExp, why: string]> = [
  [`${C}authoring-panels.tsx`, /<HubSavesImmediately\b[^>]*\/>[\s{}]*<PhotoMomentsEditor\b/, 'camera cues post from a transition'],
  [PAGE, /<HubSavesImmediately\b[^>]*\/>[\s{}]*<LaunchStdButton\b/, 'go-live publishes the page'],
  ['app/dashboard/[eventId]/launch/_components/hub-stage.tsx', /<SlugField\b[^>]*\/>[\s{}]*<HubSavesImmediately\b/, 'the address is never drafted'],
  [`${C}editor-shell.tsx`, /Choose your theme[\s\S]{0,200}<\/Link>[\s{}]*<HubSavesImmediately\b/, 'the theme picker writes events.invite_theme live'],
];

test('controls that write without a form of their own say "Saves immediately" beside them', () => {
  for (const [file, anchor, why] of NO_FORM_WRITERS) {
    assert.match(read(file), anchor, `${file}: ${why} — and must say so`);
  }
  console.log(`[maker-forms] no-form writers marked: ${NO_FORM_WRITERS.length}`);
});

test("the navigator's hidden form — the eye, the modes and every drag step — posts the draft field", () => {
  const shell = read(`${C}editor-shell.tsx`);
  const nav = formsIn(`${C}editor-shell.tsx`, shell).find((f) => /data-op="toggle"/.test(f.body));
  assert.ok(nav, 'the navigator form is gone');
  assert.match(nav.body, /<HubDraftField\s*\/>/);
  for (const op of ['toggleAction', 'setModeAction', 'moveUpAction', 'moveDownAction']) {
    assert.match(nav.body, new RegExp(`formAction=\\{${op}\\}`), `the navigator no longer posts ${op}`);
  }
});

test('the Maker shows the draft it edits: the panels read the draft laid over the live rows', () => {
  const page = read(PAGE);
  const overlay = page.indexOf('overlayHubDraftWidgets(liveWidgets, hubDraft)');
  assert.ok(overlay > 0, 'the editor page must lay the draft over the live section rows');
  assert.ok(page.indexOf('readHubDraft(supabase, eventId)') < overlay, 'the draft is read before it is laid over');
  const sections = page.indexOf('const sectionRows = [...allWidgets]');
  assert.ok(sections > overlay, 'the section rows (navigator + panels) must come from the overlaid rows');
  assert.match(page, /overlayHubDraftEvent\([^)]*hubDraft\)\.rsvp_backdrop/, 'the backdrop panel must show the drafted backdrop');
});

test("the canvas preview loads the host's draft (?editor=1)", () => {
  const shell = read(`${C}editor-shell.tsx`);
  assert.match(shell, /const previewSrc = publicLandingUrl \? `\$\{publicLandingUrl\}\?phase=\$\{stage\}&editor=1`/);
  assert.match(shell, /src=\{previewSrc\}/);
});

test('the scene template picker: "Change template" drafts, "+ Add a scene" says it saves immediately', () => {
  const picker = read(`${C}scene-template-picker.tsx`);
  assert.match(picker, /\{!draft \? <HubSavesImmediately \/> : null\}/, 'the add sheet must say it saves immediately');
  let drafted = 0;
  let live = 0;
  for (const file of MAKER_FILES) {
    const src = read(file);
    for (const m of src.matchAll(/<SceneTemplatePicker\b[\s\S]*?\/>/g)) {
      const use = m[0];
      const action = /\baction=\{([\w.]+)\}/.exec(use)?.[1];
      const isDraft = /^\s*draft\s*$/m.test(use) || /\sdraft(?:=\{true\})?[\s/]/.test(use);
      if (isDraft) {
        drafted += 1;
        assert.equal(file, `${C}scene-slots-panel.tsx`, `${file}: only the slots panel's "Change template" may draft`);
        assert.equal(action, 'saveAction');
        assert.match(use, /intent:\s*'template'/, 'a drafted picker must post intent=template (the door)');
      } else {
        live += 1;
        assert.ok(
          action === 'addCustomAction' || action === 'addScene.action',
          `${file}: a picker without draft posts ${action} — only "+ Add a scene" (addCustomSection) may write live`,
        );
      }
    }
  }
  // The slots panel's saveAction really is saveCustomSection.
  assert.match(read(`${C}sections-panel.tsx`), /<SceneSlotsPanel\b[\s\S]*?saveAction=\{saveCustomAction\}/);
  assert.match(read(PAGE), /addScene=[\s\S]*?action: addCustomSection/);
  console.log(`[maker-forms] template pickers: drafted ${drafted} · add (live, marked) ${live}`);
  assert.equal(drafted, 1);
  assert.ok(live >= 2);
});
