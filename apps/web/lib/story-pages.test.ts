/**
 * THE PUBLIC STORY'S ARRANGED PAGES — the whole path a stranger's request takes, end to end:
 * read → gate → sign → DRAW, against a stand-in for the admin client.
 *
 * `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 5. `/[slug]` renders with the service role, so
 * RLS is not in this path at all: what keeps a photograph a guest took back off a stranger's
 * screen is `loadStoryArrangement`'s pool (S14), and what keeps the guests' pages off it before
 * publish is its layer rule (S3). These tests fetch as the anonymous reader and read the HTML
 * that would be sent — not the data structure, the MARKUP — because a key that survives into the
 * markup is the leak, whatever the structure says.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { loadStoryPages, type DrawnSheet } from './story-pages';
import { STRANGER, type StoryViewer } from './who-can-see-your-story';

// The house pattern for rendering a component under `tsx --test` (classic JSX runtime) —
// `a-finding-reaches-the-admin.test.ts`. The component is imported after this, on first use.
(globalThis as unknown as { React: unknown }).React = React;

const EVENT = 'e0000000-0000-4000-8000-000000000005';
const P = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const MARCH = 'ros:S89B-MARCH00001';

type Call = { table: string; ops: Array<[string, unknown[]]> };
type Reply = { data: unknown; error: unknown };

/** The house stand-in (`story-arrangement-store.test.ts`): every query recorded, a refusal is data. */
function stub(answer: (c: Call) => Reply) {
  const calls: Call[] = [];
  const api = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'lt', 'order', 'limit', 'not', 'or']) {
        chain[m] = (...args: unknown[]) => {
          call.ops.push([m, args]);
          return chain;
        };
      }
      chain.maybeSingle = async () => {
        const r = answer(call);
        return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: r.error };
      };
      chain.then = (resolve: (v: unknown) => unknown) => resolve(answer(call));
      return chain;
    },
    async rpc() {
      return { data: null, error: { message: 'no rpc on a read' } };
    },
  };
  return { client: api as unknown as SupabaseClient, calls };
}

const has = (c: Call, op: string) => c.ops.some(([m]) => m === op);

function papicRow(n: number, over: Record<string, unknown> = {}) {
  return {
    photo_id: P(n),
    photo_type: 'photo',
    captured_at: `2026-08-20T0${n}:00:00Z`,
    r2_object_key: `papic/original-${n}.jpg`,
    display_r2_key: null,
    thumb_r2_key: null,
    poster_r2_key: null,
    clip_web_r2_key: null,
    full_res_dropped_at: null,
    moderation_state: 'clean',
    ...over,
  };
}

/** The host laid out "The march" by hand: three photos and their words. */
const HAND = {
  shape: 1,
  mode: 'hand',
  handTouched: true,
  moments: [
    {
      id: MARCH,
      objects: [
        { id: 'photo:a', kind: 'photo', ref: P(1), x: 20, y: 16, w: 146, h: 100 },
        { id: 'photo:b', kind: 'photo', ref: P(2), x: 178, y: 16, w: 146, h: 100 },
        { id: 'photo:c', kind: 'photo', ref: P(3), x: 336, y: 16, w: 146, h: 100 },
        {
          id: 'words:a',
          kind: 'words',
          text: 'She came down the path\nand the rain stopped.',
          x: 190,
          y: 150,
          size: 23,
          color: 'terracotta',
          backing: true,
          turn: -4,
        },
      ],
    },
  ],
  sets: [],
};

/**
 * A celebration where the guest tagged in P2 took their photograph back (S14), and where no
 * blurred copy was baked — so P2 must reach NO page, by any name.
 */
function world(opts: { status?: string; arrangement?: unknown; bakedFor?: string[] } = {}) {
  return (c: Call): Reply => {
    if (c.table === 'guests') return { data: [{ guest_id: 'g-out' }], error: null };
    if (c.table === 'photo_tags') return { data: [{ source_id: P(2) }], error: null };
    if (c.table === 'papic_photos') {
      if (has(c, 'or')) {
        return {
          data: (opts.bakedFor ?? []).map((id) => ({ photo_id: id, safe_display_r2_key: `safe/${id}.jpg` })),
          error: null,
        };
      }
      return { data: [papicRow(1), papicRow(2), papicRow(3)], error: null };
    }
    if (c.table === 'event_editorial') {
      return {
        data: {
          status: opts.status ?? 'published',
          arrangement: opts.arrangement === undefined ? HAND : opts.arrangement,
          arrangement_version: 4,
        },
        error: null,
      };
    }
    if (c.table === 'events') return { data: { event_date: '2026-08-20', event_end_date: null }, error: null };
    if (c.table === 'event_schedule_blocks') {
      return {
        data: [{ public_id: 'S89B-MARCH00001', label: 'The march', start_at: '2026-08-20T08:00:00+00:00', sort_order: 1 }],
        error: null,
      };
    }
    return { data: null, error: null };
  };
}

/** A signer that makes the key visible in the address, so a leaked key is a leaked string. */
const sign = async (key: string) => `https://media.example/signed/${encodeURIComponent(key)}?sig=1`;

async function html(sheets: DrawnSheet[]): Promise<string> {
  const { ArrangedSheet } = await import('@/app/[slug]/_components/story/arranged-sheet');
  return sheets
    .map((s) => renderToStaticMarkup(React.createElement(ArrangedSheet, { sheet: s, names: 'Ana & Miguel', label: 'x' })))
    .join('\n');
}

async function asStranger(opts: Parameters<typeof world>[0] = {}, viewer: StoryViewer = STRANGER) {
  const { client, calls } = stub(world(opts));
  const sheets = await loadStoryPages(client, EVENT, viewer, sign);
  return { sheets, markup: await html(sheets), calls };
}

/* ── S14 — a photograph a guest took back ───────────────────────────────── */

test('S14 — the anonymous reader\'s HTML carries NO trace of a photo a guest took back', async () => {
  const { sheets, markup } = await asStranger();
  assert.equal(sheets.length, 1, 'the hand-arranged moment should draw');
  const refs = sheets[0]!.objects.flatMap((o) => (o.kind === 'words' ? [] : [o.ref]));
  assert.deepEqual(refs, [P(1), P(3)]);

  // Every name the photograph goes by: its id, its stored key, its signed address.
  for (const needle of [P(2), 'original-2', encodeURIComponent('papic/original-2.jpg')]) {
    assert.equal(markup.includes(needle), false, `the taken-back photo reached the HTML as "${needle}"`);
  }
  // …and the ones that stayed are really drawn, so the absence above is not an empty page.
  assert.ok(markup.includes(encodeURIComponent('papic/original-1.jpg')));
  assert.ok(markup.includes(encodeURIComponent('papic/original-3.jpg')));
});

test('S14 — where a blurred copy was baked, the page draws the BLURRED copy, never the original', async () => {
  const { markup } = await asStranger({ bakedFor: [P(2)] });
  assert.ok(markup.includes(encodeURIComponent(`safe/${P(2)}.jpg`)), 'the blurred copy should be drawn');
  assert.equal(markup.includes('original-2'), false, 'the unblurred original reached the HTML');
});

/* ── S3 — the guests' layer before publish ──────────────────────────────── */

test('S3 — before publish a stranger gets no pages, and not one capture is even fetched', async () => {
  const { sheets, markup, calls } = await asStranger({ status: 'draft' });
  assert.deepEqual(sheets, []);
  assert.equal(markup, '');
  assert.equal(
    calls.some((c) => c.table === 'papic_photos'),
    false,
    'a reader the guests\' layer refuses must not cause a capture read at all',
  );
});

test('S3 — before publish the host still sees their own pages', async () => {
  const host: StoryViewer = { ...STRANGER, isHost: true };
  const { sheets } = await asStranger({ status: 'draft' }, host);
  assert.equal(sheets.length, 1);
});

/* ── Automatic is exactly as today ──────────────────────────────────────── */

test('Automatic — no sheet at all, so the public story is what it was before', async () => {
  const { sheets } = await asStranger({ arrangement: { ...HAND, mode: 'auto' } });
  assert.deepEqual(sheets, []);
});

test('nobody arranged anything — no sheet', async () => {
  const { sheets } = await asStranger({ arrangement: null });
  assert.deepEqual(sheets, []);
});

/* ── read-only, and the host's look ─────────────────────────────────────── */

test('the page is read-only: no ×, no handle, no editable words, no control of any kind', async () => {
  const { markup } = await asStranger();
  assert.equal(/<button/i.test(markup), false, 'a button reached a photos-and-words sheet');
  assert.equal(/contenteditable/i.test(markup), false);
  assert.equal(/tabindex/i.test(markup), false);
  assert.equal(markup.includes('×'), false);
});

test('words render as the host set them — text, colour, backing, size, turn', async () => {
  const { markup } = await asStranger();
  assert.ok(markup.includes('She came down the path\nand the rain stopped.'), 'the words, line break kept');
  assert.ok(markup.includes('background:#C24E25'), 'terracotta, as a backing');
  assert.ok(markup.includes('rotate(-4deg)'), 'the turn');
  assert.ok(/font:400 calc\(var\(--sn-u\) \* 23\)/.test(markup), 'the size, in sheet units');
});

test('every length on the sheet is in SHEET UNITS — the composition cannot change with the screen', async () => {
  const { markup } = await asStranger();
  // Any px length outside a shadow would be a piece of the page that does not scale with it. The
  // one allowed is the CAP — the sheet is never drawn wider than the host's own 660.
  const styles = [...markup.matchAll(/style="([^"]*)"/g)].map((m) =>
    m[1]!.replace(/box-shadow:[^;]*;?/g, '').replace(/^container-type:inline-size;width:100%;max-width:660px$/, ''),
  );
  const px = styles.filter((s) => /\d+(\.\d+)?px/.test(s));
  assert.deepEqual(px, [], `pixel lengths on the sheet: ${px.join(' | ')}`);
  for (const prop of ['left', 'top', 'width', 'height']) {
    const values = [...markup.matchAll(new RegExp(`[;"]${prop}:([^;"]*)`, 'g'))].map((m) => m[1]!);
    assert.ok(values.length > 0, `no ${prop} at all`);
    for (const v of values) {
      assert.ok(
        v.includes('var(--sn-u)') || v === '100%',
        `${prop}:${v} is not in sheet units`,
      );
    }
  }
});
