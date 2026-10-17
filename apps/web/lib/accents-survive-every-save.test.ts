/**
 * accents-survive-every-save.test.ts — 🕯 EVERY SCENE'S ACCENT PICK SURVIVES THE NEXT PICK, ANOTHER SAVE, ✓ APPLY AND A
 * RELOAD (owner 17 Oct, verbatim: *"the accents are not saving"*).
 *
 * THE MEASURED CAUSE. The accents are ONE map (`style_preferences.scene_accents`) and a pick saves it WHOLE. A pick is a
 * held save — no Maker render follows it — so the map the page handed down (`picks`) stays the LAST render's. Each
 * scene's Accent ▾ is its own row, so the next scene's pick was built on that old map and its whole-map save took the
 * earlier scenes' picks back out of the draft. The draft door itself (`mergeHubDraft`) was never the one dropping them:
 * a `love_story` save keeps every other drafted column, and `style_preferences` merges key by key — both held here as
 * properties, so neither can start dropping one later.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): the pick built on the render's map again (`noteAccentPick`
 * reading `server` instead of `draftedAccentsOr(server)`) · `mergeHubDraft` replacing `style_preferences` whole ·
 * `mergeHubDraft` replacing `draft.events` whole · the store's accents copy not told of an unheld write.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

/* The store listens for the unheld write on `window` — a plain EventTarget stands in, installed BEFORE the store loads. */
(globalThis as unknown as { window: EventTarget }).window ??= new EventTarget();
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const EVENT = 'app/dashboard/[eventId]/website/editor/_components';

/** One events-door save, exactly as `useHeldEventsSave` sends it and `hub-draft-actions.ts` merges it. */
async function save(draft: import('./hub-draft').HubDraft, events: Record<string, unknown>) {
  const { mergeHubDraft } = await import('./hub-draft');
  return mergeHubDraft(draft, JSON.parse(JSON.stringify({ events })));
}

const MOMENTS = { moments: [{ title: 'We met', body: 'At the café on Katipunan.' }] };

test('THE OWNER’S WALK: an accent on every scene, then a Love Story edit — every pick is in the draft, and survives ✓ Apply and a reload', async () => {
  const { emptyHubDraft, planHubDraftApply } = await import('./hub-draft');
  const { ACCENT_SCENES, SCENE_ACCENTS, SCENE_ACCENTS_PREF_KEY, sceneAccentsFromPreferences } = await import('./art-kit-accents');
  const store = await import('./maker-draft-store');
  const { MAKER_UNHELD_WRITE_EVENT } = await import('./maker-refresh');

  /* Live as cale-ice had it before the walk: one pick (E-Gifts' spray). The Maker renders ONCE, with that map. */
  const liveBlob = { [SCENE_ACCENTS_PREF_KEY]: { gifts: 'spray' }, onboarding: { vibe: 'garden' } };
  const rendered = sceneAccentsFromPreferences(liveBlob);
  store.makerRendered('render-1');

  /* A pick on EVERY scene that offers one — each its own row, each handed the SAME render's map (no render between). */
  let draft = emptyHubDraft();
  const want: Record<string, string> = {};
  for (const scene of ACCENT_SCENES) {
    const id = SCENE_ACCENTS[scene][0]!.id;
    want[scene] = id;
    const { next } = store.noteAccentPick(scene, id, rendered);
    draft = await save(draft, { style_preferences: { [SCENE_ACCENTS_PREF_KEY]: next } });
  }
  /* …and one back to None (a free pick), still built on that same render. */
  want.gifts = 'none';
  draft = await save(draft, { style_preferences: { [SCENE_ACCENTS_PREF_KEY]: store.noteAccentPick('gifts', 'none', rendered).next } });
  /* Then a Love Story moment is edited — another key of the same events door. */
  draft = await save(draft, { love_story: MOMENTS });

  const drafted = sceneAccentsFromPreferences(draft.events.style_preferences);
  assert.deepEqual(drafted, want, 'a later scene’s pick took an earlier scene’s out of the draft (the 17 Oct fault)');
  const alone = (await save(emptyHubDraft(), { love_story: MOMENTS })).events.love_story;
  assert.ok(alone, 'the Love Story sample is not a draftable value');
  assert.deepEqual(draft.events.love_story, alone, 'the Love Story save was lost');

  /* ✓ Apply, owning Event Hub Pro (cale-ice does): the accents are written, nothing is held. */
  const live = { events: { style_preferences: liveBlob }, widgets: [] } as unknown as import('./hub-draft').HubLiveState;
  const plan = planHubDraftApply(draft, live, true);
  const item = plan.apply.find((i) => i.kind === 'event' && i.column === 'style_preferences');
  assert.ok(item && item.kind === 'event', 'Apply does not write the accents');
  assert.equal(plan.refused.length, 0, 'Apply held something back from a couple who owns Pro');
  /* Laid into the live blob as the action lays it (`{ ...(prefs ?? {}), ...qrWrite }`, held below). */
  const after = { ...liveBlob, ...(item.value as Record<string, unknown>) };
  assert.deepEqual(sceneAccentsFromPreferences(after), want, 'Apply did not make every pick live');
  assert.deepEqual(after.onboarding, liveBlob.onboarding, 'Apply wrote the blob over its other keys');

  /* Reload: Apply was an unheld write, the Maker renders with the new live map and the draft left empty — the page wins. */
  window.dispatchEvent(new Event(MAKER_UNHELD_WRITE_EVENT));
  store.makerRendered('render-2');
  const reread = sceneAccentsFromPreferences(after);
  assert.deepEqual(store.draftedAccentsOr(reread), want, 'after Apply and a reload the rows do not read what is live');
});

test('after ↺ (an unheld write, then a render) a row reads the page’s map again — never an undone pick', async () => {
  const store = await import('./maker-draft-store');
  const { MAKER_UNHELD_WRITE_EVENT } = await import('./maker-refresh');
  store.makerRendered('undo-1');
  store.noteAccentPick('countdown', 'narra-columns', {});
  assert.deepEqual(store.draftedAccentsOr({}), { countdown: 'narra-columns' }, 'a pick is not shown before the render catches up');
  window.dispatchEvent(new Event(MAKER_UNHELD_WRITE_EVENT));
  store.makerRendered('undo-2');
  assert.deepEqual(store.draftedAccentsOr({}), {}, 'after ↺ the undone accent is still shown and would be saved back');
});

/* — THE DOOR, AS A PROPERTY: two draft writes to different events keys both survive — */

test('PROPERTY: a drafted value of EVERY events column survives a Love Story save and an Accent save after it', async () => {
  const { HUB_DRAFT_EVENT_COLUMNS, emptyHubDraft } = await import('./hub-draft');
  const { SCENE_ACCENTS_PREF_KEY } = await import('./art-kit-accents');
  let checked = 0;
  for (const col of HUB_DRAFT_EVENT_COLUMNS) {
    const sentinel = col === 'style_preferences' ? { camera_look: 'brand' } : { kept: col };
    const start = { ...emptyHubDraft(), events: { [col]: sentinel } } as import('./hub-draft').HubDraft;
    let d = start;
    if (col !== 'love_story') d = await save(d, { love_story: MOMENTS });
    if (col !== 'style_preferences') {
      d = await save(d, { style_preferences: { [SCENE_ACCENTS_PREF_KEY]: { countdown: 'narra-columns' } } });
      assert.deepEqual(d.events[col], sentinel, `a later save erased the drafted ${col}`);
    } else {
      d = await save(d, { style_preferences: { [SCENE_ACCENTS_PREF_KEY]: { countdown: 'narra-columns' } } });
      assert.equal((d.events.style_preferences as Record<string, unknown>).camera_look, 'brand', 'an Accent save erased the drafted camera look');
    }
    checked += 1;
  }
  assert.ok(checked >= 40, `only ${checked} columns checked — the column list could not be read`);
});

test('PROPERTY: every key of the drafted style_preferences survives a save of every other key, in both orders', async () => {
  const { emptyHubDraft } = await import('./hub-draft');
  const { SCENE_ACCENTS_PREF_KEY } = await import('./art-kit-accents');
  const parts: Record<string, Record<string, unknown>> = {
    accents: { [SCENE_ACCENTS_PREF_KEY]: { hero: 'drapes', rsvp: 'garland' } },
    camera: { camera_look: 'challenges' },
    blocks: { block_looks: { schedule: { fade: true } } },
  };
  for (const [a, pa] of Object.entries(parts)) {
    for (const [b, pb] of Object.entries(parts)) {
      if (a === b) continue;
      let d = emptyHubDraft();
      d = await save(d, { style_preferences: pa });
      d = await save(d, { style_preferences: pb });
      const sp = d.events.style_preferences as Record<string, unknown>;
      for (const [k, v] of Object.entries({ ...pa, ...pb })) assert.deepEqual(sp[k], v, `${b} saved after ${a} erased ${k}`);
    }
  }
});

/* — THE WIRING: the row builds on the store, the store hears the Maker, Apply merges into the live blob — */

test('the Accent row reads and builds through the Maker’s draft store — never on the render’s map', () => {
  const row = stripComments(readFileSync(join(__dirname, '..', EVENT, 'accent-row.tsx'), 'utf8'));
  assert.match(row, /useState<SceneAccents>\(\(\) => draftedAccentsOr\(picks\)\)/, 'the row seeds its shown map from the render again');
  assert.match(row, /useEffect\(\(\) => setMine\(draftedAccentsOr\(picks\)\), \[picks\]\)/);
  assert.match(row, /const \{ before, next \} = noteAccentPick\(scene, id, picks\);/, 'a pick is not built on (and noted in) the store');
  assert.doesNotMatch(row, /\{ \.\.\.mine, \[scene\]: id \}|\{ \.\.\.picks, \[scene\]: id \}/, 'a pick is built on a copy of the render again');
  const store = stripComments(readFileSync(join(__dirname, 'maker-draft-store.ts'), 'utf8'));
  assert.match(store, /const before = draftedAccentsOr\(server\);/, 'noteAccentPick builds on the render’s map');
  assert.match(store, /accentsShared\.unheld\(\);/, 'the store’s accents copy is not told of an unheld write (↺ · Apply)');
  assert.match(store, /accentsShared\.rendered\(stamp\);/, 'the store’s accents copy is not told of a Maker render');
  const action = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/hub-draft-actions.ts'), 'utf8'));
  assert.match(action, /\.update\(\{ style_preferences: \{ \.\.\.\(prefs \?\? \{\}\), \.\.\.qrWrite \} \}\)/, 'Apply no longer lays the drafted keys INTO the live blob');
});
