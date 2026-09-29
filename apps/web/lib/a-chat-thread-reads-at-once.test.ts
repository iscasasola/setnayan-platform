/**
 * a-chat-thread-reads-at-once.test.ts — both ends of a chat thread start their
 * reads together, and their two writes keep their place.
 *
 * ─── The bug this exists to prevent ──────────────────────────────────────
 * The couple's thread page made about twenty trips to the database ONE AFTER
 * ANOTHER — event date, block state, calls gate, vendor, messages, handshake,
 * pick, decisions, live pax, standing, booked money, then the conversation
 * column — and the supplier's made about twenty more after its one batch,
 * although most of them needed nothing but the thread (measured on prod
 * 2026-09-29: every `await` waits ~50–150 ms for the one before it).
 *
 * The fix starts every read as a promise and awaits them in ONE `Promise.all`.
 * The way it regresses is quiet: somebody adds the next read the way the old
 * ones were written — a plain `await` at the top of the page body — and it
 * works, passes every other test, and puts a whole round trip back in front of
 * every conversation.
 *
 * ─── The two writes ──────────────────────────────────────────────────────
 * Opening a thread WRITES: `markThreadRead` stamps the read marker, and
 * `resolveLivePax` can take the lazy guest-count lock. Starting reads earlier
 * is free; starting a write earlier is not — it would now run while a read it
 * used to follow could still fail the page. Each write therefore sits in its
 * own started block behind an `await` of what preceded it, and the
 * conversation column (which reads the `chat_thread_reads` row the marker
 * writes) awaits the marker first.
 *
 * ─── What it checks ──────────────────────────────────────────────────────
 * Between the "EVERY READ BELOW STARTS AT ONCE" banner and "THE ONE WAIT", no
 * statement at the page body's own depth may `await`. An `await` INSIDE a
 * started read (deeper indentation) is fine — that is the read's own work,
 * running beside the others.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');

const PAGES = [
  {
    side: 'couple',
    path: join(webRoot, 'app', 'dashboard', '[eventId]', 'messages', '[threadId]', 'page.tsx'),
  },
  {
    side: 'supplier',
    path: join(webRoot, 'app', 'vendor-dashboard', 'messages', '[threadId]', 'page.tsx'),
  },
];

const START = 'EVERY READ BELOW STARTS AT ONCE';
const WAIT = 'THE ONE WAIT';

/** The started block `(async () => { … })()` that holds `callIdx`. */
function enclosingStartedBlock(src: string, callIdx: number): string {
  const open = src.lastIndexOf('(async () => {', callIdx);
  assert.ok(open > 0, 'the call is no longer inside a started `(async () => { … })()` block');
  return src.slice(open, callIdx);
}

for (const { side, path } of PAGES) {
  const src = readFileSync(path, 'utf8');

  test(`${side} thread: the read block and its one wait are both still there, in order`, () => {
    const a = src.indexOf(START);
    const b = src.indexOf(WAIT);
    assert.ok(a > 0, `the "${START}" banner is gone from the ${side} thread page`);
    assert.ok(b > a, `"${WAIT}" must come after "${START}"`);
    // Each marker exactly once — a second copy (say, in a comment that
    // mentions it) would shrink the checked region to nothing and pass it.
    assert.equal(src.split(START).length - 1, 1, `"${START}" must appear exactly once`);
    assert.equal(src.split(WAIT).length - 1, 1, `"${WAIT}" must appear exactly once`);
    // The first statement after the banner: `const [ … ] = await Promise.all([`.
    const firstStatement = src.slice(b, src.indexOf(';', b));
    assert.match(
      firstStatement,
      /\]\s*=\s*await Promise\.all\(\[/,
      'the one wait is no longer a single Promise.all',
    );
  });

  test(`${side} thread: no read between them is awaited at the page body depth`, () => {
    const region = src.slice(src.indexOf(START), src.indexOf(WAIT));
    const offenders = region
      .split('\n')
      // Exactly two spaces = a statement of the page body itself.
      .filter((l) => /^ {2}\S/.test(l))
      .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
      .filter((l) => /\bawait\b/.test(l));
    assert.deepEqual(
      offenders,
      [],
      `A read on the ${side} thread page is awaited on its own, so every visit waits for it ` +
        'before the next read even starts. Start it as a promise ' +
        '(`const xRead = (async () => { … })();`) and add it to the one Promise.all under ' +
        '"THE ONE WAIT".',
    );
  });

  test(`${side} thread: each write waits for what preceded it`, () => {
    for (const call of ['markThreadRead(', 'resolveLivePax(']) {
      const calls = [...src.matchAll(new RegExp(call.replace('(', '\\('), 'g'))];
      assert.equal(calls.length, 1, `expected exactly one ${call}…) call on the ${side} page`);
      const before = enclosingStartedBlock(src, calls[0]!.index!);
      assert.match(
        before,
        /\n\s*await [^\n]+;\n/,
        `${call}…) — a WRITE — must sit behind an \`await\` of the reads that preceded it ` +
          'inside its started block; started bare, it runs before them.',
      );
    }
  });

  test(`${side} thread: the conversation column reads the marker only after writing it`, () => {
    const open = src.indexOf('const conversationRowsRead = (async () => {');
    assert.ok(open > 0, 'the conversation column is no longer one started block');
    const firstStatement = src
      .slice(open)
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('//'));
    assert.equal(
      firstStatement,
      'await markedRead;',
      'the conversation column reads `chat_thread_reads` — it must await the read marker first',
    );
  });
}
