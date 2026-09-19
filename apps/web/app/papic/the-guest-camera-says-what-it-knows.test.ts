/**
 * Guard: the guest camera page tells a guest what we actually know, and never
 * leaves them on a screen with no way off it.
 *
 * WHAT WAS WRONG (AREA-PAPIC, 2026-09-19). `/papic/guest` is where every guest
 * lands on the day: the invitation's Camera button, the day-of bar and the
 * personal-QR bridge all point here. It asked `eventPapicGuestActive`, the
 * BOOLEAN gate, which folds "we could not find out" into false. So a failed
 * pool read told a guest at the reception that guest cameras "haven't been
 * turned on" for the event, which is a decision nobody made. Production's pool
 * applies on every event, so that sentence was reachable only through a failed
 * read. Its two siblings (`/papic/me/[token]` and `/papic/decorate`) had
 * already moved to the three-state `eventPapicGuestAccess`. This page was the
 * one left behind. The existing guard (`a-camera-refusal-never-blames-the-host`)
 * could not see it because its sentence never says the word "host".
 *
 * And three of its four refusals were self-closing `<DoorShell … />`, with no
 * button at all. "Your photos are still in your gallery" named a place and
 * gave no way to reach it.
 *
 * The permission is unchanged. Anything but 'on' still gets no camera.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

function papicPages(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === 'page.tsx') out.push(p);
    }
  })(join(WEB, 'app', 'papic'));
  return out;
}

test('🔴 no guest-facing Papic page asks the two-state gate', () => {
  const pages = papicPages();
  assert.ok(pages.length >= 8, `floor: expected 8+ Papic pages, found ${pages.length}`);
  const twoState = pages
    .filter((f) => /\beventPapicGuestActive\s*\(/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(WEB.length + 1));
  assert.deepEqual(
    twoState,
    [],
    'a guest-facing Papic page asks eventPapicGuestActive, which reports a failed ' +
      'read as "cameras are off". Ask eventPapicGuestAccess and word the ' +
      "'unknown' state as what it is.",
  );
});

test('🔴 /papic/guest words the unknown state apart from "off"', () => {
  const src = stripComments(
    readFileSync(join(WEB, 'app', 'papic', 'guest', 'page.tsx'), 'utf8'),
  );
  const calls = src.match(/\beventPapicGuestAccess\s*\(/g) ?? [];
  assert.equal(calls.length, 1, `expected one eventPapicGuestAccess call, found ${calls.length}`);
  /* The refusal must test for exactly 'on'. `=== 'off'` (or a truthiness test)
     would hand a failed read a camera. */
  assert.match(src, /if \(access !== 'on'\)/, "the gate must refuse anything but 'on'");
  assert.match(
    src,
    /access === 'unknown'\s*\?\s*'We couldn’t check just now\.'/,
    "the 'unknown' state must say we could not check, not that cameras are off",
  );
});

test('🚪 every refusal on /papic/guest has a way off it', () => {
  const src = stripComments(
    readFileSync(join(WEB, 'app', 'papic', 'guest', 'page.tsx'), 'utf8'),
  );
  /* Walk each `<DoorShell` opening tag to its end and ask whether it closed
     itself (`/>`) or wraps children. Braces are tracked so a `/>` or `>`
     inside a JSX expression attribute (the eyebrow's <Camera … />) is skipped. */
  const selfClosing: number[] = [];
  let total = 0;
  const re = /<DoorShell\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    total += 1;
    let depth = 0;
    for (let i = m.index + '<DoorShell'.length; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (depth === 0 && c === '/' && src[i + 1] === '>') {
        selfClosing.push(total);
        break;
      } else if (depth === 0 && c === '>') break;
    }
  }
  assert.ok(total >= 4, `floor: expected 4+ DoorShells on /papic/guest, found ${total}`);
  assert.deepEqual(
    selfClosing,
    [],
    `DoorShell #${selfClosing.join(', #')} (of ${total}) closes itself, so it renders a ` +
      'sentence and no button. A guest on the wedding day then has only the back button.',
  );
  assert.match(
    src,
    /gate\.state === 'closed' \?[\s\S]{0,120}href=\{`\/papic\/me\/\$\{encodeURIComponent\(session\.qr_token\)\}`\}/,
    '"your photos are still in your gallery" must link to the gallery',
  );
});
