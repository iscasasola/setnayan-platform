/**
 * 🤝 THE COUNTER'S FACE, HELD (Unichat part C · controller ruling 20 Nov 2026 — drawing UNICHAT-LIVE-2026-11-19,
 * `cardHTML` → counter). The card face is: ~~old price~~ → new price, ONE line under it ("Under your lowest", or the gap
 * · until), ⓘ, and Decline · Counter · Accept. Everything the card printed before (amount, gap, their words, Good
 * until, what Accept makes, the lowest) moved into an ⓘ sheet — the app's one `Sheet`, never a new one. Nothing lost.
 * Run from apps/web: node --import tsx --test app/_components/chat/cards/the-counter-face-is-the-drawing.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..', '..');
const src = stripComments(readFileSync(join(WEB, 'app/_components/chat/cards/negotiate-cards.tsx'), 'utf8'));
const card = src.slice(src.indexOf('export function NegotiationCard'), src.indexOf('function Status('));
const face = card.slice(Math.max(0, card.indexOf('const answers = turn')));
const status = src.slice(src.indexOf('function Status('));

test('1 · the face: old → new price, one line, ⓘ, and Decline · Counter · Accept in the drawing’s order', () => {
  assert.ok(card.length > 0 && card.includes('const answers = turn'), 'NegotiationCard and its face are found');
  assert.match(face, /title=\{<CounterTitle ask=\{ask\} wasCentavos=/, 'the title is the price pair');
  assert.match(src, /<s className="[^"]*">\{pesos\(wasCentavos\)\}<\/s>/, 'the old price is struck');
  assert.match(src, /<ArrowRight\b/, 'old → new');
  assert.match(face, /'Under your lowest'/, 'the warning line on the face');
  assert.match(face, /warn=\{underLowest && answers\}/, 'in the warn colour');
  assert.match(face, /info=\{\s*<button[\s\S]{0,300}aria-label="Details"[\s\S]{0,200}onClick=\{\(\) => setInfo\(true\)\}/, 'ⓘ opens the sheet');
  const order = ['label="Decline"', 'label="Counter"', 'label="Accept"'].map((l) => status.indexOf(l));
  assert.ok(order.every((i) => i > 0), 'all three answers exist');
  assert.ok(order[0]! < order[1]! && order[1]! < order[2]!, 'Decline · Counter · Accept, in that order');
  assert.match(status, /tone="brand"\s+main\s+icon=\{Check\}\s+label="Accept"/, 'Accept is the main verb and says only "Accept"');
});

test('2 · ⓘ is the app’s one Sheet, and it holds everything the card used to print', () => {
  assert.match(src, /import \{ Sheet \} from '@\/app\/_components\/sheet';/, 'the shared sheet, not a new one');
  const sheet = face.slice(face.indexOf('<Sheet'));
  assert.match(sheet, /^<Sheet open=\{info\} onClose=\{\(\) => setInfo\(false\)\} labelledById=\{sheetTitle\}/);
  assert.match(sheet, /\{details\}/, 'the full body is in the sheet');
  assert.match(sheet, /\{status\(true\)\}/, 'the state in words is in the sheet');
  const details = card.slice(card.indexOf('const details ='), card.indexOf('const status ='));
  for (const [what, re] of [
    ['the amount', /pesos\(ask\.amountCentavos \?\? 0\)/],
    ['instead of / was', /instead of \$\{pesos\(outcome\.wasCentavos\)\}/],
    ['the gap pill', /<KindTag kind="counter">/],
    ['their words', /ask\.note\.trim\(\)/],
    ['Good until', /until\.words/],
    ['what Accept makes', /<PlanRows rows=\{outcome\.rows\}/],
    ['the lowest', /Under your lowest, \{pesos\(lowest\)\}\. Only your shop sees that\./],
  ] as const) {
    assert.match(details, re, `the sheet keeps ${what}`);
  }
});

test('3 · every control still reachable: the counter editor, Try again, the refusal and the settled line', () => {
  assert.match(face, /\{answers && !countering \? status\(false\) : null\}/, 'the answers sit on the face');
  assert.match(face, /\{counterEditor\}/, 'Counter opens its editor on the card');
  assert.match(card, /<CouldNotLoad what="this counter" onRetry=\{load\} \/>/, 'a refused read still says so');
  assert.match(status, /\{blocked \? <Problem text=\{blocked\} \/> : null\}/, 'why Accept is greyed, said beside it');
  assert.match(card, /settled=\{settled\}/, 'a settled counter folds to one line whose press opens the details');
  assert.match(status, /if \(textOnly\) return line\(/, 'the sheet never draws a second set of buttons');
  assert.match(face, /data-negotiation=\{kind\}\s+data-negotiation-status=\{negotiationStatus\}/, 'Every version can still find their open counter');
});

test('4 · the lowest stays private: read on the supplier side only, never for the hosts', () => {
  assert.match(card, /if \(viewer === 'vendor' && kind === 'counter' && seed\?\.lowestCentavos === undefined\) void loadLowest\(threadId\)/);
  assert.match(card, /const lowest = viewer === 'vendor' && kind === 'counter' && !mine \? lowestOf : null;/);
  // Anti-vacuity: the hosts' view must never reach the number.
  assert.doesNotMatch(card, /viewer === 'couple'[^\n]*loadLowest/);
});
