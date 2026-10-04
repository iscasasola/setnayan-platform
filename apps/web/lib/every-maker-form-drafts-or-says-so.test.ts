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
const S = 'app/dashboard/[eventId]/website/our-story/';

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
  // Post Event's preset tiles, split out of the picker to load with its sheet.
  `${C}post-event-preset-tiles.tsx`,
  // Our Love Story's scrapbook (Maker Phase 7) — opened from the Maker's Love
  // Story tool; a separate page, but the host edits the same public hub there.
  `${S}page.tsx`,
  `${S}_components/love-story-book.tsx`,
  `${S}_components/moment-sheet.tsx`,
  `${S}_components/pick-from-our-events.tsx`,
  // ⚡ The Maker's instant Love Story (2026-09-30): its words form saves through
  // the draft itself as it is typed (`editLoveStory` → `hubDraftAction`).
  `${S}_components/love-story-live.tsx`,
  PAGE,
  'app/dashboard/[eventId]/launch/page.tsx',
  'app/dashboard/[eventId]/launch/_components/hub-stage.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-shell.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-tour.tsx',
  'app/dashboard/[eventId]/launch/_components/hub-pro-offer.tsx',
  // The made-once group (Maker Phase 6) — Hero · Reveal · Logo.
  'app/dashboard/[eventId]/launch/_components/maker-made-once.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-reveal.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-logo.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-prints.tsx',
  'app/dashboard/[eventId]/launch/_components/maker-details.tsx',
  // Details part 2b: the special message's one editor (Words, its print switch, and a tap on a stage).
  'app/dashboard/[eventId]/launch/_components/special-message-field.tsx',
  // Prints & Tickets' Menu editor (owner 2026-09-28, "add to print out our meals for tonight").
  'app/dashboard/[eventId]/launch/_components/print-menu-editor.tsx',
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
  // Maker Phase 6 — the one hero (`draftHero`, proven in hub-draft-wiring).
  uploadHeroPhoto: null,
  removeHeroPhoto: null,
  // Its door covers the section's CANVAS: layout (`arrange`) and a template
  // scene's `slot` · `video` · `template` — and, since 2026-09-29, an empty
  // scene's first WORDS without Pro (`save` on draft=1). Removal stays live.
  saveCustomSection: /name="intent"\s+value="arrange"|intent:\s*'(?:slot|video|template)'|wordsDrafted \? <HubDraftField \/>/,
  // 2026-09-25 — the Maker's live savers into the draft (`draftEventsAndReturn`,
  // proven per function in maker-live-savers-draft.test.ts).
  updateSiteColors: null,
  updateSpecialMessage: null,
  updateWhatToBring: null,
  updateOurStory: null,
  updateDressCode: null,
  loveStoryMomentAction: null,
  // 2026-09-27 — "+ Add a scene" (DECISION_LOG "+ ADD A SCENE" WORKS IN THE
  // EVENT HUB MAKER): the row is inserted HIDDEN and drafted shown, so guests
  // meet it at Apply (proven in the-maker-adds-a-scene-to-the-draft.test.ts).
  addCustomSection: null,
  // 2026-09-30 — the draft ITSELF (intent=save): the Maker's instant Love Story
  // words form is never submitted; each box saves here as it is typed.
  hubDraftAction: null,
  // 2026-09-29 — the last three Pro tools (owner "yes to all 3"): the song and
  // the hero video, and the gallery, each drafted (`draftEventsAndReturn`).
  updateSiteChrome: null,
  updateOurPhotos: null,
};

/**
 * A panel handed its writer as a plain `action` prop (`<ColorsPanel
 * action={updateSiteColors.bind(null, eventId)}>`): `file#Component#prop` →
 * the writer, and the caller that must bind it so. Followed like
 * `PROP_TO_WRITER`: a draft-marked form whose caller binds some OTHER writer
 * would be a draft field on a live save.
 */
const COMPONENT_WRITERS: Record<string, { writers: string[]; caller: string; binds: RegExp }> = {
  // 2026-09-29 — drafted (owner "yes to all 3").
  [`${C}media-panels.tsx#GalleryPanel#action`]: {
    writers: ['updateOurPhotos'],
    caller: PAGE,
    binds: /<GalleryPanel\s+action=\{(\w+)\.bind/g,
  },
  [`${C}media-panels.tsx#SiteChromePanel#action`]: {
    writers: ['updateSiteChrome'],
    caller: PAGE,
    binds: /<SiteChromePanel\s+action=\{(\w+)\.bind/g,
  },
  [`${C}pro-panels.tsx#ColorsPanel#action`]: {
    writers: ['updateSiteColors'],
    caller: PAGE,
    binds: /<ColorsPanel\s+action=\{(\w+)\.bind/g,
  },
  [`${C}text-panel.tsx#TextPanel#action`]: {
    writers: ['updateSpecialMessage', 'updateWhatToBring'],
    caller: PAGE,
    binds: /<TextPanel\s+action=\{(\w+)\.bind/g,
  },
  [`${C}authoring-panels.tsx#StoryPanel#action`]: {
    writers: ['updateOurStory'],
    caller: PAGE,
    binds: /<StoryPanel\s+action=\{(\w+)\.bind/g,
  },
  [`${C}authoring-panels.tsx#DressCodePanel#action`]: {
    writers: ['updateDressCode'],
    caller: PAGE,
    binds: /<DressCodePanel\s+action=\{(\w+)\.bind/g,
  },
  [`${C}media-panels.tsx#HeroPhotoPanel#action`]: {
    writers: ['uploadHeroPhoto'],
    caller: PAGE,
    binds: /<HeroPhotoPanel\s+action=\{(\w+)\}/g,
  },
  [`${S}page.tsx#OurStoryEditorPage#updateAction`]: {
    writers: ['updateOurStory'],
    caller: `${S}page.tsx`,
    binds: /const updateAction = (\w+)\.bind/g,
  },
  [`${S}_components/love-story-book.tsx#LoveStoryBook#p.action`]: {
    writers: ['loveStoryMomentAction'],
    caller: `${S}page.tsx`,
    binds: /const action = (\w+)\.bind/g,
  },
  // `keep` posts the `action` it is handed, and closes the sheet (2026-09-30).
  [`${S}_components/moment-sheet.tsx#MomentSheet#keep`]: {
    writers: ['loveStoryMomentAction'],
    caller: `${S}page.tsx`,
    binds: /const action = (\w+)\.bind/g,
  },
  [`${S}_components/pick-from-our-events.tsx#PickFromOurEvents#action`]: {
    writers: ['loveStoryMomentAction'],
    caller: `${S}page.tsx`,
    binds: /const action = (\w+)\.bind/g,
  },
  // Details › Words › Special message — its own component since part 2b (the
  // stage's tap opens it too); the launch page binds its writer once.
  ['app/dashboard/[eventId]/launch/_components/special-message-field.tsx#SpecialMessageField#action']: {
    writers: ['updateSpecialMessage'],
    caller: 'app/dashboard/[eventId]/launch/page.tsx',
    binds: /specialMessageAction: (\w+)\.bind/g,
  },
};

/**
 * THE LIVE ALLOWLIST — `file#Component#action` → why it has no draft door yet.
 * Each one renders "Saves immediately ⓘ". Shrink this list; never grow it
 * without a reason a couple would accept.
 */
const NEVER = 'never drafted by the build plan — address, who can view, what guests get and open browsing stay live';
const LIVE: Record<string, string> = {
  [`${C}sections-panel.tsx#SectionsPanel#saveCustomAction`]:
    "words a scene of their own ALREADY has, and removing a scene (deletes the row), save live — an EMPTY scene's first words draft without Pro (2026-09-29), one mark per row",
  // "+ Add a scene" (addCustomSection) drafts since 2026-09-27 — held by the
  // picker test at the bottom, not by a row here.
  [`${C}media-panels.tsx#VisibilityPanel#action`]: NEVER,
  [`${C}media-panels.tsx#OpenBrowsePanel#action`]: NEVER,
  [`${C}media-panels.tsx#LaunchPhasePanel#action`]: NEVER,
  // Phase 9 · the Details panel (made-once): what the prints include and the
  // print-only lines (`events.print_details` — the include toggles, the opening
  // line, the "Kindly reply" choice).
  ['app/dashboard/[eventId]/launch/_components/maker-details.tsx#MakerDetails#PRINT_WORDS_ENDPOINT']:
    'the printed set\'s settings (events.print_details) — read only by the prints the couple downloads (lib/print-set.server.ts), never by a guest page, so there is nothing for a guest to see before Apply',
  // The Menu card's moments and dishes — the same column, the same reason.
  ['app/dashboard/[eventId]/launch/_components/print-menu-editor.tsx#PrintMenuEditor#PRINT_MENU_ENDPOINT']:
    'the Menu card\'s moments and dishes (events.print_details.menu) — read only by the prints the couple downloads, never by a guest page, so there is nothing for a guest to see before Apply',
};

/** Writers the Maker's page may bind that go live — each behind a LIVE form above. */
const LIVE_WRITERS = new Set([
  'updateLandingPageVisibility',
  'setLaunchPhase',
  'setOpenBrowse',
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
  // The instant words form has no action: every box saves through `editLoveStory`.
  [`${S}_components/love-story-live.tsx`]: { '': 'hubDraftAction' },
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

/** `<SectionColourChoices action={setBackgroundAction}>` and the scene's
 *  `<SceneBackgroundChoices action={setBackgroundAction}>` (2026-09-27) — their
 *  forms post the prop they are handed, so the writer is whatever each is
 *  rendered with. */
const PROP_POSTERS = ['SectionColourChoices', 'SceneBackgroundChoices'];
function resolveLocalAction(f: Form, src: string): string[] {
  if (f.file.endsWith('sections-panel.tsx') && PROP_POSTERS.includes(f.component) && f.action === 'action') {
    /* `action={action}` is one poster handing ITS OWN writer on to another
       (`SceneBackgroundChoices` draws the swatch row for a Pro couple with no
       photos, 2026-09-27) — the same writer, already resolved at the outer
       poster's own render sites, so it is not a writer name of its own. */
    const passed = [...src.matchAll(new RegExp(`<${f.component}\\b[\\s\\S]*?\\baction=\\{(\\w+)\\}`, 'g'))]
      .map((x) => x[1]!)
      .filter((x) => x !== 'action');
    assert.ok(passed.length > 0, `${f.component} is rendered with no action`);
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
      /* ✍ ONE mark decided per row (2026-09-29): an empty scene's first words
         draft without Pro, words it already has save live — written as ONE
         ternary between the two marks, so the form still carries exactly one.
         Its live side is still held to the LIVE allowlist below. */
      const perRow = /\{\s*\w+\s*\?\s*<HubDraftField\s*\/>\s*:\s*<HubSavesImmediately\s*\/>\s*\}/.test(f.body);
      const hasDraft = !perRow && /<HubDraftField\s*\/>/.test(f.body);
      const hasLive = perRow || /<HubSavesImmediately\b/.test(f.body);
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
      // 🎞 Post Event's preset tiles (`PresetTiles`) are the SAME picker's tiles —
      // its `draft` and its `action`, handed straight down.
      if (f.component === 'SceneTemplatePicker' || f.component === 'PresetTiles') {
        assert.match(f.body, /\{draft \? <HubDraftField \/> : null\}/, `${where}: the picker's tiles must post draft=1 when drafted`);
        drafted += 1;
        continue;
      }

      // A panel handed its writer as a plain prop: the caller must bind it to a door.
      const viaComponent = COMPONENT_WRITERS[`${file}#${f.component}#${f.action}`];
      if (viaComponent) {
        const bound = [...read(viaComponent.caller).matchAll(viaComponent.binds)].map((x) => x[1]!);
        assert.ok(bound.length > 0, `${where}: ${viaComponent.caller} no longer binds this panel's writer`);
        for (const b of bound) {
          assert.ok(viaComponent.writers.includes(b), `${where}: ${viaComponent.caller} binds ${b}, not ${viaComponent.writers.join('/')}`);
          assert.ok(b in DRAFT_WRITERS, `${where}: ${b} has no draft door, so the draft field would be a lie`);
        }
        drafted += 1;
        continue;
      }

      // Drafted: follow the action to the writer, and the writer must have a door.
      for (const prop of resolveLocalAction(f, src)) {
        const override = PROP_OVERRIDES[file]?.[prop];
        // A form may also post the writer ITSELF (`action={uploadHeroPhoto}` in
        // the made-once panels) — then the name must itself be a door.
        const writer = override ?? PROP_TO_WRITER[prop] ?? (prop in DRAFT_WRITERS ? prop : undefined);
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
  assert.ok(drafted >= 40, `only ${drafted} drafted forms seen — the scan is not reading the panels`);
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
  [PAGE, /<HubSavesImmediately\b[^>]*\/>[\s{}]*<LaunchStdButton\b/, 'go-live publishes the page'],
  ['app/dashboard/[eventId]/launch/_components/hub-stage.tsx', /<SlugField\b[^>]*\/>[\s{}]*<HubSavesImmediately\b/, 'the address is never drafted'],
  // (The Main panel's theme link left this list on 2026-09-28: the theme is
  // picked on Details into the DRAFT now — `the-theme-is-drafted.test.ts`.)
  // Phase 9 · Details: the address (the shipped SlugField — never drafted) and
  // the E-Gifts thank-you message (PabuyaMessageEditor posts from a transition).
  ['app/dashboard/[eventId]/launch/_components/maker-details.tsx', /<SlugField\b[^>]*\/>[\s{}]*<HubSavesImmediately\b/, 'the address is never drafted'],
  ['app/dashboard/[eventId]/launch/_components/maker-details.tsx', /<HubSavesImmediately\s*\/>[\s{}]*<PabuyaMessageEditor\b/, 'the thank-you message is the E-Gifts message, written live'],
  // (The Pro QR left this list on 2026-09-29: Shape · Pattern · Colour are
  // DRAFTED now — owner "yes to all 3" — held by the test below.)
  // Details part 2a · Your event (2026-09-29): the march's order (the Guest
  // list's own island) writes live. (The names and the date left this list on
  // 2026-10-01, the venues on 2026-10-04: they are DRAFTED now — owner "wait
  // for apply" / "venues wait for Apply" — held by the test below.)
  ['app/dashboard/[eventId]/launch/_components/details-march.tsx', /data-march-section-controls=\{key\}[^>]*>[\s{}]*<HubSavesImmediately \/>/, 'a march section writes live and must say so'],
  ['app/dashboard/[eventId]/launch/_components/details-march.tsx', /data-march-line-controls=[\s\S]*?<HubSavesImmediately \/>[\s{}]*<\/section>/, 'a march line writes live and must say so'],
  ['app/dashboard/[eventId]/launch/_components/details-people.tsx', /data-people-controls="parent"[^>]*>[\s{}]*<HubSavesImmediately \/>/, "a parent's card writes live and must say so"],
];

test('🔳 the QR look is a DRAFT door now — no live write, no "Saves immediately" beside it', () => {
  const action = read('app/dashboard/[eventId]/launch/qr-look-actions.ts');
  assert.match(action, /saveHubDraftPatch\(eventId, \{ events: \{ style_preferences: \{ \[QR_STYLE_PREF_KEY\]: merged \} \} \}\)/);
  assert.doesNotMatch(action, /\.update\(/, 'the QR look still writes the live row');
  assert.doesNotMatch(
    read('app/dashboard/[eventId]/launch/_components/maker-details.tsx'),
    // Bounded to the QrLookControls tag itself (`[^<]`): an open `[\s\S]*?` ran
    // on to the address's own SlugField → "Saves immediately" further down the
    // same file (Details, 2026-09-29) and convicted the wrong control.
    /<QrLookControls\b[^<]*?\/>[\s{}]*<HubSavesImmediately\b/,
    'a drafted control says it saves immediately',
  );
});

test('✍ the names and the date are DRAFT doors now — no "Saves immediately" beside them, and they say when guests see them', () => {
  const editors = read('app/dashboard/[eventId]/launch/_components/details-your-event.tsx');
  for (const [anchor, what] of [
    [/data-details-names=""[\s\S]*?<\/section>/, 'the names'],
    [/data-details-one-name=""[\s\S]*?<\/section>/, 'a one-person name'],
    [/data-details-date=""[\s\S]*?<\/section>/, 'the date'],
    // 📍 The venues and 🕒 the ceremony time (owner 2026-10-04).
    [/data-details-venues=""[\s\S]*?<\/section>/, 'the venues'],
    [/data-details-ceremony-time=""[\s\S]*?<\/section>/, 'the ceremony time'],
  ] as const) {
    const block = anchor.exec(editors)?.[0] ?? '';
    assert.ok(block.length > 0, `${what}: its editor is gone`);
    assert.doesNotMatch(block, /<HubSavesImmediately\b/, `${what} is drafted but says it saves immediately`);
  }
  assert.match(editors, /const DRAFTED = 'Saved — guests see it when you Apply';/);
  assert.match(editors, /Guests see a new date when you Apply\./);
});

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
  assert.match(shell, /const previewSrc = publicLandingUrl\s*\?\s*`\$\{publicLandingUrl\}\?phase=\$\{stage\}&editor=1/);
  // 👁 SEE AS (PR-10) never re-points the canvas elsewhere — it only adds
  // `?as=` to the SAME draft preview, so the canvas always loads the draft.
  assert.match(shell, /const canvasSrc = previewSrc;/);
  assert.match(shell, /src=\{canvasSrc\}/);
});

test('the scene template picker: "Change template" and "+ Add a scene" both draft', () => {
  const picker = read(`${C}scene-template-picker.tsx`);
  assert.match(picker, /\{!draft \? <HubSavesImmediately \/> : null\}/, 'a picker that writes live must say it saves immediately');
  // Post Event's "+" IS the picker (train n: the lazy `PostEventAddScene` wrapper
  // is gone — only its twelve tiles load lazily), so the scan below sees it.
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
        // 🎞 Post Event's twelve presets post the SAME add door (2026-09-29).
        if (action === 'addCustomAction' || action === 'addScene.action' || action === 'postEventPresets.action') {
          // "+ Add a scene" — addCustomSection's draft door (hidden row, drafted shown).
          assert.match(use, /triggerLabel="\+ Add a scene"/, `${file}: ${action} is the add sheet`);
        } else {
          assert.equal(file, `${C}scene-slots-panel.tsx`, `${file}: a drafted picker posting ${action} is neither the add sheet nor "Change template"`);
          assert.equal(action, 'saveAction');
          assert.match(use, /intent:\s*'template'/, 'a drafted picker must post intent=template (the door)');
        }
      } else {
        live += 1;
        assert.fail(`${file}: a template picker posting ${action} writes live — every Maker picker drafts`);
      }
    }
  }
  // The slots panel's saveAction really is saveCustomSection.
  assert.match(read(`${C}sections-panel.tsx`), /<SceneSlotsPanel\b[\s\S]*?saveAction=\{saveCustomAction\}/);
  assert.match(read(PAGE), /addScene=[\s\S]*?action: addCustomSection/);
  assert.match(read(PAGE), /postEventPresets=[\s\S]*?action: addCustomSection/, 'the presets post the add door');
  console.log(`[maker-forms] template pickers: drafted ${drafted} · live ${live}`);
  assert.equal(drafted, 4);
  assert.equal(live, 0);
});
