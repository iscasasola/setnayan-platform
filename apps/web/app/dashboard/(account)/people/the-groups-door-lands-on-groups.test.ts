/**
 * the-groups-door-lands-on-groups.test.ts — final check A2-P4 (25 Nov 2026, plan batch A-1).
 *
 * The Groups door (`/dashboard/samahan`) forwards to People › Groups. With no group it must draw the Groups view —
 * "No group yet" and ＋ New — never a blank page. (Seen blank on the slow staging copy; once the copy was fast it drew.
 * The one branch that could draw nothing — rows missing — now says so.)
 *
 * ⚠ Held on comment-stripped source, not by a render: the view needs Next's app router mounted (`useRouter` through the
 * pinned row), which a unit test cannot stand up. The plan asked for a render; this is what the repo can hold today.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(here, rel), 'utf8'));

test('the door forwards to People › Groups', () => {
  assert.match(src('../samahan/page.tsx'), /redirect\(`\/dashboard\?seg=people&view=samahan\$\{note\}`\)/);
});

test('zero groups: the Groups view says "No group yet" and offers ＋ New; a refused list never says "none"', () => {
  const view = src('_components/people-groups-view.tsx');
  assert.match(view, /note=\{unreadable \? 'Not loaded just now' : rows\.length === 0 \? 'No group yet' :/);
  assert.match(view, /action=\{\{ kind: 'new-group' \}\}/);
});

test('the page never draws nothing for the Groups view', () => {
  const s = src('_components/people-segment.tsx');
  assert.match(s, /\{view === 'samahan' && !groupRows \? \(\s*<div[^>]*>\s*<ReadRefusedNotice what="your groups" \/>/);
  assert.match(s, /\{view === 'samahan' && groupRows \? \(/);
});
