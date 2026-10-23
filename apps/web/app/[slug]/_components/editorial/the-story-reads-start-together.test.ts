/**
 * the-story-reads-start-together.test.ts — ⚡ THE POST EVENT STORY IS NOT A QUEUE OF READS.
 *
 * MEASURED 2026-10-23 on production: the guest page on Post Event took 3.7–3.9 s for the couple's Maker canvas and
 * ~2.3 s for a guest, while the page's own timer (`slug/invitation-body`) said 0.13–0.36 s — the rest was the story,
 * which reads while it renders (`EditorialContent` → `loadEditorialData` → `loadStorySpineFacts`). Run here against a
 * database that counts (`editorial-reads.harness.ts`): 57 reads, 51 of them one after another; at 150 ms a trip,
 * 7.7 s. Every read that needs only the event (and the day's window, and the already-redacted story) is now STARTED
 * together and awaited where it always was: 51 → 10 deep, 1.5 s, the same 57 reads.
 *
 * The property held is the DEPTH — and that the reads past the story's one gate are never started for a viewer the
 * gate turns away.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

type View = { calls: number; depth: number; ms: number; steps: string[] };
const WEB = join(__dirname, '..', '..', '..', '..');

function measure(): { host: View; guest: View; stranger: View; beforeTheGate: View } {
  const out = execFileSync(
    join(WEB, '..', '..', 'node_modules', '.bin', 'tsx'),
    [join(WEB, 'app', '[slug]', '_components', 'editorial', 'editorial-reads.harness.ts')],
    {
      cwd: WEB,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '', STORY_READS_DELAY_MS: '3' },
      timeout: 240_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const line = out.split('\n').find((l) => l.startsWith('STORY_READS '));
  assert.ok(line, `the harness printed no report:\n${out.slice(-2000)}`);
  return JSON.parse(line.slice('STORY_READS '.length));
}

const VIEWS = measure();
const shape = (v: View) => `${v.calls} requests, ${v.depth} deep\n  ${v.steps.join('\n  ')}`;
/** Reads only the spine past the gate makes — one is enough to tell "past the gate" from "turned away". */
const PAST_THE_GATE = /^\d+ (panood_broadcasts|rpc\/story_dial_bucket_counts)\(/;

/** MEASURED: 51 → 10 for the host and for a guest (above). */
const STORY_MAX_DEPTH = 11;

test('0 · the fixture drew the whole story, past the gate — or the depth below would be about nothing', () => {
  for (const [who, v] of [['host', VIEWS.host], ['guest', VIEWS.guest]] as const) {
    assert.ok(v.calls >= 50, `the ${who}'s story made only ${v.calls} reads — the fixture no longer reaches the spine:\n${shape(v)}`);
    assert.ok(v.steps.some((s) => PAST_THE_GATE.test(s)), `the ${who}'s story never read past the gate:\n${shape(v)}`);
  }
});

test(`1 · the story is at most ${STORY_MAX_DEPTH} trips deep for the couple and for a guest (it was 51)`, () => {
  assert.ok(VIEWS.host.depth <= STORY_MAX_DEPTH, `the couple's story waits on reads one after another again:\n${shape(VIEWS.host)}`);
  assert.ok(VIEWS.guest.depth <= STORY_MAX_DEPTH, `a guest's story waits on reads one after another again:\n${shape(VIEWS.guest)}`);
});

test('2 · a viewer the gate turns away starts nothing past it', () => {
  const past = VIEWS.stranger.steps.filter((s) => PAST_THE_GATE.test(s));
  assert.deepEqual(past, [], `reads past the story's gate were started for a stranger:\n${shape(VIEWS.stranger)}`);
  /* …and not only the spine's: the stranger reads EXACTLY what is read before the gate (the words, the role names,
     the story's loader, run alone) — the same reads, the same number of each. Any read started ahead of the gate,
     whatever table it touches, is one more here. */
  const what = (v: View) => v.steps.map((s) => s.replace(/^\d+ /, '')).sort();
  assert.ok(VIEWS.beforeTheGate.calls >= 15, `the before-the-gate run made only ${VIEWS.beforeTheGate.calls} reads — it measures nothing:\n${shape(VIEWS.beforeTheGate)}`);
  assert.deepEqual(
    what(VIEWS.stranger),
    what(VIEWS.beforeTheGate),
    `a stranger the gate turns away was started reads beyond the ones before the gate:\n${shape(VIEWS.stranger)}\n— before the gate —\n${shape(VIEWS.beforeTheGate)}`,
  );
});
