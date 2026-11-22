/**
 * 🎂 BOTH ＋ TILES OF THE CAKE MAKER REACH THE DESIGNER (Cake Maker v6; controller, 2026-11-21: "#8112 doesn't ship
 * until the tiles work end to end").
 *
 *   · couple — ＋ › "Design a cake" (full width, at the end of Ask) opens the couple's designer for THIS chat;
 *   · supplier — ＋ › For your service › "Ask for a cake design" posts the invite card, whose "Design your cake" opens
 *     the same designer for the couple.
 *
 * Both are drawn only when the chat's shop has its Cake Maker on, read through the ONE existing action (`cakeAction`
 * op `status`) — no new server action.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = process.cwd();
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const SHEET = read('app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx');
const PLUS = read('app/_components/cake-maker/cake-plus.tsx');
const INDEX = read('app/_components/cake-maker/index.ts');
const INVITE = read('app/_components/chat/cards/cake-invite-card.tsx');

test('each side’s ＋ asks for its own cake tile', () => {
  assert.match(SHEET, /<ToolsSheetButton rows=\{rows\} sheetMark="couple" threadId=\{threadId\} cake="couple" \/>/, 'the couple’s ＋ draws no cake tile');
  // Since the ＋ FINAL tray (#8132): an unverified shop has every tile locked, so it is not handed the cake tile either.
  assert.match(
    SHEET,
    /<ToolsSheetButton rows=\{rows\} sheetMark="vendor" threadId=\{threadId\} cake=\{verified === false \? undefined : 'vendor'\} unverified=\{verified === false\} \/>/,
    'the supplier’s ＋ draws no cake tile',
  );
  assert.match(SHEET, /const cakeOn = useCakeTile\(cake \? threadId : undefined, cake \?\? 'couple'\)/);
});

test('the tiles are drawn only when the shop has it on — through the existing status op, never a new action', () => {
  assert.match(PLUS, /cakeChatStatus\(threadId\)/);
  assert.match(INDEX, /cakeAction\(\{ op: 'status', threadId \}\)/);
  assert.match(PLUS, /const v = r\.on \? r\.side : 'off'/, 'a shop with the Cake Maker off must draw no tile');
  assert.match(PLUS, /if \(!r\) return;/, 'a failed read must draw no tile');
  assert.doesNotMatch(PLUS, /['"]use server['"]/, 'the tiles add no server action');
  assert.match(SHEET, /if \(cakeOn && threadId && cake === 'couple'\)/);
  assert.match(SHEET, /if \(cakeOn && threadId && cake === 'vendor'\)/);
});

test('the couple’s "Design a cake" is full width at the end of Ask and opens the designer for this chat', () => {
  const tile = SHEET.slice(SHEET.indexOf('data-cake-plus="couple"') - 200, SHEET.indexOf('data-cake-plus="couple"') + 900);
  assert.match(tile, /className="col-span-2"/, 'the tile is not full width');
  assert.match(tile, /CAKE_TILE_WORDS\.couple/);
  assert.match(tile, /afterSheetStepsBack\(\(\) => setCakeOpen\(true\), holds\)/, 'the tile does not open the designer');
  assert.match(SHEET, /=== 'files'\);/, 'the tile is not placed before Share (the end of Ask)');
  assert.match(SHEET, /\{cakeOpen && threadId \? <CakeDesignerFromPlus threadId=\{threadId\} onClose=\{\(\) => setCakeOpen\(false\)\} \/> : null\}/);
  assert.match(PLUS, /<CakeDesignerSheet\s+threadId=\{threadId\}\s+onClose=\{onClose\}\s+onSent=\{\(\) => \{[\s\S]*?router\.refresh\(\);/);
  assert.match(PLUS, /createPortal\(\s*<div className="relative z-\[var\(--sn-z-panel\)\]"/, 'the designer must float over a picked client');
  assert.equal(INDEX.match(/CAKE_TILE_WORDS = \{ couple: '([^']+)'/)?.[1], 'Design a cake');
});

test('the supplier’s For your service › "Ask for a cake design" posts the invite, whose button opens the designer', () => {
  assert.match(SHEET, /onClick=\{\(\) => setLevel\('service'\)\}/, 'For your service does not open its second level');
  assert.match(SHEET, />\s*For your service\s*</);
  const ask = SHEET.slice(SHEET.indexOf('data-cake-plus="vendor"'), SHEET.indexOf('data-cake-plus="vendor"') + 1200);
  assert.match(ask, /const failed = await askForCakeDesign\(threadId\)/);
  assert.match(ask, /CAKE_TILE_WORDS\.vendor/);
  assert.match(SHEET, /data-cake-ask-failed=""/, 'a refused invite must say so, never close as if sent');
  assert.match(INDEX, /cakeAction\(\{ op: 'invite', threadId \}\)/);
  assert.equal(INDEX.match(/vendor: '([^']+)' \} as const/)?.[1], 'Ask for a cake design');
  // The invite's own button is the couple's way into the same designer.
  assert.match(INVITE, /<CakeDesigner threadId=\{threadId\} onClose=\{\(\) => setOpen\(false\)\} onSent=\{onSent\} \/>/);
});

test('the Cake Maker adds ZERO server actions — it rides supplierScan as op cake_tool', () => {
  const actions = read('app/_components/cake-maker/cake-actions.ts');
  assert.doesNotMatch(actions, /^\s*['"]use server['"]/m, 'cake-actions.ts became a server action file again (the budget is full)');
  assert.match(actions, /^import 'server-only';/m);
  const call = read('app/_components/cake-maker/cake-call.ts');
  assert.match(call, /await supplierScan\(\{ op: 'cake_tool', input \}\)/);
  const scan = read('app/_actions/supplier-scan-actions.ts');
  assert.match(scan, /case 'cake_tool':\n\s+return \{ op: 'cake_tool', result: await runCakeAction\(req\.input\) \};/);
});
