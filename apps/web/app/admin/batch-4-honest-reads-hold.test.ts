/**
 * Final check 25 Nov, area 8, batch 4: Work, Focus, Catalogue and Verify say a failed read, never "0" or "none",
 * and count the same queues the Work list does. One test per finding, read from comment-stripped source; the
 * failure branch must come BEFORE the empty line it replaces.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { cardsMoveLine } from '@/lib/service-requests';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const code = (p: string) => stripComments(readFileSync(resolve(web, p), 'utf8'));
function before(src: string, a: string | RegExp, b: string, why: string) {
  const i = typeof a === 'string' ? src.indexOf(a) : src.search(a);
  const j = src.indexOf(b);
  assert.ok(i >= 0, `missing: ${a}`);
  assert.ok(j >= 0, `missing: ${b}`);
  assert.ok(i < j, why);
}

test('C-1 · Focus answers with the queue count, and "Couldn\'t read" for an unread queue', () => {
  const src = code('app/admin/_components/focus-home.tsx');
  assert.match(src, /if \(q && q\.count === null\) \{\s*answerRows = null;/);
  assert.match(src, /answerCount = q\?\.count \?\? 0;/);
  assert.match(src, /`\$\{formatCount\(answerCount\)\} · answered here`/);
  assert.doesNotMatch(src, /formatCount\(answerRows\.length\)\} · answered here/);
});

test('C-6 · the lane chips never sum a watch-only trail', () => {
  const src = code('app/admin/queues/_components/queues-triage-feed.tsx');
  assert.match(src, /const waiting = \(all: TriageItem\[\]\): string => \{\s*const rows = all\.filter\(\(i\) => !i\.watchOnly\);/);
});

test('C-7 · the Work landing total is the Work list total (BASE_ROWS minus watch-only)', () => {
  const src = code('app/admin/_components/tab-landing.tsx');
  assert.match(src, /BASE_ROWS\.filter\(\(b\) => ADMIN_QUEUE_META\[b\.key\]\?\.watchOnly !== true\)/);
  assert.match(src, /value: show\(workTotal\), sub: 'across every queue'/);
  assert.match(src, /function countToSum\(/);
  assert.equal((src.match(/sum\((page\.views|views)\.map\(\(vw\) => countToSum\(vw, digest\)\)\)/g) ?? []).length, 2);
});

test('C-8 · a failed kind reads "—" and "All" says it is partial', () => {
  const src = code('app/admin/work/_components/supplier-inbox.tsx');
  assert.match(src, /read\.failed\.includes\(k\) \? '—' : formatCount\(counts\[k\]\)/);
  assert.match(src, /\(some unread\)/);
});

test('C-9 · the event-type picker says it could not read the types', () => {
  assert.match(code('app/admin/work/page.tsx'), /eventTypes=\{typesRead\.error \? null :/);
  before(code('app/admin/work/_components/supplier-inbox.tsx'), 'eventTypes === null ? (', 'label="It is this event type"', 'failure first');
});

test('C-10 · checks that did not run are said before Approve', () => {
  const server = code('lib/admin/supplier-work.server.ts');
  assert.match(server, /checksRan = false;/);
  assert.match(server, /checksRan,\n/);
  before(code('app/admin/work/_components/supplier-inbox.tsx'), "item.checksRan === false ? (", 'item.checks.map((c) => (', 'said before the checks list');
});

test('B-14 · Categories counts read "—" and the lists say they failed', () => {
  const page = code('app/admin/categories/page.tsx');
  assert.match(page, /cats\.failed\.includes\('supplier requests'\) \? '—' : formatCount\(cats\.requests\.length\)\} requests/);
  assert.match(page, /cats\.failed\.includes\('search words'\) \|\| cats\.failed\.includes\('services'\) \? '—'/);
  assert.match(page, /vocab\.failed\.includes\('event types'\) \? 'Couldn’t read the event types'/);
  assert.match(page, /vocab\.failed\.includes\('religions'\) \? 'Couldn’t read the religions'/);
  const pane = code('app/admin/categories/_components/list-pane.tsx');
  before(pane, "state.show === 'words' && waitingFailed", 'No words waiting.', 'failure first');
  before(pane, "state.show === 'requests' && requestsFailed", 'No supplier requests waiting.', 'failure first');
});

test('B-15 · service requests say what they could not read', () => {
  const list = code('app/admin/categories/requests/_components/list-view.tsx');
  assert.match(list, /shopName === null \? 'Couldn’t read the shop'/);
  assert.match(list, /tree === null \? 'Couldn’t read the category'/);
  assert.match(code('app/admin/categories/requests/page.tsx'), /shopName = error \? null : new Map\(/);
  assert.match(code('app/admin/categories/requests/_components/request-view.tsx'), /cards=\{cards \?\? null\}/);
  assert.match(cardsMoveLine(null, 'A › Others', 'B › C'), /Couldn’t count/);
  assert.match(cardsMoveLine(0, 'A › Others', 'B › C'), /No cards to move/);
});

test('E-10 · Verify shows only the "couldn\'t load" line on a failed read', () => {
  const src = code('app/admin/verify/page.tsx');
  assert.match(src, /\{queryError \? null : vendors\.length === 0 \? \(/);
  assert.match(src, /appErr \|\| demotedReadFailed \|\| \(autoReadFailed && statusParam === 'auto'\) \? null :/);
  assert.match(src, /error: demotedErr/);
});

test('F-20 · a refused editorial read is not "not found"', () => {
  const src = code('app/admin/editorial-review/[editorialId]/page.tsx');
  before(src, 'if (rowErr) {', 'if (!row) notFound();', 'the refusal is handled before not-found');
  assert.match(src, /<ReadFailed what="this editorial" \/>/);
});

test('D-15 · an unchecked owner is locked and said, never an ordinary editable row', () => {
  const src = code('app/admin/team/page.tsx');
  assert.match(src, /ownerAnswers\.filter\(\(\[, a\]\) => a === null\)/);
  assert.match(src, /'Couldn’t check the owner — reload before changing anything here'/);
  assert.match(src, /canManage && !owner && !ownerUnknown && !isMe/);
});
