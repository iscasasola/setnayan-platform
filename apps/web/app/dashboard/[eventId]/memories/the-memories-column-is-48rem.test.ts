/**
 * 🖥 MEMORIES ON A DESK IS THE 48-REM READING COLUMN, CENTRED — AND THE PHONE IS UNTOUCHED.
 *
 * Owner, 16 Nov 2026 (DECISION_LOG 75a46e3c, item 12, "a"): *Memories on desktop is a 48rem column*. W1 had measured the
 * event Memories page at 64rem on a 1280 desk (RW-343, "not the 48rem reading column … needs the owner's reading").
 *
 * The claim is about the column's computed width, so this reads the CSS that produces it, not a class name alone:
 * `tab:max-w-3xl` must resolve, in the app's own Tailwind theme, to 48rem; the stage must be centred (`tab:mx-auto`);
 * and every width rule on the stage sits behind `tab:` (≥ 701px), so below 701 the div is an unstyled block and the
 * phone draws exactly what it drew before.
 *
 * SABOTAGE (run 16 Nov 2026): putting `tab:max-w-5xl` back turns test 1 red; dropping the `tab:` prefix from the cap
 * (so it binds on a phone) turns test 2 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const WEB = path.resolve(HERE, '../../../..');
const page = stripComments(readFileSync(path.join(HERE, 'page.tsx'), 'utf8'));
const stage = /<div className="([^"]*)" data-memories-stage="">/.exec(page)?.[1];

/** Tailwind's `max-w-3xl` in THIS app's theme (a theme override would change what the class means). */
function tailwindMaxWidth(key: string): string {
  const cfgPath = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs'].map((f) => path.join(WEB, f)).find((f) => {
    try {
      readFileSync(f);
      return true;
    } catch {
      return false;
    }
  });
  const cfg = cfgPath ? readFileSync(cfgPath, 'utf8') : '';
  const override = new RegExp(`maxWidth:[^}]*['"]?${key}['"]?\\s*:\\s*['"]([^'"]+)['"]`).exec(cfg)?.[1];
  // Tailwind's default scale: 3xl = 48rem, 5xl = 64rem.
  return override ?? ({ '3xl': '48rem', '5xl': '64rem' } as Record<string, string>)[key]!;
}

test('1 · from 701 the Memories stage is capped at 48rem and centred', () => {
  assert.ok(stage, 'the Memories stage (`data-memories-stage`) is gone — this guard is pointed at nothing');
  const caps = [...stage.matchAll(/(?:^|\s)tab:max-w-(\S+)/g)].map((m) => m[1]!);
  assert.deepEqual(caps, ['3xl'], `the stage's desk cap is ${caps.join(', ') || 'missing'}, not the reading column`);
  assert.equal(tailwindMaxWidth('3xl'), '48rem', 'max-w-3xl no longer means 48rem in this theme');
  assert.match(stage, /(?:^|\s)tab:mx-auto(?:\s|$)/, 'the 48-rem column is not centred');
});

test('2 · the phone is unchanged — no width rule on the stage binds below 701', () => {
  assert.ok(stage);
  const bare = stage.split(/\s+/).filter((c) => c && !c.startsWith('tab:'));
  assert.deepEqual(bare, [], `these classes bind on a phone: ${bare.join(' ')}`);
});
