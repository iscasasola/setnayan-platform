/**
 * 🌄 STUDIO › LOOK › BACKGROUND OFFERS EVERY SOURCE — in the app too, for a Pro event.
 *
 * Owner, on his phone in the app 2026-10-26: *"i cannot see the different background options. upload, color,
 * videos, etc"*. His Look › Background showed Pattern · Focus · Blur · Shade and the page colour — the store shell's
 * fallback rows — because the editor page built the main-background row (`MainBackgroundPanel`: Source ▾ Colour ·
 * Scene ◆ · Video ◆ · Upload ◆ and its picture cards) only when `!storeShell`. His event owns Event Hub Pro.
 *
 *   (1) the rule: the web always; the app's shell for an event that owns Pro; never a free event in the shell;
 *   (2) the editor page asks THAT rule for the row (no bare `storeShell ? []` in front of it again), and the lab asks
 *       it too, so `/dev/maker-lab?shell=1` draws what the app draws;
 *   (3) once the row is there, Look draws ITS Source ▾ and leaves the fallback rows out (`sourceHolds`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { mainBackgroundRowOffered } from './main-background-offered';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) the main background\'s Source ▾ is built on the web, and in the app for a Pro event', () => {
  assert.equal(mainBackgroundRowOffered({ storeShell: false, ownsPro: false }), true);
  assert.equal(mainBackgroundRowOffered({ storeShell: false, ownsPro: true }), true);
  assert.equal(mainBackgroundRowOffered({ storeShell: true, ownsPro: true }), true, 'a Pro event in the app is not offered Colour · Scene · Video · Upload');
  assert.equal(mainBackgroundRowOffered({ storeShell: true, ownsPro: false }), false);
});

test('(2) the editor page and the lab ask the one rule for the row', () => {
  const page = code('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /\.\.\.\(!mainBackgroundRowOffered\(\{ storeShell, ownsPro \}\)\s*\?\s*\[\]\s*:\s*\[\s*\{\s*key: 'main-background',/, 'the main-background row is not built through `mainBackgroundRowOffered`');
  assert.doesNotMatch(page, /\.\.\.\(storeShell\s*\?\s*\[\]\s*:\s*\[\s*\{\s*key: 'main-background',/, 'the row is hidden from the whole app again — a Pro event loses its Source ▾');
  const lab = code('app/dev/maker-lab/maker-lab-shell.tsx');
  assert.match(lab, /mainBackgroundRowOffered\(\{ storeShell: storeShellLab, ownsPro \}\) \? \{ 'main-background':/);
});

test('(3) with the row, Look draws its Source ▾ — not the fallback rows', () => {
  const look = code('app/dashboard/[eventId]/launch/_components/details-look-pages.tsx');
  assert.match(look, /const sourceHolds = maker\?\.stagesStudio === true && Boolean\(look\?\.background\);/);
  const panel = code('app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx');
  assert.match(panel, /<PickMenu\s+label="Background"\s+dataAttr="data-bg-source-pick"/, 'the Source ▾ is no longer drawn by the panel');
});
