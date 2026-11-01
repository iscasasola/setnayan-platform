/**
 * 🖼 MEMORIES PHOTOS OPEN IN THE ONE VIEWER TEMPLATE — owner 2026-10-30, live iPhone:
 *   *"the preview is wrong and the buttons are not arranged properly to our design template. like how we open
 *   inspiration photos but with the buttons for memories. Share, Hide, Delete, Tag, Add to Chapter."*
 *   *"download means we download the high res and not the preview"*
 *   *"remember to make this a template. so when we go to user memories and it opens a preview. the same template will
 *   show but no need for tagging."*
 *
 * Held here, as properties (executed where they are pure, read from the source where they are wiring):
 *   1 · the five buttons, in the logged order — Share · Tag · Add to Chapter · Hide · Delete (destructive last);
 *   2 · who sees which — Hide/Delete stay the hosts' on a Papic file; Tag is the managers' on a taggable table; a
 *       supplier's file and an Event Hub file keep what they had;
 *   3 · Share hands over the ORIGINAL (`saveUrl` / a clip's `downloadUrl`), never a screen copy (`url` · `largeUrl` ·
 *       `viewUrl`) — and says in words when the original is gone;
 *   4 · BOTH Memories (the event's and the account's) open photos through `PhotoViewer`, and the account's has no Tag;
 *   5 · Delete is still every copy behind its confirm, Hide still kept-not-deleted, and Tag is checked on the server.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  MEMORIES_VIEWER_ORDER,
  shareSourceOf,
  shareWords,
  viewerButtons,
  wallShareSourceOf,
  type ViewerWho,
} from '@/lib/memories-viewer';
import { addCandidates } from '@/lib/memories-photo-tags';
import type { MemoriesItem } from '@/lib/event-memories';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SCREEN = { url: 'U-thumb', largeUrl: 'U-large', viewUrl: 'U-view' };
function item(over: Partial<MemoriesItem> = {}): MemoriesItem {
  return {
    id: 'p1',
    ...SCREEN,
    kind: 'photo',
    source: 'guest',
    tagged: false,
    tagSource: 'untagged',
    capturedAt: '2026-12-12T12:00:00Z',
    memSource: 'papic',
    look: 'ok',
    table: 'papic_guest_captures',
    challengeId: null,
    hubUse: null,
    saveUrl: 'U-ORIGINAL',
    downloadUrl: null,
    ...over,
  };
}
const HOST: ViewerWho = { host: true, canTag: true };
const COORD: ViewerWho = { host: false, canTag: true };
const NOBODY: ViewerWho = { host: false, canTag: false };
const keys = (it: MemoriesItem, who: ViewerWho) => viewerButtons(it, who).map((b) => b.key);

test('1 · the five, in the logged order — destructive last', () => {
  assert.deepEqual([...MEMORIES_VIEWER_ORDER], ['share', 'tag', 'chapter', 'hide', 'delete']);
  assert.deepEqual(keys(item(), HOST), ['share', 'tag', 'chapter', 'hide', 'delete']);
  assert.deepEqual(keys(item({ memSource: 'uploads', table: 'papic_photos', source: 'seat' }), HOST), ['share', 'tag', 'chapter', 'hide', 'delete']);
});

test('2 · who sees which — today’s permissions kept', () => {
  // A held frame: Share explains (the save route refuses it), Hide becomes Approve / Show.
  const screened = viewerButtons(item({ look: 'screened' }), HOST);
  assert.equal(screened.find((b) => b.key === 'hide')?.label, 'Approve');
  assert.equal(screened.find((b) => b.key === 'share')?.enabled, false);
  assert.equal(viewerButtons(item({ look: 'hidden' }), HOST).find((b) => b.key === 'hide')?.label, 'Show');
  // Chapter is drawn but never acts — there is no storage for a photo's chapter yet.
  assert.equal(viewerButtons(item(), HOST).find((b) => b.key === 'chapter')?.enabled, false);
  // A supplier's file: no Tag (photo_tags cannot name it), no Delete, Hide = the whole delivery, no Share (no save route).
  assert.deepEqual(keys(item({ memSource: 'suppliers', table: 'vendor_papic_captures', source: 'vendor', saveUrl: null }), { ...HOST, supplierHidden: false }), ['chapter', 'hide']);
  // An Event Hub file: shown and shared, never managed here.
  assert.deepEqual(keys(item({ memSource: 'hub', table: 'hub', saveUrl: null, downloadUrl: 'U-HUBFILE' }), HOST), ['share']);
  // The coordinator: Tag + Chapter, never Hide/Delete, and no photo Share (the save route answers the hosts only).
  assert.deepEqual(keys(item({ table: 'papic_photos', source: 'seat' }), COORD), ['tag', 'chapter']);
  // Anyone else: nothing — a clip they were given still shares.
  assert.deepEqual(keys(item(), NOBODY), []);
  assert.deepEqual(keys(item({ kind: 'clip', saveUrl: null, downloadUrl: 'U-CLIP-ORIGINAL' }), NOBODY), ['share']);
});

test('3 · Share hands over the ORIGINAL — never a screen copy', () => {
  const screens = new Set(Object.values(SCREEN));
  const cases: MemoriesItem[] = [
    item(),
    item({ alreadyCompressed: true }),
    item({ kind: 'clip', saveUrl: null, downloadUrl: 'U-CLIP' }),
    item({ memSource: 'hub', table: 'hub', saveUrl: null, downloadUrl: 'U-HUB' }),
    item({ saveUrl: null }),
  ];
  for (const c of cases) {
    for (const who of [HOST, COORD, NOBODY]) {
      const src = shareSourceOf(c, who);
      if (src) assert.ok(!screens.has(src.url), `Share handed over a screen copy (${src.url}) for ${c.memSource}/${c.kind}`);
    }
  }
  assert.equal(shareSourceOf(item(), HOST)?.url, 'U-ORIGINAL');
  assert.equal(shareSourceOf(item(), HOST)?.what, 'original');
  // The original is gone: said in words, never silently a smaller file.
  const kept = shareSourceOf(item({ alreadyCompressed: true }), HOST)!;
  assert.equal(kept.what, 'kept-copy');
  assert.match(shareWords(kept, {}).tip, /wasn’t kept/);
  assert.match(shareWords(shareSourceOf(item(), HOST)!, { preserved: false }).tip, /Keep full resolution/);
  // The account page: your event → the save route; an event you attended → the copy you were given, said so.
  const mine = wallShareSourceOf({ key: 'papic_guest_captures:c9', url: 'U-wall', isClip: false, role: 'couple', eventId: 'e1' })!;
  assert.match(mine.url, /^\/dashboard\/e1\/studio\/papic\/save-photo\?id=c9&src=guest$/);
  const theirs = wallShareSourceOf({ key: 'papic_photos:p9', url: 'U-wall', isClip: false, role: 'guest', eventId: 'e1' })!;
  assert.equal(theirs.what, 'shared-copy');
  assert.match(shareWords(theirs, {}).tip, /not the full-resolution original/);
  assert.equal(wallShareSourceOf({ key: 'papic_photos:p9', url: 'U-wall', isClip: true, role: 'couple', eventId: 'e1' }), null);

  const sharePanel = code('app/_components/gallery/photo-viewer.tsx');
  assert.match(sharePanel, /await fetch\(source\.url\)/, 'Share no longer fetches the source it was handed');
  assert.match(sharePanel, /saveFileToDevice\(state\.file\)/, 'Share no longer hands the FILE to the share sheet / download');
});

test('4 · both Memories open photos through the one template — and the account’s has no Tag', () => {
  const viewer = code('app/_components/gallery/photo-viewer.tsx');
  assert.match(viewer, /<GalleryLightbox[\s\S]*screen=\{\{/, 'the template is no longer the shared viewer’s screen layout');

  const gallery = code('app/_components/memories/event-memories-gallery.tsx');
  assert.match(gallery, /<MemoriesPhotoViewer\b/, 'the event’s Memories no longer opens the viewer');
  assert.ok(!/PapicLightbox|function PhotoSheet|<PhotoSheet\b/.test(gallery), 'the old photo sheet or a second viewer came back');
  assert.match(gallery, /onOpen=\{\(\) => setViewingId\(it\.id\)\}/, 'a tile no longer opens the photo itself');

  const event = code('app/_components/memories/memories-photo-viewer.tsx');
  assert.match(event, /<PhotoViewer\b/);
  assert.match(event, /viewerButtons\(item,/, 'the event viewer draws buttons the rules did not pick');
  assert.match(event, /shareSourceOf\(item,/);

  const chapters = code('app/dashboard/(account)/library/_components/memories-chapters.tsx');
  assert.match(chapters, /<WallOpen\b/, 'an account frame no longer opens the viewer');
  assert.ok(!/target="_blank"/.test(chapters), 'an account frame opens a bare picture in a new tab again');
  const wall = code('app/dashboard/(account)/library/_components/memories-wall-viewer.tsx');
  assert.match(wall, /<PhotoViewer\b/, 'the account’s Memories draws its own viewer');
  assert.match(wall, /wallShareSourceOf\(item\)/);
  assert.ok(!/key: 'tag'|memoriesPhotoTags|\bTag\b/.test(wall), 'the account’s Memories shows Tag (owner: "no need for tagging")');
});

test('5 · Delete is every copy behind its confirm, Hide is kept-not-deleted, Tag is checked on the server', () => {
  const event = code('app/_components/memories/memories-photo-viewer.tsx');
  const del = event.slice(event.indexOf("panel === 'delete'"));
  assert.match(del, /deletePhotoForever\.bind\(null, eventId\)/);
  assert.match(del, /every copy of it\? This cannot be undone\./);
  assert.match(event, /setCaptureHidden : setCaptureHidden|setSeatPhotoHidden : setCaptureHidden/);
  assert.match(event, /kept, not deleted/);
  assert.match(event, /reportCapture\.bind/, 'Report left the photo (Apple 1.2)');
  assert.match(event, /blockUploader : blockUploader|unblockUploader : blockUploader/, 'Stop this guest shooting left the photo (Apple 1.2)');

  const act = code('app/dashboard/[eventId]/memories/photo-tag-actions.ts');
  const role = act.indexOf('memoriesManagerRole(');
  const write = act.indexOf(".from('photo_tags')");
  assert.ok(role > 0 && write > role, 'a tag is written before the hosts-and-coordinator check');
  assert.match(act, /limitedHelperRefusal\(eventId, null\)/);
  assert.match(act, /removed_by: 'couple'/, 'a removed tag is deleted instead of tombstoned — the face match would re-add it');
  assert.match(act, /row\.removed_by === 'guest'/, 'a guest’s "Not me" can be overridden by the hosts');
  assert.match(act, /\.eq\('event_id', clean\)/);
});

test('6 · the Add list never offers someone tagged, or someone who said "Not me"', () => {
  const state = {
    tagged: [{ guestId: 'a', name: 'Indalecio', auto: true }],
    guests: [
      { guestId: 'a', name: 'Indalecio' },
      { guestId: 'b', name: 'Indalecia' },
      { guestId: 'c', name: 'Ben' },
    ],
    saidNotMe: ['c'],
    complete: true,
  };
  assert.deepEqual(addCandidates(state, '').map((g) => g.guestId), ['b']);
  assert.deepEqual(addCandidates(state, 'indalec').map((g) => g.guestId), ['b']);
});
