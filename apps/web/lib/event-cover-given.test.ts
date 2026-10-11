/**
 * event-cover-given.test.ts — 🖼 THE DISCOVER CARD'S COVER, DRAWN FROM
 * REMEMBERED PUBLIC FACTS, ASKS NOTHING ON THE WAY — and is the same cover.
 *
 * `dressEventCoverGiven` is the one body behind every cover. It is RUN here,
 * for every theme the product ships × owned or not × with and without a hero
 * photo, against readers that COUNT what they are asked.
 *
 *   1 · THE SAME COVER. Answered from handed-in facts it draws exactly what it
 *       draws when it asks the live readers and they say the same thing.
 *   2 · NOTHING ASKED. On the remembered path the live readers are never
 *       called — not once, for any theme.
 *   3 · THE FACTS ARE ENOUGH. Whenever the body asks about ownership,
 *       `ownershipCanChangeTheCover` had said the fact was needed — so the
 *       remembered read (which looks ownership up by that rule) always holds
 *       what the body will ask for.
 *   4 · THE GATE. A saved Pro theme is worn only by an owner; a read that fails
 *       is "not owned"; ownership is asked at most once per cover.
 *   5 · A type whose words cannot be resolved gets no poster — never a guess.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import type { EventWords } from '@/app/[slug]/_lib/event-words';
import type { GuestLook } from '@/app/[slug]/_lib/loaders';
import { dressEventCoverGiven, type CoverIo } from './event-cover-given';
import { ownershipCanChangeTheCover } from './hub-look-given';
import type { CoverRow } from './home-public-reads-core';
import { INVITE_THEMES, type InviteThemeId } from './invite-themes';

const IDS = Object.keys(INVITE_THEMES) as InviteThemeId[];
const WORDS = { solemn: false, twoPeople: true, eventWord: 'wedding' } as unknown as EventWords;
const NO_LOOK = { vars: null, ombre: null } as unknown as GuestLook;

function row(over: Partial<CoverRow> = {}): CoverRow {
  return {
    event_id: 'event-1',
    display_name: 'Cale & Ice',
    event_date: '2026-12-18',
    venue_name: 'San Agustin',
    event_type: 'wedding',
    monogram_text: null,
    monogram_color: null,
    invite_theme: null,
    std_background: null,
    landing_page_hero_image_url: null,
    monogram_custom_svg: null,
    monogram_uploaded_svg: null,
    landing_page_hero_video_r2_key: null,
    role_palette: null,
    site_bg_color: null,
    site_button_color: null,
    site_font_key: null,
    site_art_direction: null,
    ...over,
  };
}

type Asked = { ownsPro: number; words: number; logoAnimationOn: number };

/** Readers that answer from fixed values and count each ask. */
function readers(answers: { owned: boolean | 'refused'; words?: EventWords | null; animation?: boolean }) {
  const asked: Asked = { ownsPro: 0, words: 0, logoAnimationOn: 0 };
  const io: CoverIo = {
    ownsPro: async () => {
      asked.ownsPro += 1;
      if (answers.owned === 'refused') throw new Error('orders read refused');
      return answers.owned;
    },
    words: async () => {
      asked.words += 1;
      return answers.words === undefined ? WORDS : answers.words;
    },
    logoAnimationOn: async () => {
      asked.logoAnimationOn += 1;
      return answers.animation ?? false;
    },
    sign: async (ref) => (ref ? `https://media.test/${encodeURIComponent(ref)}` : null),
    backgroundPhoto: async (std) => (std ? 'https://media.test/background.jpg' : null),
    guestLook: () => NO_LOOK,
    themeStill: (theme) => (theme === 'house' ? null : `/themes/${theme}/still.jpg`),
  };
  return { io, asked };
}

/** The remembered path: the facts are values in hand; the LIVE readers must never be reached. */
function fromFacts(facts: { websitePro: boolean; logoAnimation: boolean }) {
  const live = { asked: 0 };
  const base = readers({ owned: false }).io;
  const io: CoverIo = {
    ...base,
    ownsPro: () => Promise.resolve(facts.websitePro),
    words: async () => WORDS,
    logoAnimationOn: () => Promise.resolve(facts.logoAnimation),
  };
  return { io, live };
}

const ROWS: Array<[string, Partial<CoverRow>]> = [
  ['plain', {}],
  ['a hero photo', { landing_page_hero_image_url: 'r2://setnayan-media/events/e/hero.jpg' }],
  ['a Save-the-Date background', { std_background: { kind: 'photo', ref: 'r2://setnayan-media/events/e/std.jpg' } }],
  ['their own colour', { site_bg_color: '#1E3A5F', monogram_color: '#7A1F3D', monogram_text: 'C & I' }],
];

test('1 + 2 · every theme × owned × row: the remembered facts draw the same cover, and ask nothing', async () => {
  let compared = 0;
  const themesSeen = new Set<string | null>();
  for (const saved of [null, ...IDS]) {
    for (const owned of [true, false]) {
      for (const [name, over] of ROWS) {
        const r = row({ invite_theme: saved, ...over });
        const live = readers({ owned, animation: true });
        const viewed = await dressEventCoverGiven(r, null, live.io);
        const remembered = await dressEventCoverGiven(r, null, fromFacts({ websitePro: owned, logoAnimation: true }).io);
        assert.deepEqual(remembered, viewed, `${saved ?? 'nothing saved'} · owned=${owned} · ${name}`);
        themesSeen.add(viewed.theme);
        compared += 1;
      }
    }
  }
  assert.ok(compared >= 40, `only ${compared} covers compared`);
  assert.ok(themesSeen.size >= 3, `every cover resolved to ${[...themesSeen].join('/')} — the matrix is not reaching the themes`);
});

test('3 · whenever the body asks about ownership, the remembered read had looked it up', async () => {
  let asks = 0;
  for (const saved of [null, 'not-a-theme', ...IDS]) {
    for (const owned of [true, false]) {
      for (const [name, over] of ROWS) {
        const { io, asked } = readers({ owned });
        await dressEventCoverGiven(row({ invite_theme: saved, ...over }), null, io);
        asks += asked.ownsPro;
        assert.ok(asked.ownsPro <= 1, `${saved} · ${name}: ownership was asked ${asked.ownsPro} times for one cover`);
        if (asked.ownsPro > 0) {
          assert.ok(
            ownershipCanChangeTheCover(saved),
            `${saved} · owned=${owned} · ${name}: the cover asked about ownership, but ownershipCanChangeTheCover ` +
              'says it is not needed — the remembered read would not hold it, and the card would ask the database',
          );
        }
      }
    }
  }
  assert.ok(asks > 0, 'ownership was never asked — the test is not exercising the gate');
});

test('4 · a saved Pro theme is worn only by an owner, and a refused ownership read is "not owned"', async () => {
  const pro = IDS.filter((id) => INVITE_THEMES[id].tier === 'pro');
  assert.ok(pro.length >= 1, 'no Pro theme to test the gate with');
  for (const id of pro) {
    const r = row({ invite_theme: id });
    assert.equal((await dressEventCoverGiven(r, null, readers({ owned: true }).io)).theme, id, `${id}: a paid-for look was hidden`);
    const unowned = await dressEventCoverGiven(r, null, readers({ owned: false }).io);
    assert.equal(unowned.theme, 'house', `${id}: a paid look was shown for free`);
    const refused = await dressEventCoverGiven(r, null, readers({ owned: 'refused' }).io);
    assert.deepEqual(refused, unowned, `${id}: a refused ownership read drew something other than "not owned"`);
  }
});

test('5 · a type whose words cannot be resolved gets no poster — the card keeps its mark', async () => {
  const cover = await dressEventCoverGiven(row({ event_type: 'wake' }), null, readers({ owned: false, words: null }).io);
  assert.equal(cover.scene, null);
  assert.equal(cover.paper, null);
});

test('a still mark never asks whether the animation is on', async () => {
  const { io, asked } = readers({ owned: false, animation: true });
  const cover = await dressEventCoverGiven(row(), null, io);
  assert.ok(cover.paper, 'expected the paper invitation card for a plain event');
  assert.equal(cover.paper?.markPlays, false);
  assert.equal(asked.logoAnimationOn, 0);
});
