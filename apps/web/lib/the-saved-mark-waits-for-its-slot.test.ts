/**
 * the-saved-mark-waits-for-its-slot.test.ts — SW-HYDR, final check A2-P11 (25 Nov 2026).
 *
 * Every Schedule load threw React #418 (a hydration mismatch) and re-drew the page on the phone. Caught in the browser
 * on the staging copy: React's internal mismatch (#519) was thrown at `div[data-schedule-copy]`, the empty slot the page
 * sends for the saved mark. The schedule layout's `ScheduleSavedSlot` hydrates first and drew the mark INTO that slot
 * before the page's own Suspense boundary had hydrated, so React found children the server never drew. Proved by
 * rewriting the page response so the mark could not find its slot: #418 gone (2 of 2), and back as served (2 of 2).
 *
 * The rule held here: the mark is drawn only into a slot React has already claimed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { isClaimedByReact } from '@/lib/react-claimed';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string): string => stripComments(readFileSync(join(web, rel), 'utf8'));

test('isClaimedByReact: only an element React has hydrated carries its fiber key', () => {
  assert.equal(isClaimedByReact({}), false, 'a server-drawn node React has not reached');
  assert.equal(isClaimedByReact({ dataset: {} }), false);
  assert.equal(isClaimedByReact({ __reactFiber$k3j2: {}, __reactProps$k3j2: {} }), true);
  assert.equal(isClaimedByReact({ __reactProps$k3j2: {} }), false, 'props alone is not the claim');
});

test('the saved mark is portaled only into a slot React has claimed, never on the layout’s first hydrated render', () => {
  const s = src('app/_components/offline-ready/schedule-saved-slot.tsx');
  assert.doesNotMatch(s, /useMemo\(\(\) => \(hydrated \? readSlot\(\) : null\)/, 'the old draw-at-once read');
  assert.match(s, /if \(found && isClaimedByReact\(found\.el\)\) return setSlot\(found\);/);
  assert.match(s, /frame = requestAnimationFrame\(look\);/, 'it keeps looking, a frame at a time');
  assert.ok(s.indexOf('if (!slot) return null;') < s.indexOf('createPortal('), 'no portal before the slot is claimed');
});
