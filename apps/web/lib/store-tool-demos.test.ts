/**
 * GUARD — EVERY PAID TOOL HAS A "TRY IT FIRST" DEMO, AND A DEMO WRITES NOTHING (owner 2026-11-23; specs eb51e640 "every
 * item has its demo before buying", 7d487adb Q6 "all four paid tools get a 'Try it first' demo").
 *
 *   1. Every paid tool (`PAID_STORE_TOOLS`) has its line and its demo; the three that are not the Cake Maker open the
 *      shared demo screen, the Cake Maker its own designer. Each Store item card draws ONE `ToolDemoButton`.
 *   2. A demo makes no writes: no server action, no fetch, no database client is reachable from the demo screen — the
 *      whole value-import graph of `tool-demos.tsx` is walked, and no module in it is a `'use server'` file or names
 *      the Supabase clients. The customer-side pieces' own writing halves are never mounted: not the guest camera's
 *      fetching hook (`useGuestChallenges`), not the song bank's cache write (`onCacheSong`).
 *   3. The sample is a demo's own: made-up ids, no money, no link out of the screen, the shop's own name.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-23, one failing test each): `fetch('/api/song-requests', { method: 'POST' })`
 * added to `SongDemo`; `import { storeAction } from '../store-actions'` added to tool-demos.tsx; `onCacheSong={() => {}}`
 * passed to the song list; `{tool.key === 'cake_tool' ? (` put back on the item's "Try it first".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { stripComments } from './strip-comments';
import { PAID_STORE_TOOLS } from './supplier-store';
import { DEMO_MISSION_PREFIX, SCREEN_DEMO_TOOLS, STORE_TOOL_DEMO_HEAD, STORE_TOOL_DEMO_LINE, TOOL_DEMO_BAR_WORDS, demoMissions, demoRoom, demoShopName, demoSongs } from './store-tool-demos';
import { CAKE_DEMO_BAR_WORDS } from './cake-demo';

const WEB = process.cwd();
const DEMOS = 'app/vendor-dashboard/shop/store/_components/tool-demos.tsx';
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const code = (p: string) => stripComments(read(p));

test('1 · every paid tool has its line and its demo; each item card draws the one demo button', () => {
  assert.deepEqual(Object.keys(STORE_TOOL_DEMO_LINE).sort(), [...PAID_STORE_TOOLS].sort(), 'a paid tool has no "Try it first" line');
  assert.deepEqual([...SCREEN_DEMO_TOOLS].sort(), PAID_STORE_TOOLS.filter((k) => k !== 'cake_tool').sort(), 'a paid tool has no demo screen');
  for (const k of SCREEN_DEMO_TOOLS) assert.ok(STORE_TOOL_DEMO_HEAD[k].title && STORE_TOOL_DEMO_HEAD[k].line, `${k} has no head`);
  for (const line of Object.values(STORE_TOOL_DEMO_LINE)) assert.match(line, /^A demo · /, 'the line is not the Cake Maker’s "A demo · …" pattern');
  assert.equal(TOOL_DEMO_BAR_WORDS, CAKE_DEMO_BAR_WORDS, 'the demo bar says something the Cake Maker’s does not');

  const item = code('app/vendor-dashboard/shop/store/_components/store-screens.tsx');
  assert.match(
    item,
    /isPaidStoreTool\(tool\.key\) \?[\s\S]{0,200}label="Try it first"[\s\S]{0,200}STORE_TOOL_DEMO_LINE\[tool\.key\][\s\S]{0,120}<ToolDemoButton tool=\{tool\.key\}/,
    'a paid tool’s item lost its "Try it first"',
  );
  const client = code('app/vendor-dashboard/shop/store/_components/store-client.tsx');
  assert.match(client, /tool === 'cake_tool' \? <CakeDesigner threadId="" demo onClose=\{close\} \/> : <ToolDemoScreen tool=\{tool\}/, 'the press does not open the tool’s demo');
  assert.match(client, /const ToolDemoScreen = lazy\(\(\) => import\('\.\/tool-demos'\)/, 'the demo screen ships in the Store’s first load (fetch it on the press)');
  const demos = code(DEMOS);
  assert.match(demos, /<RiseScreen [^>]*kind="zoom"/, 'a demo does not rise as a whole tool');
  assert.match(demos, /tool === 'song_bank' \? <SongDemo \/> : tool === 'papic_challenge' \? <ChallengeDemo [^>]*\/> : <RoomDemo /, 'a tool’s demo is missing');
  assert.match(demos, /<SongPreviewList /, 'the Song bank demo is not the couple’s song list');
  assert.match(demos, /<ChallengePill c=\{c\} \/>[\s\S]*<ChallengeFollowUp c=\{c\} \/>/, 'the Papic demo is not the guest camera’s challenge pill');
  assert.match(demos, /<Plan3DSceneLoader /, 'the 3D plan demo is not the couple’s 3D room');
  assert.match(demos, /label="Upgrade" href=\{SPECIAL_TOOLS_UPGRADE_HREF\}/, 'the demo bar lost its Upgrade');
});

/** Every module the demo screen imports for a VALUE (type-only imports carry no code), walked to the end. */
function valueImportGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const exts = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
  const resolveSpec = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(join(WEB, from)), spec) : null;
    if (!base) return null; // a package
    for (const e of ['', ...exts]) {
      const p = base + e;
      if (existsSync(p) && /\.(ts|tsx)$/.test(p)) return p.slice(WEB.length + 1);
    }
    return null;
  };
  const walk = (rel: string) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const src = stripComments(read(rel));
    const specs = [
      ...src.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm),
      ...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
      ...src.matchAll(/^\s*export\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm),
      ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
    ].map((m) => m[1]!);
    for (const s of specs) {
      const r = resolveSpec(rel, s);
      if (r) walk(r);
    }
  };
  walk(entry);
  return seen;
}

test('2 · a demo makes no writes: no server action, no fetch, no database client is reachable', () => {
  const graph = valueImportGraph(DEMOS);
  assert.ok(graph.size > 10, 'the import walk found nothing — re-point this guard');
  const serverFiles = [...graph].filter((f) => /^\s*['"]use server['"]/.test(stripComments(read(f))));
  assert.deepEqual(serverFiles, [], `a demo can reach a server action: ${serverFiles.join(', ')}`);
  const dbFiles = [...graph].filter((f) => /from ['"]@\/lib\/supabase\/(server|admin|client)['"]|createAdminClient\(|createClient\(/.test(stripComments(read(f))));
  assert.deepEqual(dbFiles, [], `a demo can reach the database: ${dbFiles.join(', ')}`);

  const demos = code(DEMOS);
  assert.doesNotMatch(demos, /\bfetch\(|XMLHttpRequest|sendBeacon|navigator\.sendBeacon/, 'the demo screen sends a request');
  assert.doesNotMatch(demos, /Action\(|from '[^']*actions'/, 'the demo screen calls an action');
  assert.doesNotMatch(demos, /useGuestChallenges\(/, 'the Papic demo mounts the camera’s fetching hook (it POSTs a completion)');
  assert.doesNotMatch(demos, /onCacheSong/, 'the Song bank demo hands the list a cache writer');
  assert.doesNotMatch(demos, /SongBankStep|PlaylistSlotSection|SongRequestCard|PapicGuestCapture|SeatingLabLoader/, 'a demo mounts a piece that writes');
  assert.doesNotMatch(demos, /localStorage|sessionStorage|indexedDB/, 'a demo keeps something after it closes');
});

test('3 · the sample is a demo’s own: made-up ids, no money, no link out, the shop’s own name', () => {
  assert.equal(demoShopName('  '), 'Your shop');
  assert.equal(demoShopName(null), 'Your shop');
  assert.equal(demoShopName('SetnaProd'), 'SetnaProd');

  const songs = demoSongs();
  assert.ok(songs.length >= 6, 'too few sample songs to try');
  assert.ok(songs.every((s) => s.lbl === `${s.title}|${s.artist}` && s.previewUrl === null && s.artworkUrl === null), 'a sample song carries a stored preview');

  const missions = demoMissions('SetnaProd');
  assert.ok(missions.every((m) => m.mission_id.startsWith(DEMO_MISSION_PREFIX)), 'a sample challenge has a real-looking id');
  assert.ok(missions.some((m) => m.source === 'vendor' && m.vendor_name === 'SetnaProd'), 'the shop’s own challenge is missing');
  assert.ok(missions.every((m) => !m.completed && !m.consent_shared), 'a sample challenge starts done or shared');

  const room = demoRoom('SetnaProd', 'band_dj');
  const ids = [...room.tables.map((t) => t.id), ...room.guests.map((g) => g.id), ...room.booths.map((b) => b.id)];
  assert.ok(ids.every((id) => id.startsWith(DEMO_MISSION_PREFIX)), 'a sample room row has a real-looking id');
  assert.equal(room.booths.length, 1, 'the room shows one booth — the shop’s');
  const booth = room.booths[0]!.vendor!;
  assert.equal(booth.name, 'SetnaProd');
  assert.equal(booth.category, 'band_dj');
  assert.equal(booth.slug, null, 'the sample booth links out of the demo');
  assert.equal(demoRoom('X', null).booths[0]!.vendor!.category.length > 0, true, 'a shop with no booth category gets an empty room');
  const tableIds = new Set(room.tables.map((t) => t.id));
  assert.ok(room.guests.every((g) => tableIds.has(g.tableId)), 'a sample guest sits at no table');

  const all = JSON.stringify({ songs, missions, room, lines: STORE_TOOL_DEMO_LINE, heads: STORE_TOOL_DEMO_HEAD });
  assert.doesNotMatch(all, /₱|centavos|price/i, 'a demo shows money');
  assert.doesNotMatch(code('lib/store-tool-demos.ts') + code(DEMOS), /https?:\/\//, 'a demo carries a typed address');
});
