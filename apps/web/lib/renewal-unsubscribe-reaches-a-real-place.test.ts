/**
 * The renewal reminder's "Unsubscribe" reaches a real place (couple-dashboard audit, 2026-11-17).
 * It pointed at `/settings/notifications` with one-click POST — a page that never existed, so a
 * mail client's Unsubscribe hit a 404 and the reader stayed subscribed. (Read as source: the
 * module's imports reach `server-only`.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = stripComments(readFileSync(join(WEB, 'lib/subscription-renewal-emails.ts'), 'utf8'));
const fn = src.slice(src.indexOf('export function renewalUnsubscribeHeaders'));
const body = fn.slice(0, fn.indexOf('\n}') + 2);

test('the renewal unsubscribe is a mailto, the shape every sibling relationship mail carries', () => {
  assert.ok(body.length > 40, 'renewalUnsubscribeHeaders moved — re-anchor this guard');
  assert.match(body, /'List-Unsubscribe':\s*`<mailto:\$\{[A-Z_]+\}\?subject=unsubscribe>`/);
});

test('it never points at an app page that does not exist', () => {
  for (const m of body.matchAll(/\$\{base\}(\/[a-z0-9/-]+)/g)) {
    const page = join(WEB, 'app', m[1], 'page.tsx');
    assert.ok(existsSync(page), `List-Unsubscribe points at ${m[1]}, which has no page`);
  }
  assert.doesNotMatch(body, /\/settings\/notifications/);
});
