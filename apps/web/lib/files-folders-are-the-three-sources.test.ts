/**
 * files-folders-are-the-three-sources.test.ts — 📁 THE FILES PAGE IS FINDER-STYLE OVER THE THREE SOURCES (THE ONE BUILD
 * B2 §2.4, guard 9).
 *
 *   1 · `folderOf` covers every `SharedFileKind` and there is NO fourth folder (v113's "Payment-proof" is WRONG);
 *   2 · the root stays "All files", newest-first ACROSS the sources (`chat-files-appear-in-the-files-tab` holds it on
 *       the built list; this holds it on the finder's own default);
 *   3 · the sorts: name A→Z, size largest first with an unknown size LAST (never as 0), kind by source;
 *   4 · rendered: folders with counts, "All files · N · by date", every row opens its own href — the page builds no
 *       link of its own; the choices are ONE dropdown each (no pill row); the limits are the chat's own constants.
 *
 * SABOTAGE (seen red once): `gallery_link: 'contracts'` → 1 red; the date sort ascending → 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { FILES_FOLDERS, FOLDER_OF, filesFor, folderCounts, folderOf, sizeBytes } from './shared-files-view';
import type { SharedFileEntry, SharedFileKind } from './chat-shared-files';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const row = (key: string, kind: SharedFileKind, name: string, at: string, sizeLabel: string | null = null): SharedFileEntry => ({
  key, kind, name, origin: kind === 'chat' ? 'They shared' : 'You shared', sizeLabel, typeLabel: 'PDF', at, href: `/f/${key}`, isImage: false,
});
const FILES = [
  row('c1', 'contract', 'Contract.pdf', '2026-10-14T00:00:00Z', '1.2 MB'),
  row('m1', 'chat', 'Payment-proof-30k.jpg', '2026-11-01T00:00:00Z', '2.1 MB'),
  row('h1', 'handover', 'Prenup selects', '2026-11-02T00:00:00Z', '96 MB'),
  row('g1', 'gallery_link', 'Album link', '2026-10-20T00:00:00Z', null),
  row('m2', 'chat', 'peg-photos.zip', '2026-10-20T00:00:00Z', '48 MB'),
];

test('1 · every source has its folder, and there are exactly three folders', () => {
  const kinds: SharedFileKind[] = ['contract', 'handover', 'gallery_link', 'chat'];
  assert.deepEqual(Object.keys(FOLDER_OF).sort(), [...kinds].sort(), 'a source has no folder');
  assert.deepEqual(kinds.map(folderOf), ['contracts', 'handover', 'handover', 'chat']);
  assert.deepEqual(FILES_FOLDERS.map((f) => f.label), ['Contracts', 'Chat files', 'Handover & albums']);
  assert.deepEqual(folderCounts(FILES), { contracts: 1, chat: 2, handover: 2 });
});

test('2 · the root is All files, newest-first ACROSS the sources', () => {
  assert.deepEqual(filesFor(FILES, 'all', 'date').map((f) => f.key), ['h1', 'm1', 'g1', 'm2', 'c1']);
  assert.deepEqual(filesFor(FILES, 'chat', 'date').map((f) => f.key), ['m1', 'm2'], 'a folder holds files of another source');
  const finder = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/clients/[eventId]/_pages/files-finder.tsx'), 'utf8'));
  assert.match(finder, /useState<FilesView>\('all'\)/, 'the finder does not open on All files');
  assert.match(finder, /useState<FilesSort>\('date'\)/, 'the finder does not open newest-first');
});

test('3 · the sorts — an unknown size sorts last, never as 0', () => {
  assert.deepEqual(filesFor(FILES, 'all', 'name').map((f) => f.key), ['g1', 'c1', 'm1', 'm2', 'h1']);
  assert.deepEqual(filesFor(FILES, 'all', 'size').map((f) => f.key), ['h1', 'm2', 'm1', 'c1', 'g1']);
  assert.equal(sizeBytes(null), null);
  assert.equal(sizeBytes('2.1 MB'), 2.1 * 1024 * 1024);
  assert.deepEqual(filesFor(FILES, 'all', 'kind').map((f) => f.kind), ['contract', 'chat', 'chat', 'handover', 'gallery_link']);
});

test('4 · rendered: folders with counts, the root list, each row its own href, one dropdown each, the chat’s own limits', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FilesPage } = await import('../app/vendor-dashboard/clients/[eventId]/_pages/files');
  const html = renderToStaticMarkup(
    React.createElement(FilesPage, {
      ctx: { eventId: 'e1', vendorProfileId: 'v', viewerUserId: 'u', threadId: 't1', eventName: 'E', stage: 'booked', isBooked: true, feeUnlocked: true, eventVendorId: 'ev', eventDate: null },
      files: FILES,
      chatFilesMeasured: true,
      threadId: 't1',
      isBooked: true,
    }),
  );
  const t = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  assert.match(t, /Folders · by source Contracts 1 item Chat files 2 items Handover & albums 2 items/);
  assert.match(t, /All files · 5 · by date/);
  for (const f of FILES) assert.ok(html.includes(`href="/f/${f.key}"`), `${f.key} does not open its own href`);
  const src = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/clients/[eventId]/_pages/files-finder.tsx'), 'utf8'));
  assert.equal((src.match(/<PickMenu\b/g) ?? []).length, 2, 'the folder and the view/sort are not one dropdown each');
  assert.doesNotMatch(src, /PillTrack|ISegmented|role="tablist"/, 'a pill row came back');
  assert.doesNotMatch(src, /\/vendor-dashboard\/messages\/\$\{|chat-attachment/, 'the finder builds a file link of its own');
  const page = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/clients/[eventId]/_pages/files.tsx'), 'utf8'));
  assert.match(page, /formatCount\(CHAT_PHOTO_MAX_MB\)/, 'the limits are typed, not the chat’s own');
  assert.doesNotMatch(page, /\b(?:20|50|90) MB\b|\b90 days\b/, 'a limit is typed by hand');
  // Refused is not empty — said, and the rows still show.
  const refused = renderToStaticMarkup(
    React.createElement(FilesPage, { ctx: { eventId: 'e1' } as never, files: [], chatFilesMeasured: false, threadId: 't1', isBooked: false }),
  );
  assert.match(refused, /could not be loaded just now/);
});
