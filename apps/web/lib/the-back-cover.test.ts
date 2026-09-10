/**
 * THE BACK COVER — guards.
 *
 * Every assertion here is about a way the back cover could LIE: appearing when
 * the host chose nothing, offering a control that records nothing, naming a kind
 * the screen would never offer, or pointing at a route that does not exist.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { backCoverFor, doorFor, GUEST_DOOR_IS_UNBUILT } from './the-back-cover';
import { nextCandidates } from './whats-next';
import type { StoryViewer } from './who-can-see-your-story';

const HOST: StoryViewer = { isHost: true, belongsToEvent: true };
const GUEST: StoryViewer = { isHost: false, belongsToEvent: true };
const STRANGER_: StoryViewer = { isHost: false, belongsToEvent: false };

const offered = nextCandidates({
  eventDateISO: '2026-08-20',
  todayISO: '2026-09-09',
  roster: [
    { key: 'anniversary', label: 'The first anniversary', solemn: false },
    { key: 'christening', label: 'A christening', solemn: false },
    { key: 'reunion', label: 'A reunion', solemn: false },
  ],
  formatDate: (iso) => iso,
});

test('nothing announced draws NOTHING — absent, not empty', () => {
  for (const viewer of [HOST, GUEST, STRANGER_]) {
    assert.equal(
      backCoverFor({ announcement: null, offered, viewer, eventId: 'e1' }),
      null,
      'a story that ends at the last word is finished',
    );
  }
});

test('a kind the screen would never offer draws NOTHING', () => {
  const out = backCoverFor({
    announcement: { kind: 'a-kind-nobody-offered' },
    offered,
    viewer: HOST,
    eventId: 'e1',
  });
  assert.equal(out, null);
});

test('an announced kind carries the SAME words the desk previews', () => {
  const out = backCoverFor({
    announcement: { kind: 'anniversary' },
    offered,
    viewer: HOST,
    eventId: 'e1',
  });
  assert.ok(out, 'an announced candidate must resolve');
  assert.equal(out.title, 'The first anniversary');
  assert.ok(out.when.length > 0);
});

test('THE GUEST GETS NO CONTROL — nothing can honour "tell me when there is more"', () => {
  assert.equal(doorFor(GUEST, 'e1'), null, GUEST_DOOR_IS_UNBUILT);
  const out = backCoverFor({
    announcement: { kind: 'anniversary' },
    offered,
    viewer: GUEST,
    eventId: 'e1',
  });
  assert.ok(out, 'the guest still reads the sentence');
  assert.equal(out.door, null, 'but is offered no button that records nothing');
});

test('the host is sent to the desk, the stranger to the real create route', () => {
  assert.deepEqual(doorFor(HOST, 'abc'), {
    label: 'Open the story maker',
    href: '/dashboard/abc/story',
  });
  const stranger = doorFor(STRANGER_, 'abc');
  assert.ok(stranger);
  assert.equal(stranger.href, '/dashboard/create-event');
});

/**
 * 🔴 THE ROUTE MUST EXIST. `/create` does not exist in this app and the first
 * draft of the module pointed at it — the same fake door the guest arm refuses.
 * A string is not a route, so this asserts the directory is really there.
 */
test('every href the back cover can hand out resolves to a real route', () => {
  const appDir = join(process.cwd(), 'apps/web/app');
  const root = appDir.includes('apps/web/apps/web')
    ? join(process.cwd(), 'app')
    : appDir;
  for (const viewer of [HOST, STRANGER_]) {
    const door = doorFor(viewer, 'e1');
    assert.ok(door);
    /*
     * ⚠ THE URL IS NOT THE PATH. `/dashboard/create-event` lives at
     * `dashboard/(account)/create-event` — `(account)` is a ROUTE GROUP and
     * contributes nothing to the address. This guard caught the module pointing
     * at `/create` (no such route at all), and then caught this test itself
     * looking in the wrong directory. Resolve the file, not the URL.
     */
    if (door.href === '/dashboard/create-event') {
      readFileSync(join(root, 'dashboard/(account)/create-event/page.tsx'));
    } else {
      readFileSync(join(root, 'dashboard/[eventId]/story/page.tsx'));
    }
  }
});
