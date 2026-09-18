/**
 * ONE QUOTE TOOL ON THE SUPPLIER'S CONVERSATION — one panel, one launcher, both
 * composers inside it.
 *
 * ── WHAT THIS EXISTS TO CATCH (SUP-H · AREA-CHAT, 2026-09-19) ────────────────
 * The tool registry carried TWO quote panels (`send-proposal`, `build-quote`)
 * and TWO launchers for them, one marked primary. The client brief's "Quote"
 * button opened the template form; its "New quote" button opened the builder.
 * One job, two doors, two rooms. The register (REGISTER-SWEEP-2026-09-18,
 * SUP-H) confirmed it open after #5614.
 *
 * What is executed is executed (the registry); what must be read is read with
 * comments stripped and COUNTED, and every floor faces the sabotage actually
 * possible: a second quote entry creeps back into either list, the template
 * card moves out of the one panel, a deep link names the retired id.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { VENDOR_THREAD_PANELS, VENDOR_THREAD_TOOLS } from '@/lib/vendor-thread-tools';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

const THREAD_PAGE = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const CLIENT_BRIEF = 'app/vendor-dashboard/clients/[eventId]/page.tsx';

const QUOTEISH = /quote|proposal/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

test('the registry names exactly one quote panel and exactly one quote launcher, and it is the primary one', () => {
  const panels = VENDOR_THREAD_PANELS.filter((p) => QUOTEISH.test(p.id));
  assert.deepEqual(panels.map((p) => p.id), ['build-quote'], `quote panels: ${panels.map((p) => p.id).join(', ')}`);
  const tools = VENDOR_THREAD_TOOLS.filter((t) => QUOTEISH.test(t.key));
  assert.deepEqual(tools.map((t) => t.key), ['build-quote'], `quote launchers: ${tools.map((t) => t.key).join(', ')}`);
  assert.equal(tools[0]!.primary, true, 'the one quote launcher is not the primary tool');
  assert.deepEqual([...(tools[0]!.reveal ?? [])], ['build-quote']);
  // The lists did not simply empty out.
  assert.ok(VENDOR_THREAD_PANELS.length >= 5, `panel list is ${VENDOR_THREAD_PANELS.length} long`);
  assert.ok(VENDOR_THREAD_TOOLS.length >= 8, `tool list is ${VENDOR_THREAD_TOOLS.length} long`);
});

test('the one panel mounts BOTH composers, once each — the builder and the template shortcut', () => {
  const page = read(THREAD_PAGE);
  const start = page.indexOf("'build-quote': (");
  assert.ok(start > 0, 'the thread page has no build-quote body');
  const end = page.indexOf("'offer-service':", start);
  assert.ok(end > start, 'the build-quote body has no end');
  const node = page.slice(start, end);
  assert.equal(count(node, /<ProposalMaker\b/g), 1, 'the builder is not inside the one quote panel');
  assert.equal(count(node, /<SendProposalCard\b/g), 1, 'the template shortcut is not inside the one quote panel');
  // …and nowhere else on the page: a second mount is a second form and a
  // second set of anchor ids.
  assert.equal(count(page, /<ProposalMaker\b/g), 1);
  assert.equal(count(page, /<SendProposalCard\b/g), 1);
  assert.equal(count(page, /'send-proposal':/g), 0, 'the retired panel still has a body');
});

test('nothing under app/ deep-links the retired #send-proposal; the brief’s Quote doors open the one panel', () => {
  const files = walk(join(WEB, 'app'));
  assert.ok(files.length > 800, `walked ${files.length} files — the walk broke`);
  const stale: string[] = [];
  for (const f of files) {
    if (count(stripComments(readFileSync(f, 'utf8')), /#send-proposal\b/g) > 0) stale.push(f.slice(WEB.length + 1));
  }
  assert.deepEqual(stale, [], `a deep link names the retired panel: ${stale.join(', ')}`);
  const brief = read(CLIENT_BRIEF);
  assert.ok(count(brief, /messages\/\$\{threadId\}#build-quote/g) >= 2, 'the brief lost a Quote door into the one panel');
});
