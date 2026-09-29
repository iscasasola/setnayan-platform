/**
 * maker-reorder.test.ts — ↕ A DRAG OF N PLACES IS ONE SAVE, AND IT SAVES WHAT
 * THE CHAIN OF N MOVES WOULD HAVE SAVED.
 *
 * The chain (`moveWidgetUp/Down` → `stagePlacesAfterMove`, once per place) is
 * the reference: for every scene and every distance, the one patch this module
 * builds must put every scene on the stage at the same place the N single swaps
 * would, and the navigator's optimistic list must show that order.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { stagePlacesAfterMove } from './stage-scenes';
import { swapsForDrop, type MakerStageList, type MakerTile } from './maker-scene-list';
import { movedOrder, optimisticStageList, sameOrder, stageOrderPatch } from './maker-reorder';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const TYPE: Record<string, string> = { a: 'schedule', b: 'venue_map', c: 'dress_code', d: 'photo_moments', e: 'special_message', f: 'what_to_bring' };

/** The chain the navigator used to post: one swap per place. */
function chain(order: string[], id: string, delta: number): string[] {
  let rows = order.map((widget_id) => ({ widget_id }));
  for (let i = 0; i < Math.abs(delta); i++) {
    const places = stagePlacesAfterMove(rows, id, delta < 0 ? 'up' : 'down');
    if (!places) break;
    rows = places.map((p) => p.row);
  }
  return rows.map((r) => r.widget_id);
}

test('one move of N places lands exactly where N single swaps land', () => {
  for (const id of IDS) {
    for (let delta = -6; delta <= 6; delta++) {
      if (delta === 0) continue;
      const want = chain(IDS, id, delta);
      const got = movedOrder(IDS, id, delta);
      if (sameOrder(want, IDS)) assert.equal(got, null, `${id} ${delta}: nothing moves`);
      else assert.deepEqual(got, want, `${id} by ${delta}`);
    }
  }
});

test('a drop computed by swapsForDrop is the same order the couple dropped', () => {
  // Drop `e` before `b`: e moves to index 1.
  const d = swapsForDrop(IDS, 'e', 'b');
  assert.deepEqual(movedOrder(IDS, 'e', d), ['a', 'e', 'b', 'c', 'd', 'f']);
  // Drop `a` at the end.
  assert.deepEqual(movedOrder(IDS, 'a', swapsForDrop(IDS, 'a', null)), ['b', 'c', 'd', 'e', 'f', 'a']);
});

test('the patch gives every scene on the stage its place — the move action’s own shape', () => {
  const order = movedOrder(IDS, 'c', -2)!;
  const patch = stageOrderPatch(order, (id) => TYPE[id], 'rsvp')!;
  assert.deepEqual(patch, {
    widgets: Object.fromEntries(order.map((id, place) => [TYPE[id], { stage_order: { rsvp: place } }])),
  });
  // A row whose type is unknown here: no patch — the caller falls back to the move action.
  assert.equal(stageOrderPatch(order, (id) => (id === 'd' ? undefined : TYPE[id]), 'rsvp'), null);
});

test('the navigator shows the dropped order at once, fixed tiles where they were', () => {
  const scene = (id: string): MakerTile => ({ kind: 'scene', key: `w:${TYPE[id]}` as never, widgetId: id, type: TYPE[id] as never, label: id });
  const fixed: MakerTile = { kind: 'fixed', key: 'f:rsvp' as never, fixed: 'rsvp' as never, label: 'RSVP', why: '' };
  const list: MakerStageList = { stage: 'rsvp', shown: [scene('a'), scene('b'), fixed, scene('c')], folded: [] };
  const shown = optimisticStageList(list, ['c', 'x', 'a', 'b']).shown;
  assert.deepEqual(
    shown.map((t) => (t.kind === 'scene' ? t.widgetId : t.kind)),
    ['c', 'a', 'fixed', 'b'],
  );
  assert.equal(optimisticStageList(list, null), list, 'no override: the server list itself');
  // A scene the order does not know: never guess — the server list.
  assert.equal(optimisticStageList(list, ['a', 'b']), list);
});
