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

test('3 · Yes is the profile switch\'s path, and both answers are remembered', () => {
  const yes = fnBody(ASK, /async function yes\(\)/);
  assert.match(yes, /await subscribeThisDevice\(\)/);
  assert.match(yes, /rememberAnswer\(/, 'a Yes is not remembered — a failed Yes would ask again tomorrow');
  const close = fnBody(ASK, /const close = \(\) =>/);
  assert.match(close, /rememberAnswer\(/, 'Not now is not remembered — the ask would return on every visit');
  assert.match(ASK, /<ReplyAskSheet mode=\{mode\} busy=\{busy\} onYes=\{yes\} onClose=\{close\} \/>/, 'the sheet is not wired to the remembering handlers');
  assert.match(ASK, /label=\{REPLY_ASK_COPY\.notNow\}[\s\S]*?onClick=\{onClose\}/);
});

test('4 · it is the house sheet, its detail in an ⓘ', () => {
  assert.match(ASK, /<Sheet open onClose=\{onClose\} labelledById=\{headingId\} rise>/);
  assert.match(ASK, /<InfoTip[\s\S]*?label=\{REPLY_ASK_COPY\.title\}/);
});

test('5 · the couple only, never in the iPhone app, told from counts already drawn', () => {
  assert.match(PAGE, /replyAsk=\{viewer\.isCouple && !storeShell\}/);
  assert.match(SCREEN, /replyAsk && measured \? <ReplyPushAsk replied=\{stats\.yes \+ stats\.no\} \/> : null/);
  assert.match(ASK, /isStoreShellInBrowser\(/, 'the device-side app check is gone');
});
