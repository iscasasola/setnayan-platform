/**
 * a-face-is-never-drawn-at-its-natural-size.test.ts — 🖼 EVERY PICTURE ON THE GUEST LIST HAS ITS SIZE IN ITS OWN
 * MARKUP (owner 2026-10-16: *"on guests, when i initially load it. i see big pictures of the profile photo of
 * iscasasolaii@gmail.com. this is wrong … a layer that is not fixed before everything loads"*).
 *
 * What drew it big: the list's row face was `<img src={face}>` sized ONLY by the list's CSS module
 * (`.ava img`). The Guests loading screen painted the kept picture of the page (the last-seen html snapshot)
 * on whatever page you came from — where that CSS module had not loaded — so the groom's face (the owner's
 * own account photo) arrived at its natural 1080-px size until the real page and its stylesheet replaced it.
 * Two fixes, both held here:
 *   1. every `<img>` on the Guest list's screens, and the account avatar in the shell above it, carries
 *      `width` and `height` attributes — HTML sizes the picture before any stylesheet or script arrives;
 *   2. a last-seen snapshot freezes each picture at the size it was SHOWN (`lib/last-seen/snapshot-dom.ts`),
 *      so a kept picture of any of the five pages can never paint a face at its file's size.
 *
 * Sabotage (2026-10-16): the row face's `width`/`height` removed → test 1 red; the snapshot's size freeze
 * removed → test 2 red. Both reverted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');

function tsxUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsxUnder(p));
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Each JSX `<img …>` element's attribute text. */
function imgs(src: string): string[] {
  const out: string[] = [];
  const re = /<img\b/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 0;
    let i = m.index + 4;
    for (; i < src.length; i += 1) {
      const c = src[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) break;
    }
    out.push(src.slice(m.index, i + 1));
  }
  return out;
}

test('1 · every picture on the Guest list and its shell avatar is sized in its own markup', () => {
  const files = [
    ...tsxUnder(HERE),
    join(WEB, 'app', '_components', 'account-switcher', 'account-switcher.tsx'),
  ];
  const unsized: string[] = [];
  let seen = 0;
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const tag of imgs(src)) {
      seen += 1;
      if (!/\swidth=/.test(tag) || !/\sheight=/.test(tag)) unsized.push(`${relative(WEB, f)}: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`);
    }
  }
  assert.ok(seen >= 8, `found ${seen} pictures — the scan found the files`);
  assert.deepEqual(unsized, [], 'a picture drawn at its natural size until CSS arrives');
});

test('2 · a kept picture of a page freezes every image at the size it was shown', async () => {
  const { freezePictureSizes } = await import('@/lib/last-seen/snapshot-dom');
  const shown = [{ getBoundingClientRect: () => ({ width: 40, height: 40 }) }, { getBoundingClientRect: () => ({ width: 92.4, height: 122.6 }) }];
  const kept = shown.map(() => {
    const attrs: Record<string, string> = {};
    return { attrs, setAttribute: (n: string, v: string) => void (attrs[n] = v), style: { width: '', height: '' } };
  });
  freezePictureSizes(shown, kept);
  assert.deepEqual(kept[0]!.attrs, { width: '40', height: '40' });
  assert.deepEqual(kept[0]!.style, { width: '40px', height: '40px' });
  assert.deepEqual(kept[1]!.attrs, { width: '92', height: '123' });
  // …and the snapshot does it to its clone BEFORE dropping anything (so the two lists still line up).
  const dom = stripComments(readFileSync(join(WEB, 'lib', 'last-seen', 'snapshot-dom.ts'), 'utf8'));
  const freeze = dom.indexOf("freezePictureSizes(\n    root.querySelectorAll('img')");
  const drop = dom.indexOf('clone.querySelectorAll(DROP)');
  assert.ok(freeze > 0 && drop > freeze, 'sizes frozen on the clone before anything is removed');
});
