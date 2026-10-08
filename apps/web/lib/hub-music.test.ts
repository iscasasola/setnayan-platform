/**
 * EVENT HUB MUSIC — the rules both sides share (lib/hub-music.ts), and the
 * wiring that makes them true where it matters.
 *
 * Owner 2026-10-08: "background music. where can we upload via admin to add
 * music they can pick?" — the tracks are uploaded at /admin/hub-music and
 * picked by couples in Look › Music.
 *
 * The fixtures are the owner's own first batch: twenty files, ten titles in two
 * takes, one title ("Velvet Court") that names no mood and one that carries a
 * subtitle ("Harana - Moonlit").
 *
 * 🛡 Sabotaged, each red then restored (the file backed up and copied back):
 *   • `guessHubMusicMood` matches any shared word            → "names no mood" red;
 *   • the "-2" rule removed from `hubMusicTitleFromFileName` → the titles test red;
 *   • `audio/x-m4a` dropped from the type names              → the browser-type test red;
 *   • `hubMusicUploadRefusal` lets a non-admin through       → the refusal test red;
 *   • the route's `hubMusicUploadRefusal` block deleted      → the route wiring red;
 *   • the action inserts before it reads the file            → the action wiring red;
 *   • a second exported function added to actions.ts         → the one-door test red;
 *   • the page maps a failed read to `[]`                    → the honest-read test red;
 *   • a mood added to the code but not the table             → the mood-list test red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  HUB_MUSIC_CONTENT_TYPES,
  HUB_MUSIC_MAX_BYTES,
  HUB_MUSIC_MOODS,
  HUB_MUSIC_NO_MOOD_LABEL,
  cleanHubMusicTitle,
  formatHubMusicLength,
  guessHubMusicMood,
  hubMusicContentTypeFor,
  hubMusicMoodLabel,
  hubMusicTitleFromFileName,
  hubMusicUploadRefusal,
  hubMusicUploadRule,
  isHubMusicKey,
  sortHubMusicTracks,
} from './hub-music';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(WEB, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The owner's first batch, as the files are named. */
const BATCH: Array<[file: string, title: string, mood: string | null]> = [
  ['Beach and Sunset.m4a', 'Beach and Sunset', 'beach_sunset'],
  ['Beach and Sunset-2.m4a', 'Beach and Sunset 2', 'beach_sunset'],
  ['Classic Romantic.m4a', 'Classic Romantic', 'classic_romantic'],
  ['Classic Romantic-2.m4a', 'Classic Romantic 2', 'classic_romantic'],
  ['Garden and Rustic.m4a', 'Garden and Rustic', 'garden_rustic'],
  ['Garden and Rustic-2.m4a', 'Garden and Rustic 2', 'garden_rustic'],
  ['Grand and Cinematic.m4a', 'Grand and Cinematic', 'grand_cinematic'],
  ['Grand and Cinematic-2.m4a', 'Grand and Cinematic 2', 'grand_cinematic'],
  ['Harana - Moonlit.m4a', 'Harana - Moonlit', 'harana'],
  ['Harana - Moonlit-2.m4a', 'Harana - Moonlit 2', 'harana'],
  ['Modern Minimal.m4a', 'Modern Minimal', 'modern_minimal'],
  ['Modern Minimal-2.m4a', 'Modern Minimal 2', 'modern_minimal'],
  ['Playful and Joyful.m4a', 'Playful and Joyful', 'playful_joyful'],
  ['Playful and Joyful-2.m4a', 'Playful and Joyful 2', 'playful_joyful'],
  ['Soft Jazz Reception.m4a', 'Soft Jazz Reception', 'soft_jazz_reception'],
  ['Soft Jazz Reception-2.m4a', 'Soft Jazz Reception 2', 'soft_jazz_reception'],
  ['Velvet Court.m4a', 'Velvet Court', null],
  ['Velvet Court-2.m4a', 'Velvet Court 2', null],
  ['Warm and Intimate.m4a', 'Warm and Intimate', 'warm_intimate'],
  ['Warm and Intimate-2.m4a', 'Warm and Intimate 2', 'warm_intimate'],
];

test('each of the owner’s twenty files becomes the title a person would write', () => {
  for (const [file, title] of BATCH) assert.equal(hubMusicTitleFromFileName(file), title, file);
  assert.equal(hubMusicTitleFromFileName('soft_jazz_reception (3).mp3'), 'soft jazz reception 3');
  assert.equal(hubMusicTitleFromFileName('C:\\Music\\First Light.aac'), 'First Light');
  assert.equal(hubMusicTitleFromFileName('.m4a'), '.m4a', 'a name that is only an extension is kept, not emptied');
  assert.equal(hubMusicTitleFromFileName('x'.repeat(200) + '.mp3').length, 80);
});

test('a mood is guessed only when the title starts with its name — eighteen match, Velvet Court names no mood', () => {
  for (const [, title, mood] of BATCH) assert.equal(guessHubMusicMood(title), mood, title);
  assert.equal(BATCH.filter(([, t]) => guessHubMusicMood(t) === null).length, 2);
  // A shared word is not a match: nobody decided these.
  assert.equal(guessHubMusicMood('Modern Love'), null);
  assert.equal(guessHubMusicMood('A Warm Evening'), null);
  assert.equal(guessHubMusicMood('Moonlit Harana'), null);
  assert.equal(guessHubMusicMood('Garden & Rustic — take 3'), 'garden_rustic', '"&" reads as "and"');
  assert.equal(guessHubMusicMood('HARANA'), 'harana');
  assert.equal(guessHubMusicMood(''), null);
});

test('the moods in code are the moods the table allows — nine, the same nine', () => {
  const sql = readFileSync(
    join(REPO, 'supabase', 'migrations', '20271266495922_hub_music_tracks.sql'),
    'utf8',
  );
  const check = /mood\s+TEXT CHECK \(mood IN \(([\s\S]*?)\)\)/.exec(sql);
  assert.ok(check, 'the mood CHECK is in the migration');
  const inTable = [...check![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(inTable, HUB_MUSIC_MOODS.map((m) => m.key));
  assert.equal(HUB_MUSIC_MOODS.length, 9);
  assert.equal(hubMusicMoodLabel('garden_rustic'), 'Garden and Rustic');
  assert.equal(hubMusicMoodLabel(null), HUB_MUSIC_NO_MOOD_LABEL);
  assert.equal(hubMusicMoodLabel('velvet_court'), HUB_MUSIC_NO_MOOD_LABEL, 'an unknown key is not a mood');
});

test('an .m4a is uploaded as audio/mp4 whatever the browser calls it', () => {
  assert.equal(hubMusicContentTypeFor('Velvet Court.m4a', 'audio/x-m4a'), 'audio/mp4', 'Chrome, Safari');
  assert.equal(hubMusicContentTypeFor('Velvet Court.m4a', 'audio/mp4'), 'audio/mp4', 'Firefox');
  assert.equal(hubMusicContentTypeFor('Velvet Court.m4a', ''), 'audio/mp4', 'no type stated');
  assert.equal(hubMusicContentTypeFor('song.MP3', 'audio/mpeg'), 'audio/mpeg');
  assert.equal(hubMusicContentTypeFor('song.mp3', 'audio/mp3'), 'audio/mpeg');
  assert.equal(hubMusicContentTypeFor('song.aac', 'audio/x-aac'), 'audio/aac');
  assert.equal(hubMusicContentTypeFor('song.aac', 'application/octet-stream'), 'audio/aac');
  // Not ours — and a stated type wins over a flattering extension.
  assert.equal(hubMusicContentTypeFor('song.wav', 'audio/wav'), null);
  assert.equal(hubMusicContentTypeFor('song.ogg', 'audio/ogg'), null);
  assert.equal(hubMusicContentTypeFor('clip.m4a', 'video/mp4'), null);
  assert.equal(hubMusicContentTypeFor('notes.txt', ''), null);
});

test('the presign rule: an admin, one of three audio kinds, at most 20 MB', () => {
  assert.equal(hubMusicUploadRule('events/abc/site-music'), null, 'a couple’s own folder is not this rule');
  assert.equal(hubMusicUploadRule('events/abc/hub-music'), null, 'only the ROOT folder is');
  assert.equal(hubMusicUploadRule('homepage-bg/slot-0'), null);
  assert.ok(hubMusicUploadRule('hub-music'));
  assert.ok(hubMusicUploadRule('hub-music/anything'));
  assert.ok(hubMusicUploadRule('Hub-Music'), 'a different case is still refused to a stranger');

  const ok = { bucketKey: 'media', isAdmin: true, contentType: 'audio/mp4', sizeBytes: 4_000_000 };
  assert.equal(hubMusicUploadRefusal(ok), null);
  assert.equal(hubMusicUploadRefusal({ ...ok, contentType: 'audio/mpeg' }), null);
  assert.equal(hubMusicUploadRefusal({ ...ok, contentType: 'audio/aac' }), null);
  assert.equal(hubMusicUploadRefusal({ ...ok, sizeBytes: HUB_MUSIC_MAX_BYTES }), null, 'exactly 20 MB fits');

  assert.deepEqual(hubMusicUploadRefusal({ ...ok, isAdmin: false }), {
    status: 403,
    error: 'That upload location isn’t allowed.',
  });
  assert.equal(hubMusicUploadRefusal({ ...ok, bucketKey: 'threadFiles' })?.status, 403);
  for (const contentType of ['audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'video/mp4', 'image/png', '']) {
    assert.deepEqual(
      hubMusicUploadRefusal({ ...ok, contentType }),
      { status: 400, error: 'Event Hub music must be an M4A, MP3 or AAC file.' },
      contentType,
    );
  }
  const big = hubMusicUploadRefusal({ ...ok, sizeBytes: HUB_MUSIC_MAX_BYTES + 1 });
  assert.equal(big?.status, 413);
  assert.match(big!.error, /^That file is 20\.0 MB — Event Hub music can be up to 20 MB\.$/);
  assert.equal(hubMusicUploadRefusal({ ...ok, sizeBytes: Number.NaN })?.status, 413, 'an unstated size is not a small one');
  // A stranger learns nothing about the limits — the 403 comes first.
  assert.equal(hubMusicUploadRefusal({ ...ok, isAdmin: false, contentType: 'image/png' })?.status, 403);
  assert.deepEqual([...HUB_MUSIC_CONTENT_TYPES], ['audio/mp4', 'audio/mpeg', 'audio/aac']);
});

test('a key is ours only inside hub-music/, and cannot climb out of it', () => {
  assert.ok(isHubMusicKey('hub-music/2f1c-Velvet-Court.m4a'));
  for (const bad of [
    'hub-music/',
    'hub-music',
    'events/1/site-music/a.m4a',
    'hub-music/../events/1/a.m4a',
    'hub-music//a.m4a',
    '/hub-music/a.m4a',
    'r2://setnayan-media/hub-music/a.m4a',
    'hub-music/a\\b.m4a',
    'hub-music/' + 'a'.repeat(600),
    null,
    42,
  ]) {
    assert.equal(isHubMusicKey(bad), false, String(bad));
  }
});

test('titles, lengths and the list’s order', () => {
  assert.equal(cleanHubMusicTitle('  Harana  -   Moonlit '), 'Harana - Moonlit');
  assert.equal(cleanHubMusicTitle('   '), null);
  assert.equal(cleanHubMusicTitle('x'.repeat(81)), null);
  assert.equal(cleanHubMusicTitle(7), null);

  assert.equal(formatHubMusicLength(147), '2:27');
  assert.equal(formatHubMusicLength(60), '1:00');
  assert.equal(formatHubMusicLength(9), '0:09');
  assert.equal(formatHubMusicLength(null), '—', 'an unread length is a dash');
  assert.equal(formatHubMusicLength(0), '—', '…and never 0:00');

  const t = (title: string, mood: string | null, sortOrder = 0) => ({ title, mood, sortOrder });
  const sorted = sortHubMusicTracks([
    t('Velvet Court', null),
    t('Warm and Intimate 2', 'warm_intimate'),
    t('Classic Romantic 10', 'classic_romantic'),
    t('Classic Romantic 2', 'classic_romantic'),
    t('Classic Romantic', 'classic_romantic', 5),
    t('Harana - Moonlit', 'harana'),
  ]).map((x) => x.title);
  assert.deepEqual(sorted, [
    'Classic Romantic 2',
    'Classic Romantic 10',
    'Classic Romantic',
    'Harana - Moonlit',
    'Warm and Intimate 2',
    'Velvet Court',
  ]);
});

// ── The wiring ──────────────────────────────────────────────────────────────

test('the upload route asks who is calling before it signs anything into hub-music/', () => {
  const src = code('app/api/upload/route.ts');
  const gate = src.indexOf('hubMusicUploadRule(pathPrefix)');
  const refusal = src.indexOf('hubMusicUploadRefusal({');
  const sign = src.indexOf('presignUploadUrl({');
  assert.ok(gate > 0 && refusal > gate, 'the rule is consulted, then the refusal decided');
  assert.ok(sign > refusal, 'both happen before a URL is signed');
  const block = src.slice(gate, sign);
  assert.match(block, /isAdmin:\s*isAdminProfile\(me\)/, 'the admin test is the console’s own predicate');
  assert.match(block, /contentType:\s*baseContentType/);
  assert.match(block, /sizeBytes,/);
  assert.match(
    block,
    /if \(refusal\) \{\s*return NextResponse\.json\(\{ error: refusal\.error \}, \{ status: refusal\.status \}\);/,
    'a refusal is returned, not logged and passed',
  );
});

test('adding a track reads the stored file before it writes the row', () => {
  const src = code('app/admin/hub-music/actions.ts');
  const add = src.slice(src.indexOf('async function add('), src.indexOf('async function edit('));
  const head = add.indexOf('r2HeadOutcome(');
  const bytes = add.indexOf('r2GetBytes(');
  const verdict = add.indexOf('hubMusicFileVerdict(sniffAudio(bytes))');
  const refused = add.indexOf('if (!verdict.ok)');
  const insert = add.indexOf('.insert(');
  assert.ok(head > 0 && bytes > head && verdict > bytes && refused > verdict && insert > refused, 'head → bytes → verdict → refusal → insert');
  assert.match(add, /duration_seconds:\s*verdict\.durationSeconds/, 'the length stored is the one read from the file');
  assert.match(add, /file_bytes:\s*bytes\.byteLength/, 'the size stored is the one measured');
  assert.match(add, /if \(!isHubMusicKey\(input\.key\)\)/, 'a key outside hub-music/ never reaches storage');
  assert.match(add, /if \(input\.publish && !mood\)/, 'publishing needs a mood');
});

test('the admin page has ONE server action, and every move proves the admin and leaves an audit line', () => {
  const src = code('app/admin/hub-music/actions.ts');
  assert.match(src, /^\s*'use server';/);
  const exported = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(\w+)/gm)].map((m) => m[1]);
  assert.deepEqual(exported, ['saveHubMusic'], 'each exported action is a Vercel route — this page takes one');
  const door = src.slice(src.indexOf('export async function saveHubMusic('));
  assert.ok(door.indexOf('requireAdminAction()') < door.indexOf('createAdminClient()'), 'the admin is proven before the service role is touched');
  for (const action of ['hub_music_track_add', 'hub_music_track_edit', 'hub_music_track_remove']) {
    assert.equal(src.split(`action: '${action}'`).length - 1, 1, action);
  }
  assert.match(src, /target_table: 'hub_music_tracks'/);
  // Removing the row sends its file through the proven-unused sweep, never a bare delete.
  assert.doesNotMatch(src, /r2Delete\(/);
  assert.match(src, /retireReplacedMedia\(\{ previous: \[key\], next: \[\], context \}\)/);
});

test('a failed read of the list is never shown as an empty list', () => {
  const reader = code('lib/hub-music-server.ts');
  assert.match(reader, /if \(error\) return \{ ok: false, error \};/);
  const page = code('app/admin/hub-music/page.tsx');
  assert.ok(page.indexOf('await requireAdmin()') < page.indexOf('fetchHubMusicForAdmin()'), 'the page gates itself first');
  assert.match(page, /initial=\{read\.ok \? read\.tracks : null\}/);
  assert.match(page, /readError=\{read\.ok \? null : read\.error\}/);
  const manager = code('app/admin/hub-music/hub-music-manager.tsx');
  assert.match(manager, /rows=\{readError \? null : visible\}/, 'the table is told "not measured", not "none"');
  assert.match(manager, /disabled=\{Boolean\(readError\)\}/, 'and nothing is added on top of a list that did not load');
});

test('the files show up in Website media, backed by a real read of the table', () => {
  assert.match(code('lib/website-media.ts'), /prefix: 'hub-music\/'/);
  const server = code('lib/website-media-server.ts');
  assert.match(server, /'hub-music\/': 'hubMusic'/);
  assert.match(server, /\.from\('hub_music_tracks'\)\s*\.select\('r2_key'\)/);
});

test('the page is in the admin menu, with its description', () => {
  assert.match(code('app/admin/_components/admin-nav-groups.tsx'), /key: 'hub-music',\s*label: 'Event Hub music',\s*href: '\/admin\/hub-music'/);
  assert.match(code('app/admin/_components/admin-nav-descriptions.ts'), /'hub-music':/);
  assert.match(code('lib/nav-registry-defaults.ts'), /key: "admin\.sidebar\.hub-music"/);
  assert.ok(readdirSync(join(WEB, 'app/admin/hub-music')).includes('page.tsx'));
});
