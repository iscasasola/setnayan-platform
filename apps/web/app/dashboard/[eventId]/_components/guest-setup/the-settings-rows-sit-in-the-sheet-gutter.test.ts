/**
 * ↔ GUESTS SETTINGS' ROWS SIT IN THE SHEET'S GUTTER (walk of the dev labs, 2026-11-01: in `/dev/guests-lab` the ⚙
 * sheet's "GETTING IN", "How guests get in", "RSVP asks" and "Finalize guest list" touched the screen's edge, x = 0).
 *
 * `MenuSettingsButton` draws only the sheet's frame and its first line (`px-4`); each menu's rows bring their own
 * 16-px gutter. The page's `InvitePanel` wraps `GuestSetupRows` in it; the lab handed the bare rows in, so the lab
 * drew a look the page never had. Held for EVERY file that mounts the rows: they stand inside a `px-4` wrapper.
 *
 * SABOTAGE, seen red: drop the lab's (or InvitePanel's) `<div className="px-4">` → "mounts GuestSetupRows with no gutter".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const APP = join(import.meta.dirname, '..', '..', '..', '..');

function* tsx(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* tsx(p);
    else if (name.endsWith('.tsx')) yield p;
  }
}

test('every mount of the Guests settings rows stands in the sheet gutter', () => {
  const mounts: string[] = [];
  for (const file of tsx(APP)) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const n = (src.match(/<GuestSetupRows\b/g) ?? []).length;
    if (n === 0) continue;
    mounts.push(file.slice(APP.length + 1));
    const gutters = (src.match(/<div className="px-4"[^>]*>\s*<GuestSetupRows\b/g) ?? []).length;
    assert.equal(gutters, n, `${file.slice(APP.length + 1)} mounts GuestSetupRows with no gutter`);
  }
  console.log(`GuestSetupRows mounts: ${mounts.join(' · ')}`);
  assert.ok(mounts.length >= 2, 'the page (InvitePanel) and the lab both mount the rows — one is gone; re-aim this guard');
});
