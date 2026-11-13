/**
 * Owner, 13 Nov 2026: "on discover we do not want to create an event there. we want to create on our home".
 * Discover's empty "More upcoming on Setnayan" shelf says what it is for and offers no create action;
 * creating an event lives on Home (the Events board).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(path.join(__dirname, 'front-door-discover.tsx'), 'utf8'));

test('Discover never links at the create-event flow', () => {
  assert.ok(!/\/dashboard\/create-event/.test(src), 'Discover links at /dashboard/create-event again — create lives on Home');
  assert.ok(!/Create an event/.test(src), 'Discover shows a "Create an event" action again');
});
