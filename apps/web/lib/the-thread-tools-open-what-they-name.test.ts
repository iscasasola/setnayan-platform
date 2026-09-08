/**
 * THE TOOLS OPEN WHAT THEY NAME.
 *
 * ── WHAT THIS EXISTS TO CATCH ───────────────────────────────────────────────
 * The supplier's tools moved out of the gap between the last message and the
 * text box (owner, 2026-09-08: *"still messy chatbox"*). They mount ONCE above
 * the message stream as CLOSED `<details>`, and the customer rail's right
 * column is a list of launchers that open them.
 *
 * That makes a whole class of change silent. A launcher naming an id the page
 * does not render scrolls to nothing; a plain `href="#build-quote"` scrolls to
 * a COLLAPSED strip. Both read, to a supplier, as a button that does nothing —
 * and neither throws, logs, or fails a type. Shipping the move on its own would
 * have done exactly that to FOUR live controls: the rail's own "Send proposal",
 * and the client brief's Quote / Call / Log-payment deep links.
 *
 * So every assertion here is about REACHABILITY, and every one counts rather
 * than merely looking:
 *
 *   1. every launcher names something the page renders
 *   2. every panel is reachable from at least one launcher (no orphan tool)
 *   3. the page renders one `<details>` per panel, and a body for each
 *   4. the ids that are not panels — the payment anchor and the two call
 *      buttons — are really minted
 *   5. nothing in the rail hash-links a panel any more
 *   6. the opener that honours a hash on arrival is mounted
 *   7. every hash another page deep-links here is one of these ids
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  VENDOR_THREAD_PANELS,
  VENDOR_THREAD_TOOLS,
  VENDOR_THREAD_IN_PAGE_ANCHORS,
} from '@/lib/vendor-thread-tools';

const WEB = join(import.meta.dirname, '..');
const THREAD_PAGE = 'app/vendor-dashboard/messages/[threadId]/page.tsx';
const RAIL = 'app/vendor-dashboard/messages/[threadId]/_components/chat-info-rail.tsx';
const OPENER = 'app/vendor-dashboard/messages/[threadId]/_components/reveal-thread-tool.tsx';
const CLIENT_BRIEF = 'app/vendor-dashboard/clients/[eventId]/page.tsx';

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const page = read(THREAD_PAGE);
const rail = read(RAIL);
const opener = read(OPENER);
const brief = read(CLIENT_BRIEF);

const PANEL_IDS = new Set(VENDOR_THREAD_PANELS.map((p) => p.id));
const ANCHOR_IDS = new Set(VENDOR_THREAD_IN_PAGE_ANCHORS);

test('the scan actually read the four files (an empty read is a green lie)', () => {
  for (const [rel, src] of [
    [THREAD_PAGE, page],
    [RAIL, rail],
    [OPENER, opener],
    [CLIENT_BRIEF, brief],
  ] as const) {
    assert.ok(src.length > 500, `${rel} read as ${src.length} chars — the scan is not reading it`);
  }
  assert.ok(VENDOR_THREAD_PANELS.length >= 5, 'the panel list emptied out');
  assert.ok(VENDOR_THREAD_TOOLS.length >= 8, 'the tool list emptied out');
});

test('🔑 1 · every launcher names something this page renders', () => {
  const unknown: string[] = [];
  for (const tool of VENDOR_THREAD_TOOLS) {
    if (!tool.reveal) continue;
    for (const candidate of tool.reveal) {
      if (!PANEL_IDS.has(candidate) && !ANCHOR_IDS.has(candidate)) {
        unknown.push(`${tool.key} → #${candidate}`);
      }
    }
  }
  assert.deepEqual(
    unknown,
    [],
    'a launcher points at an id that is neither a panel nor a listed in-page anchor',
  );
});

test('🔑 2 · every panel is reachable from at least one launcher', () => {
  const reached = new Set(
    VENDOR_THREAD_TOOLS.flatMap((t) => (t.reveal ? [...t.reveal] : [])),
  );
  const orphans = [...PANEL_IDS].filter((id) => !reached.has(id));
  assert.deepEqual(
    orphans,
    [],
    'a panel mounts on the page with nothing that opens it — the tools list is the only way in',
  );
});

test('🔑 3 · the page renders one disclosure per panel, with a body for each', () => {
  // The disclosures are generated from the shared list, so the page must map
  // over it rather than hand-listing ids that can drift out of step.
  assert.equal(
    (page.match(/VENDOR_THREAD_PANELS\.map\(/g) ?? []).length,
    1,
    'the page no longer renders its disclosures from the shared panel list',
  );
  // …and each panel needs a body keyed by its id, or it opens to nothing.
  const missing = [...PANEL_IDS].filter((id) => !page.includes(`'${id}':`));
  assert.deepEqual(missing, [], 'a panel has no body on the page — it would open empty');
});

test('🔑 4 · the two ids that are NOT panels are really minted', () => {
  assert.equal(
    (page.match(/id="pending-payments"/g) ?? []).length,
    1,
    'the payment scroll anchor is gone — "Log payment" would land nowhere',
  );
  // The call buttons' ids exist only because the thread page opts in; the
  // launcher mints none by default (it is mounted on three other screens).
  assert.equal(
    (page.match(/buttonIdPrefix="thread-call"/g) ?? []).length,
    1,
    'the call launcher stopped minting thread-call-voice / thread-call-video',
  );
  for (const id of ['thread-call-voice', 'thread-call-video']) {
    const suffix = id.replace('thread-call-', '');
    assert.ok(
      read('app/_components/thread-call-launcher.tsx').includes(`-${suffix}\``),
      `the launcher no longer builds the ${id} id`,
    );
  }
});

test('🔑 5 · the rail no longer hash-links a panel (that scrolls to a closed strip)', () => {
  const hashLinks = [...rail.matchAll(/#([a-z-]+)/g)].map((m) => m[1]!);
  const atPanels = hashLinks.filter((h) => PANEL_IDS.has(h));
  assert.deepEqual(
    atPanels,
    [],
    'the rail links a panel by hash again — a closed <details> does not open on scroll',
  );
  assert.equal(
    (rail.match(/revealThreadTool\(/g) ?? []).length,
    2,
    'the rail must open its targets through revealThreadTool (once inline, once via the sheet)',
  );
});

test('🔑 6 · the hash opener is mounted, so a deep link from elsewhere still opens', () => {
  assert.equal(
    (page.match(/<ThreadToolHashReveal\s*\/>/g) ?? []).length,
    1,
    'nothing honours the hash on arrival — every cross-page deep link lands on a closed panel',
  );
  assert.ok(
    /addEventListener\('hashchange'/.test(opener),
    'the opener stopped listening for later hash changes',
  );
});

test('🔑 7 · every hash the client brief deep-links here is one of these ids', () => {
  const deepLinks = [...brief.matchAll(/\/vendor-dashboard\/messages\/\$\{threadId\}#([a-z-]+)/g)]
    .map((m) => m[1]!);
  assert.ok(deepLinks.length >= 3, `expected the brief to deep-link the thread; found ${deepLinks.length}`);
  const unknown = deepLinks.filter((h) => !PANEL_IDS.has(h) && !ANCHOR_IDS.has(h));
  assert.deepEqual(
    unknown,
    [],
    'the client brief deep-links a thread anchor this page does not render',
  );
});
