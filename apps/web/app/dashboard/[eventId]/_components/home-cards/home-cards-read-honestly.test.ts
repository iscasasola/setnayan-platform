/**
 * home-cards-read-honestly.test.ts — A HOME SERVICE CARD NEVER SAYS "OFF", "0" OR "NOTHING" OVER A READ IT COULD NOT
 * MAKE (owner 2026-10-23, the service widgets: *"Failed reads — never empty, never Off, no switch to flip, Reload in
 * place"*; the repo's honest-read rule, `lib/guests.ts` + `lib/guests-read-is-honest.test.ts`).
 *
 * Two of the reads these cards stand on fail soft on their own pages, on purpose (the controller must still run a
 * broadcast; the Planner page must still render) — the booth's 24-h count and the Planner's figures read a refusal as
 * 0. The prototype named both as the NEW guards. So each card's loader is pinned to:
 *   · its row read refused → `{ ok: false }` (or `measured: false`);
 *   · a count is a measured count — `count === null` is a refusal, never `?? 0`;
 *   · the card draws `failed` (Couldn't load · Reload) for it, and nothing else of the card.
 * And the cards are the couple's alone, on the web: `serviceCards` is asked of the member type, the store shell and
 * the app.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CARDS = 'app/dashboard/[eventId]/_components/home-cards';

const LOADERS: Array<{ file: string; refusals: RegExp[] }> = [
  { file: 'lib/home-hub-card.server.ts', refusals: [/if \(eventRes\.error \|\| !eventRes\.data\) return \{ ok: false \};/, /if \(!widgetsRes\.error\) \{/] },
  {
    file: 'lib/home-live-card.server.ts',
    refusals: [
      /if \(zonesRes\.error \|\| !zonesRes\.data \|\| pickRes\.error \|\| airRes\.error \|\| broadcastRes\.error \|\| !overlays\) return \{ ok: false \};/,
      /if \(!cameras\) return \{ ok: false \};/,
    ],
  },
  { file: 'lib/home-music-card.server.ts', refusals: [/if \(eventRes\.error \|\| !eventRes\.data\) return \{ ok: false \};/] },
  {
    file: 'lib/home-booth-card.server.ts',
    refusals: [/if \(todayRes\.error \|\| todayRes\.count === null \|\| allRes\.error \|\| allRes\.count === null\) return \{ ok: false \};/],
  },
];

test('every card loader turns a refused read into { ok: false }, never a default', () => {
  for (const { file, refusals } of LOADERS) {
    const src = read(file);
    for (const r of refusals) assert.match(src, r, `${file}: the refusal check is gone — ${r}`);
    assert.doesNotMatch(src, /\.count \?\? 0|count \|\| 0/, `${file}: a refused count reads as 0`);
  }
  // The overlays read that says when it could not read (the controller's own one returns all-off defaults).
  assert.match(read('lib/live-studio-overlays.ts'), /export async function readOverlaySettingsMeasured\([\s\S]*?if \(error\) \{[\s\S]*?return null;/);
});

test('the Planner says whether it measured — and its card asks', () => {
  const lib = read('lib/setnayan-ai-activity.ts');
  assert.match(lib, /measured: boolean;/);
  assert.match(lib, /const measured =\s*!refused\(vendorsRes\) &&\s*!refused\(sponsorsRes\) &&\s*!refused\(paperworkRes\) &&\s*!\('threw' in upcoming\) &&\s*upcoming\.unreadableSources\.length === 0;/);
  assert.match(read(`${CARDS}/home-planner-card.tsx`), /if \(!activity \|\| !activity\.measured\) return <HomeServiceCard [^>]*\bfailed\b/);
});

test('each card draws "failed" for an unread read — and nothing else of itself', () => {
  for (const f of ['home-hub-card.tsx', 'home-live-card.tsx', 'home-music-card.tsx', 'home-booth-card.tsx']) {
    assert.match(read(`${CARDS}/${f}`), /if \(!read\.ok\) return <HomeServiceCard [^>]*\bdots=\{\[\]\}[^>]*\bfailed\b/, `${f}: an unread card is drawn as a card`);
  }
  const shell = read('app/dashboard/[eventId]/_components/home-service-card.tsx');
  const failed = shell.slice(shell.indexOf('if (failed) {'), shell.indexOf('const grows ='));
  assert.ok(failed.length > 0, 'the shell lost its failed branch');
  assert.match(failed, /Couldn’t load/);
  assert.match(failed, /label="Reload"/);
  assert.doesNotMatch(failed, /settings|role="switch"|GlanceMeter/, 'the failed card still draws a control or a number');
});

test('the cards are the couple’s alone, on the web', () => {
  assert.match(read('app/dashboard/[eventId]/page.tsx'), /const serviceCards = viewerMemberType === 'couple' && !storeShell && !appleFacts;/);
});
