/**
 * the-reply-ask-is-asked-once.test.ts — GUESTS ASKS ABOUT PHONE NOTICES ONCE, IN
 * THE HOUSE SHEET, NEVER ON FIRST PAINT, AND ITS YES IS THE PROFILE SWITCH'S YES.
 *
 * Owner, 2026-10-31: replies go to the phone, not the inbox. The ask is how a host
 * gets there without finding a switch in the profile. What this pins (the WHETHER
 * is run in lib/reply-push-ask.test.ts; this holds the wiring around it):
 *
 *   1 · the decision is the pure `replyAskMode` — no second copy of the rules here;
 *   2 · it rises after REPLY_ASK_DELAY_MS, from an effect — never on first paint —
 *       and the effect itself never asks the browser for permission;
 *   3 · Yes runs `subscribeThisDevice` (the profile switch's path), and BOTH Yes and
 *       Not now remember the answer (once means once, whichever was pressed);
 *   4 · it is the house sheet (`Sheet`) with its words in an ⓘ;
 *   5 · the page offers it to the couple only, and never inside the iPhone app;
 *       the screen is told how many replied from counts it already draws.
 *
 * SABOTAGE (each seen red, then restored): removed rememberAnswer from yes()
 * (3 red) · called subscribeThisDevice inside the effect (2 red) · dropped
 * `!storeShell` from the page (5 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const ASK = stripComments(readFileSync(join(HERE, '_components', 'reply-push-ask.tsx'), 'utf8'));
const SCREEN = stripComments(readFileSync(join(HERE, '_components', 'guests-screen.tsx'), 'utf8'));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

function fnBody(src: string, header: RegExp): string {
  const m = header.exec(src);
  assert.ok(m, `${header} not found — this guard is blind`);
  let depth = 0;
  for (let i = src.indexOf('{', m.index); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}' && --depth === 0) return src.slice(m.index, i + 1);
  }
  throw new Error('unbalanced');
}

test('1 · the decision is the pure replyAskMode', () => {
  assert.match(ASK, /replyAskMode\(\{/);
  assert.ok(!/REPLY_ASK_REASK_MS/.test(ASK), 'the 30-day rule is re-implemented in the component');
});

test('2 · it rises after a delay, from an effect that never prompts', () => {
  const effect = fnBody(ASK, /useEffect\(\(\) =>/);
  assert.match(effect, /setTimeout\([\s\S]*REPLY_ASK_DELAY_MS\)/, 'the ask is not delayed — it would rise on first paint');
  assert.ok(!/requestPermission|subscribeThisDevice/.test(effect), 'the effect asks the browser — a prompt on paint');
});

test('3 · Yes is the profile switch\'s path, and both answers are remembered by the ONE notice memory', () => {
  const yes = fnBody(ASK, /async function yes\(\)/);
  assert.match(yes, /await subscribeThisDevice\(\)/);
  assert.match(yes, /closeNotice\(\{ id: KEY, key: KEY, kind: 'todo', ask: true/, 'a Yes is not remembered — a failed Yes would ask again tomorrow');
  // "Not now" is the notice's own close word (one notice system, 14 Nov 2026); the old answer is honoured as legacy.
  assert.match(ASK, /<Notice\s+kind="todo"\s+ask\s+noticeKey=\{KEY\}/, 'the ask no longer registers with the one notice system');
  assert.match(ASK, /legacy=\{[\s\S]*?readLastAnswer\(storage\(\)\)/);
  assert.ok(!/rememberAnswer|setItem/.test(ASK), 'a hand-written store is written again');
});

test('4 · it is a line in the one notice system, its detail in an ⓘ — never a sheet that rises by itself', () => {
  assert.match(ASK, /title=\{REPLY_ASK_COPY\.title\}/);
  assert.match(ASK, /detail=\{ios \?/);
  assert.ok(!/<Sheet\b/.test(ASK), 'the ask pops up as a sheet again — nothing pops up by itself');
});

test('5 · the couple only — Web Push on the web, APNs in the app — told from counts already drawn', () => {
  assert.match(PAGE, /replyAsk=\{viewer\.isCouple\}/);
  assert.match(ASK, /if \(mode === 'native'\) await registerNativePush\(\);\s*else await subscribeThisDevice\(\);/, 'the app\'s Yes is not the native one');
  assert.match(SCREEN, /replyAsk && measured \? <ReplyPushAsk replied=\{stats\.yes \+ stats\.no\} \/> : null/);
  assert.match(ASK, /isStoreShellInBrowser\(/, 'the device-side app check is gone');
});
