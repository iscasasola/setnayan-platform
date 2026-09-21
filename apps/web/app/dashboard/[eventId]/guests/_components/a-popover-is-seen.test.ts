import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * 🔴 Owner 2026-09-21: "tapping the side will pop up so they can choose which
 * side." It already opened — at (-9999,-9999), hidden, because the popover
 * measured its position before its portal existed and never measured again.
 * Every chip editor in the guest table shared it.
 */
test('the popover re-measures once its portal exists', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'overlay-primitives.tsx'), 'utf8'),
  );
  const at = src.indexOf('export function Popover(');
  assert.ok(at > -1, 'Popover is gone — this guard is pointing at nothing');
  const body = src.slice(at, src.indexOf('\nexport function', at + 1) === -1 ? undefined : src.indexOf('\nexport function', at + 1));
  const deps = body.match(/setPos\(\{ left, top \}\);\s*\},\s*\[([^\]]*)\]\);/);
  assert.ok(deps, 'the measuring effect is gone or reshaped — re-check this guard');
  assert.match(deps[1] ?? '', /\bportal\b/, 'the popover measures before its portal exists and never again — it opens invisible');
});
