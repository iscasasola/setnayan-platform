/**
 * the-guest-list-holds-no-theme-picker.test.ts — owner 2026-09-28, pointing at
 * "How your invite looks" on the Guest list's invite page: *"it should not be
 * inside guestlist, it should be on event hub maker on details."*
 *
 * ONE place chooses the theme — the Maker's Details page
 * (`launch/_components/maker-theme-picker.tsx`). Every other surface READS it.
 * So:
 *   1 · nothing under the Guest list can choose a theme — no radio, no picker,
 *       no theme save, no list of themes to pick from;
 *   2 · the Guest list keeps one quiet line: the theme guests meet, and a link
 *       to Event Hub Maker → Details;
 *   3 · across the whole app there is ONE theme picker and ONE theme writer.
 *
 * 🛡 MUTATION-CHECKED: the old picker restored under `guests/` → RED; the link
 * pointed back at the Maker's front page → RED; a second `invite_theme` save
 * added elsewhere → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', '..');
const read = (abs: string) => stripComments(readFileSync(abs, 'utf8'));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|mts)$/.test(name) && !name.includes('.test.')) out.push(p);
  }
  return out;
}

test('1 · nothing under the Guest list can choose a theme', () => {
  const files = walk(HERE);
  assert.ok(files.length > 20, `the Guest list scanned as ${files.length} files — the guard is looking at nothing`);
  const BANNED = [
    /InviteThemePicker/,
    /invite-theme-picker/,
    /setInviteTheme/,
    /name="invite_theme"/,
    /pickableInviteThemes/,
    /HUB_THEMES/,
    /\.update\(\{\s*invite_theme/,
    /invite_theme:\s*\w+\s*\}/,
  ];
  for (const f of files) {
    const src = read(f);
    for (const b of BANNED) assert.doesNotMatch(src, b, `${f.slice(APP.length)} can choose a theme (${b})`);
  }
  assert.ok(
    !existsSync(join(HERE, 'invite', '_components', 'invite-theme-picker.tsx')),
    'the old picker file is back on the Guest list',
  );
});

test('2 · the Guest list keeps ONE quiet line — the theme, and the way to Details', () => {
  const panel = read(join(HERE, 'invite', '_components', 'invite-panel.tsx'));
  const at = panel.indexOf('data-invite-theme-line');
  assert.ok(at > 0, 'the theme line is gone — a couple can no longer see which theme guests meet');
  const line = panel.slice(at, panel.indexOf('</p>', at));
  assert.match(line, /href=\{`\/dashboard\/\$\{eventId\}\/launch\?tool=details&item=theme`\}/, 'the link does not open Details');
  assert.match(line, /Change in Event Hub Maker ↗/);
  assert.match(line, /INVITE_THEMES\[liveTheme\]\.name/, 'the line names a theme it did not resolve');
  // What guests meet — through the one theme rule, not the pre-selection guess.
  assert.match(panel, /const liveTheme = resolveInviteTheme\(\{ saved: lookRow\?\.invite_theme \?\? null, ownsPro, mayShowStdFilm \}\)/);
  assert.doesNotMatch(panel, /suggestedInviteTheme/, 'the line names the onboarding guess, not what guests see');
});

test('3 · across the app: ONE theme picker, ONE theme writer', () => {
  const files = walk(APP);
  const savers = files.filter((f) => /invite_theme: id/.test(read(f)));
  assert.deepEqual(
    savers.map((f) => f.slice(APP.length)),
    ['/dashboard/[eventId]/launch/_components/maker-theme-picker.tsx'],
    'a second place saves the theme',
  );
  const writers = files.filter((f) => /\.update\(\{\s*invite_theme/.test(read(f)));
  assert.deepEqual(
    writers.map((f) => f.slice(APP.length)),
    ['/dashboard/[eventId]/website/hub-draft-actions.ts'],
    'a second live writer of events.invite_theme appeared — Apply is the one door',
  );
});
