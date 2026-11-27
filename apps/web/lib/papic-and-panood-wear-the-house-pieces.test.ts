/**
 * 📸 PAPIC AND PANOOD WEAR THE HOUSE PIECES — themes audit 27 Nov 2026 § Group G (guest surfaces) and the buttons audit
 * of the same day. Held here so none of it drifts back:
 *
 *   1 · NO SPINNER anywhere under `app/papic/**` or `app/panood/**` (house rule: a pending button says its verb,
 *       `ActionButton`'s `busy`; a loading area is a `Ghost`). A REC / LIVE dot that pulses is a live signal, not a
 *       loading state, so `animate-pulse` is not counted — only `Loader2` and `animate-spin`.
 *   2 · The Kwento decorator's corner knob and ✕ are REAL buttons with a keyboard path (the buttons audit found
 *       `role="button"` spans with pointer handlers only): ↑/↓/←/→ on the knob, Enter/Space on ✕.
 *   3 · The Papic camera's starting cover uses the ONE scrim's camera depth (`--sn-scrim-solid` with the scrim blur,
 *       audit § 2.5), never a hand-picked `bg-ink/80`. (The run-out cover keeps its deeper dark for now: over a live
 *       picture the token's 0.55 let a bright scene wash out its message — left for an owner call.)
 *   4 · The filled main buttons that were hand-made in these files are `ActionButton` now.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.tsx') && !p.includes('.test.')) out.push(p);
  }
  return out;
}

const SPINNER = /\bLoader2\b|\banimate-spin\b/;

test('1 · no spinner under /papic or /panood', () => {
  const files = [...walk(join(WEB, 'app', 'papic')), ...walk(join(WEB, 'app', 'panood'))];
  assert.ok(files.length > 40, `anti-vacuity: only ${files.length} files walked`);
  const bad = files
    .filter((f) => SPINNER.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(bad, [], `a spinner is back — say the step (ActionButton busy) or draw a Ghost:\n${bad.join('\n')}`);
});

test('the spinner check sees a spinner', () => {
  assert.ok(SPINNER.test('<Loader2 aria-hidden className="h-4 w-4 animate-spin" />'));
  assert.ok(!SPINNER.test('<span className="h-2 w-2 animate-pulse rounded-full bg-cream" />'));
});

test('2 · the Kwento knob and ✕ are real buttons with a keyboard path', () => {
  const src = stripComments(read('app/papic/decorate/_components/kwento-decorator.tsx'));
  assert.doesNotMatch(src, /role="button"/, 'a span is dressed as a button again');
  const knob = /<button[^>]*?onPointerDown=\{\(e\) => onHandleDown\(e, ov\)\}[\s\S]*?aria-label="Resize and rotate"/.exec(src);
  assert.ok(knob, 'the corner knob is not a <button>');
  assert.match(knob[0], /onKeyDown=\{\(e\) => onHandleKey\(e, ov\.id\)\}/, 'the knob has no keyboard path');
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) assert.ok(src.includes(key), `${key} does nothing`);
  const delAt = src.indexOf('aria-label="Delete"');
  const del = src.slice(src.lastIndexOf('<button', delAt), delAt);
  assert.ok(delAt > 0 && del.startsWith('<button') && !del.includes('</button>'), 'the ✕ is not a <button>');
  assert.match(del, /onClick=\{[\s\S]*?removeActive\(\)/, 'the ✕ deletes on pointer only (Enter/Space reach onClick)');
  assert.equal((src.match(/sn-hit-2d/g) ?? []).length, 2, 'both handles press at 46 (`sn-hit-2d`)');
});

test('3 · the Papic camera covers wear the one scrim, not a hand-picked dark', () => {
  const src = stripComments(read('app/papic/guest/_components/papic-guest-capture.tsx'));
  assert.doesNotMatch(src, /absolute inset-0[^"'`]*\bbg-ink\/80\b/, 'a hand-picked camera cover is back');
  const covers = [...src.matchAll(/className="absolute inset-0 [^"]*"/g)].map((m) => m[0]);
  const scrimmed = covers.filter((c) => c.includes('bg-[var(--sn-scrim-solid)]') && c.includes('backdrop-blur-[var(--sn-scrim-blur)]'));
  assert.ok(scrimmed.length >= 1, 'the starting cover wears the scrim token');
});

test('4 · the converted main buttons are ActionButton', () => {
  const uses: Array<[string, string]> = [
    ['app/papic/decorate/_components/kwento-decorator.tsx', 'Save to Memories'],
    ['app/papic/guest/_components/papic-guest-capture.tsx', 'Agree & open my camera'],
    ['app/papic/me/[token]/_components/guest-story-maker.tsx', ' label="Make my Story"'],
    ['app/papic/demo/[token]/_components/demo-join-flow.tsx', 'Take the shot'],
    ['app/papic/seat/[token]/_components/camera-bridge-panel.tsx', ' label="Still"'],
    ['app/papic/order/[token]/page.tsx', 'Log my payment'],
    ['app/panood/demo/[token]/_components/cam-join-flow.tsx', 'Allow camera + mic & go live'],
    ['app/panood/control/[eventId]/_components/program-bridge.tsx', 'Open program output'],
  ];
  for (const [file, word] of uses) {
    const src = stripComments(read(file));
    const at = src.indexOf(word);
    assert.ok(at > 0, `${file}: "${word}" is gone`);
    assert.ok(src.lastIndexOf('<ActionButton', at) > src.lastIndexOf('<button', at), `${file}: "${word}" is a hand-made button again`);
  }
});
