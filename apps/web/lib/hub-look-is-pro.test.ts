/**
 * hub-look-is-pro.test.ts — EVERY DOOR TO THE PAGE'S LOOK ASKS FIRST.
 *
 * Owner, 2026-09-24 ("A"): the couple's own photos, snippets and films on the
 * Event Hub — and changing how it looks and moves — are Event Hub Pro. The
 * editor's lock is presentation; a server action is a public POST. So the real
 * gate is in the actions, and this file holds the PROPERTY, not a phrasing:
 *
 *   🔒 every exported server action, in every `'use server'` file under `app/`,
 *      that WRITES a look column (`HUB_LOOK_EVENT_COLUMNS`, with a value other
 *      than null) or a section's canvas look key (`canvas.<key> = …`) calls
 *      `requireLookPro(` or `lookProAllows(` — and calls it BEFORE its first
 *      `.update(`.
 *
 * 🔑 IT FINDS THE WRITERS ITSELF. It does not list the actions it expects; it
 * scans every server file for the writes. That is how the Save-the-Date builder
 * was found: a SECOND DOOR to `site_bg_music_r2_key`, ungated, while the site
 * editor gated the same column. A new third door fails here without anybody
 * having to remember this file exists.
 *
 * Each finding is anchored per ACTION (one exported function), never per file —
 * a file-level match cannot say which action still lacks the gate. Counts are
 * printed so a green run shows what it actually looked at.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';
import { HUB_CANVAS_LOOK_KEYS, HUB_LOOK_EVENT_COLUMNS } from './hub-look-pro';

const WEB = join(__dirname, '..');
const APP = join(WEB, 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Every `'use server'` module under app/. */
const serverFiles = walk(APP).filter((p) =>
  /^\s*['"]use server['"]/.test(readFileSync(p, 'utf8')),
);

type Action = { file: string; name: string; body: string };

/** Split a server module into its exported functions, comments stripped. */
function actionsOf(file: string): Action[] {
  const src = stripComments(readFileSync(file, 'utf8'));
  const re = /^export\s+async\s+function\s+(\w+)\s*\(/gm;
  const starts: Array<{ name: string; at: number }> = [];
  for (let m = re.exec(src); m; m = re.exec(src)) starts.push({ name: m[1]!, at: m.index });
  return starts.map((s, i) => {
    let body = src.slice(s.at, starts[i + 1]?.at ?? src.length);
    // A private helper declared after the action is not the action.
    const tail = body.search(/^(?:async\s+)?function\s+\w+\s*\(/m);
    if (tail > 0) body = body.slice(0, tail);
    return { file: relative(WEB, file), name: s.name, body };
  });
}

const colAlt = HUB_LOOK_EVENT_COLUMNS.join('|');
/** `col: <value>` (not null, not a type) · `patch.col =` · `update.col =`. */
const COLUMN_WRITE = new RegExp(
  `(?:\\b(?:${colAlt})\\s*:\\s*(?!null\\b|string\\b|boolean\\b|number\\b|unknown\\b)[^\\s,}])` +
    `|(?:\\.\\s*(?:${colAlt})\\s*=(?!=))`,
);
/** `canvas.<lookKey> = …` or `canvas[...] = …` — a section's look written. */
const CANVAS_WRITE = new RegExp(`\\bcanvas\\.(?:${HUB_CANVAS_LOOK_KEYS.join('|')})\\s*=(?!=)`);

function writesLook(body: string): boolean {
  return COLUMN_WRITE.test(body) || CANVAS_WRITE.test(body);
}

const GATE = /\b(?:requireLookPro|lookProAllows)\s*\(/;

/**
 * Writers that are NOT a couple changing their page's look, each with the
 * property that makes it so — asserted, not merely listed.
 */
const EXEMPT: Record<string, { why: string; mustContain: RegExp }> = {
  // The music team delivering a paid Pakanta song. Admin-only.
  'app/admin/pakanta/actions.ts#deliverPakantaSong': {
    why: 'admin music-team delivery, not a couple write',
    mustContain: /await assertAdmin\(\)/,
  },
  // A couple adopting the song they BOUGHT (the PAKANTA SKU, its own purchase)
  // as the site song. Gated on that purchase, not on Event Hub Pro.
  'app/dashboard/[eventId]/studio/pakanta/actions.ts#adoptPakantaSongAsSiteMusic': {
    why: 'gated on the PAKANTA purchase — a song we made them, not their upload',
    mustContain: /eventSkuActive\([^)]*'PAKANTA'\)/,
  },
  // The after-story's cover. It passes the hero ref INTO `resolveStoryCover` to
  // re-check eligibility — a read, which the detector cannot tell from a write —
  // and its one events write is the two story_cover_* columns. The story is
  // "Editorial editing", which is free for every couple (EDITORIAL_PRO in
  // FREE_FOR_ALL_SKUS). Held to that: the update must name only the cover.
  'app/dashboard/[eventId]/story/cover-actions.ts#setStoryCover': {
    why: 'reads the hero to verify a cover; writes only story_cover_kind/ref',
    mustContain: /\.update\(\{\s*story_cover_kind:[^}]*story_cover_ref:[^}]*\}\)/,
  },
};

const actions = serverFiles.flatMap(actionsOf);
const lookWriters = actions.filter((a) => writesLook(a.body));

test('the scan sees the server tree (a zero here is a broken walk, not a pass)', () => {
  console.log(
    `[hub-look-is-pro] server files: ${serverFiles.length} · exported actions: ${actions.length} · look writers: ${lookWriters.length}`,
  );
  assert.ok(serverFiles.length > 50, `only ${serverFiles.length} 'use server' files found`);
  assert.ok(actions.length > 100, `only ${actions.length} actions found`);
  // The writers this ruling was built around must be SEEN — otherwise the
  // detector itself is broken and every assertion below is vacuous.
  const names = new Set(lookWriters.map((a) => a.name));
  for (const n of [
    'uploadHeroPhoto',
    'saveLivingHero',
    'updateSiteChrome',
    'updateOurPhotos',
    'updateSiteColors',
    'saveRsvpBackdrop',
    'setWidgetMotion',
    'setWidgetBackground',
    'setWidgetCrop',
    'saveAllStdContent',
  ]) {
    assert.ok(names.has(n), `the detector no longer sees ${n} as a look writer`);
  }
});

test('every action that writes the look asks the Pro gate before it writes', () => {
  const missing: string[] = [];
  let gated = 0;
  let exempt = 0;
  for (const a of lookWriters) {
    const key = `${a.file}#${a.name}`;
    const ex = EXEMPT[key];
    if (ex) {
      assert.match(a.body, ex.mustContain, `${key} is exempt (${ex.why}) only while it holds that gate`);
      exempt += 1;
      continue;
    }
    const g = a.body.search(GATE);
    if (g < 0) {
      missing.push(`${key} — writes the look with no requireLookPro/lookProAllows`);
      continue;
    }
    const u = a.body.search(/\.update\s*\(/);
    if (u >= 0 && u < g) {
      missing.push(`${key} — its first .update( comes BEFORE the gate`);
      continue;
    }
    gated += 1;
    console.log(`[hub-look-is-pro]   gated  ${key}`);
  }
  console.log(`[hub-look-is-pro] gated: ${gated} · exempt: ${exempt} · missing: ${missing.length}`);
  assert.deepEqual(missing, []);
});

test('an exemption that no longer matches a writer is removed, not left to excuse the next one', () => {
  const seen = new Set(lookWriters.map((a) => `${a.file}#${a.name}`));
  for (const key of Object.keys(EXEMPT)) assert.ok(seen.has(key), `stale exemption: ${key}`);
});

test('removal-only actions stay ungated — taking a look off is never a purchase', () => {
  for (const [file, name] of [
    ['app/dashboard/[eventId]/website/hero-photo/actions.ts', 'removeHeroPhoto'],
    ['app/dashboard/[eventId]/website/editor/actions.ts', 'clearRsvpBackdrop'],
  ] as const) {
    const a = actions.find((x) => x.file === file && x.name === name);
    assert.ok(a, `${file}#${name} not found`);
    assert.ok(!writesLook(a.body), `${name} writes a look value — it must only clear`);
    assert.doesNotMatch(a.body, GATE, `${name} must not ask for Pro`);
  }
});

test('the words stay free — no words writer asks the look gate', () => {
  const WORDS: Array<[string, string]> = [
    ['app/dashboard/[eventId]/website/our-story/actions.ts', 'updateOurStory'],
    ['app/dashboard/[eventId]/website/dress-code/actions.ts', 'updateDressCode'],
    ['app/dashboard/[eventId]/website/special-message/actions.ts', 'updateSpecialMessage'],
    ['app/dashboard/[eventId]/website/what-to-bring/actions.ts', 'updateWhatToBring'],
    ['app/dashboard/[eventId]/website/photo-moments/actions.ts', 'updatePhotoMoments'],
  ];
  for (const [file, name] of WORDS) {
    const a = actions.find((x) => x.file === file && x.name === name);
    assert.ok(a, `${file}#${name} not found`);
    assert.doesNotMatch(a.body, GATE, `${name} writes words — it must never ask for Pro`);
  }
});

test('guest photos are not touched — no Papic or gallery module imports the look gate', () => {
  const offenders = walk(APP)
    .concat(walk(join(WEB, 'lib')))
    .filter((p) => /papic|guest-capture|live-gallery/i.test(p))
    .filter((p) => /hub-look-(?:gate|pro)/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(offenders.map((p) => relative(WEB, p)), []);
});

test('the Save-the-Date builder turns a Pro refusal into a sentence, not "something went wrong"', () => {
  const client = readFileSync(
    join(APP, 'dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx'),
    'utf8',
  );
  assert.match(client, /r\.error === LOOK_PRO_REQUIRED \? 'pro'/);
  assert.match(client, /result === 'pro' \?/);
});
