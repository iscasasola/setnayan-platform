import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCameraCards,
  printableCardCount,
  type ChannelCardInput,
} from './live-studio-camera-cards';

const open = (over: Partial<ChannelCardInput> = {}): ChannelCardInput => ({
  zoneId: 1,
  zoneIndex: 1,
  label: 'Main stage',
  venueLabel: null,
  claimUrl: 'https://www.setnayan.com/panood/cam/tok_main',
  hasSeat: true,
  claimed: false,
  revoked: false,
  ...over,
});

describe('buildCameraCards — the card says what the control room says', () => {
  test('THE FIX: the card is titled by CHANNEL, not by a camera index', () => {
    const { cards } = buildCameraCards([open()]);
    assert.equal(cards.length, 1);
    // zoneIndex 1 → CH 2 (CH 1 is the controlled screen), and the caption is
    // composed by the same helper the controller uses.
    assert.equal(cards[0]!.title, 'CH 2 · Main stage');
    assert.equal(cards[0]!.channel, 2);
    // The old sheet would have said "Camera 3" here, matching nothing on screen.
    assert.ok(!/^Camera /.test(cards[0]!.title));
  });

  test('the venue line rides along when the host set one', () => {
    const { cards } = buildCameraCards([open({ venueLabel: '  Garden aisle  ' })]);
    assert.equal(cards[0]!.venue, 'Garden aisle');
  });

  test('a blank venue label is an absence, not an empty line', () => {
    assert.equal(buildCameraCards([open({ venueLabel: '   ' })]).cards[0]!.venue, null);
  });

  test('channels keep the host’s own order and numbering', () => {
    const { cards } = buildCameraCards([
      open({ zoneId: 1, zoneIndex: 1, label: 'Main stage' }),
      open({ zoneId: 2, zoneIndex: 2, label: 'Ceremony' }),
      open({ zoneId: 3, zoneIndex: 3, label: 'Reception' }),
    ]);
    assert.deepEqual(
      cards.map((c) => c.title),
      ['CH 2 · Main stage', 'CH 3 · Ceremony', 'CH 4 · Reception'],
    );
  });
});

describe('buildCameraCards — what must never be handed out', () => {
  test('a channel with NO seat prints nothing, and says why', () => {
    // The old sheet's real harm: it printed seats bound to no channel, so the
    // operator joined and appeared nowhere.
    const { cards, waiting } = buildCameraCards([
      open({ hasSeat: false, claimUrl: null }),
    ]);
    assert.equal(cards.length, 0);
    assert.equal(waiting.length, 1);
    assert.match(waiting[0]!.why, /no join code yet/);
    assert.equal(waiting[0]!.title, 'CH 2 · Main stage');
  });

  test('a CLAIMED channel prints nothing — the link is a live credential', () => {
    const { cards, waiting } = buildCameraCards([
      open({ claimUrl: null, claimed: true }),
    ]);
    assert.equal(cards.length, 0);
    assert.match(waiting[0]!.why, /already joined/);
  });

  test('a REVOKED channel prints nothing — the code is already dead', () => {
    const { cards, waiting } = buildCameraCards([
      open({ claimUrl: null, revoked: true }),
    ]);
    assert.equal(cards.length, 0);
    assert.match(waiting[0]!.why, /retired/);
  });

  test('NO SILENT OMISSION: every channel lands in exactly one list', () => {
    const rows = [
      open({ zoneId: 1, zoneIndex: 1 }),
      open({ zoneId: 2, zoneIndex: 2, claimUrl: null, claimed: true }),
      open({ zoneId: 3, zoneIndex: 3, claimUrl: null, hasSeat: false }),
      open({ zoneId: 4, zoneIndex: 4, claimUrl: null, revoked: true }),
    ];
    const { cards, waiting } = buildCameraCards(rows);
    assert.equal(cards.length + waiting.length, rows.length);
    const seen = new Set([...cards, ...waiting].map((r) => r.zoneId));
    assert.equal(seen.size, rows.length, 'no channel may be dropped or double-counted');
  });

  test('every waiting channel carries a reason a person can act on', () => {
    const { waiting } = buildCameraCards([
      open({ zoneId: 1, zoneIndex: 1, claimUrl: null, hasSeat: false }),
      open({ zoneId: 2, zoneIndex: 2, claimUrl: null, claimed: true }),
      open({ zoneId: 3, zoneIndex: 3, claimUrl: null, revoked: true }),
      // hasSeat, not claimed, not revoked, still no URL — the unnamed case.
      open({ zoneId: 4, zoneIndex: 4, claimUrl: null }),
    ]);
    assert.equal(waiting.length, 4);
    for (const w of waiting) assert.ok(w.why.trim().length > 0, `empty reason on ${w.title}`);
  });

  test('an empty event produces neither cards nor noise', () => {
    assert.deepEqual(buildCameraCards([]), { cards: [], waiting: [] });
  });
});

describe('printableCardCount — the doorway cannot over-promise', () => {
  test('counts exactly what the sheet would print', () => {
    const rows = [
      open({ zoneId: 1, zoneIndex: 1 }),
      open({ zoneId: 2, zoneIndex: 2 }),
      open({ zoneId: 3, zoneIndex: 3, claimUrl: null, claimed: true }),
      open({ zoneId: 4, zoneIndex: 4, claimUrl: null, hasSeat: false }),
    ];
    assert.equal(printableCardCount(rows), 2);
    assert.equal(printableCardCount(rows), buildCameraCards(rows).cards.length);
  });

  test('zero when nothing is joinable — so no door onto nothing is offered', () => {
    assert.equal(
      printableCardCount([
        open({ claimUrl: null, hasSeat: false }),
        open({ zoneId: 2, zoneIndex: 2, claimUrl: null, claimed: true }),
      ]),
      0,
    );
  });
});
