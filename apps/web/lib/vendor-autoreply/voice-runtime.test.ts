import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { voicedReplyText } from './voice-runtime';

/**
 * THE REACHABLE GATE.
 *
 * `voice-serve.test.ts` exercises the pure decision function, and it passes
 * `flagEnabled` in by hand. Production could not produce `flagEnabled:false`
 * there — `voice-runtime.ts` used to hardcode `true` — so every one of those
 * flag-off assertions was pinning an unreachable value, and deleting the REAL
 * gate changed the suite result by exactly nothing.
 *
 * These tests run the real `voicedReplyText`, with the real env flag, against a
 * stub client that COUNTS queries. The flag-off invariant asserted here is the
 * one that matters and the only one that can be falsified:
 *
 *   flag off ⇒ the neutral text is returned `===`, AND ZERO queries are issued.
 *
 * The query count is deliberate. "Returns the neutral text" alone would still
 * pass if the gate were deleted (the pure function's own `flagEnabled` branch
 * would catch it), so it would not pin the early return that gives flag-off its
 * byte-identical query plan. Zero-queries does.
 */

const VOICE_KEY = 'NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH';
const LADDER_KEY = 'NEXT_PUBLIC_VENDOR_AI_LADDER';
const NEUTRAL = 'Our Full-Day Coverage starts at ₱48,000 (covers 8 hrs).';

async function withEnv(
  env: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

type StubRows = {
  level?: string | null;
  mode?: string | null;
  phrasings?: unknown;
  /** When set, every query rejects — the "voice failure never costs the answer" path. */
  throws?: boolean;
};

/**
 * A rejected promise that is already "handled", so the two siblings
 * `Promise.all` discards do not surface as an unhandledRejection and fail the
 * run for the wrong reason. Awaiting it still rejects.
 */
function rejected(): Promise<never> {
  const p = Promise.reject(new Error('boom'));
  p.catch(() => {});
  return p;
}

/** A Supabase stand-in that records every table it is asked for. */
function stubAdmin(rows: StubRows) {
  const tables: string[] = [];
  const builder = (table: string) => {
    const result =
      table === 'vendor_profiles'
        ? { data: { ai_addon_level: rows.level ?? null } }
        : table === 'vendor_bot_config'
          ? { data: { mode: rows.mode ?? null } }
          : { data: [{ phrasings: rows.phrasings ?? null, generated_at: '2026-07-26' }] };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) {
      chain[m] = () => (rows.throws ? rejected() : chain);
    }
    chain.maybeSingle = () => (rows.throws ? rejected() : Promise.resolve(result));
    // `limit()` terminates the templates query, so the chain itself must be
    // awaitable — that is how the production call reads it.
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  };
  const admin = {
    from(table: string) {
      tables.push(table);
      return builder(table);
    },
  } as unknown as SupabaseClient;
  return { admin, tables };
}

function input(over: Partial<Parameters<typeof voicedReplyText>[0]> = {}) {
  return {
    admin: stubAdmin({}).admin,
    vendorProfileId: 'S89V-VENDOR0001',
    addonActive: true,
    intent: 'price',
    neutralText: NEUTRAL,
    rotationKey: 'thread-1:0',
    ...over,
  };
}

// ── 1. THE flag-off invariant, on the reachable path ────────────────────────

test('FLAG OFF (unset) → neutral text, and ZERO queries are issued', async () => {
  await withEnv({ [VOICE_KEY]: undefined, [LADDER_KEY]: '1' }, async () => {
    const { admin, tables } = stubAdmin({ level: 'advanced', mode: 'smart', phrasings: ['Hi po! {{answer}}'] });
    const res = await voicedReplyText(input({ admin }));
    assert.equal(res.text, NEUTRAL);
    assert.equal(res.voiced, false);
    assert.equal(res.reason, 'flag_off');
    assert.deepEqual(tables, [], 'flag-off must not name a single voice column');
  });
});

test('FLAG OFF for every falsy value, with every other input fully "on"', async () => {
  for (const v of [undefined, 'false', '0', '', 'yes']) {
    await withEnv({ [VOICE_KEY]: v, [LADDER_KEY]: '1' }, async () => {
      const { admin, tables } = stubAdmin({ level: 'advanced', mode: 'smart', phrasings: ['Hi! {{answer}}'] });
      const res = await voicedReplyText(input({ admin }));
      assert.equal(res.text, NEUTRAL, String(v));
      assert.equal(res.reason, 'flag_off', String(v));
      assert.equal(tables.length, 0, String(v));
    });
  }
});

test('the LADDER flag off also costs zero queries (42703 footgun stays closed)', async () => {
  await withEnv({ [VOICE_KEY]: '1', [LADDER_KEY]: undefined }, async () => {
    const { admin, tables } = stubAdmin({ level: 'advanced', mode: 'smart', phrasings: ['Hi! {{answer}}'] });
    const res = await voicedReplyText(input({ admin }));
    assert.equal(res.text, NEUTRAL);
    assert.equal(res.reason, 'not_advanced');
    assert.deepEqual(tables, []);
  });
});

// ── 2. flag ON — the feature actually works, and only for the entitled ──────

test('BOTH flags on + advanced + live window + smart + phrasings → VOICED', async () => {
  await withEnv({ [VOICE_KEY]: '1', [LADDER_KEY]: '1' }, async () => {
    const { admin, tables } = stubAdmin({
      level: 'advanced',
      mode: 'smart',
      phrasings: ['Kumusta po! {{answer}} Salamat po.'],
    });
    const res = await voicedReplyText(input({ admin }));
    assert.equal(res.voiced, true);
    assert.equal(res.reason, 'voiced');
    assert.ok(res.text.includes(NEUTRAL), 'the deterministic answer is never rewritten');
    assert.deepEqual(
      [...tables].sort(),
      ['vendor_bot_config', 'vendor_profiles', 'vendor_reply_templates'],
    );
  });
});

test('flags on but the level is BASIC → neutral (mode="smart" cannot self-grant)', async () => {
  await withEnv({ [VOICE_KEY]: '1', [LADDER_KEY]: '1' }, async () => {
    const { admin } = stubAdmin({ level: 'basic', mode: 'smart', phrasings: ['Hi! {{answer}}'] });
    const res = await voicedReplyText(input({ admin }));
    assert.equal(res.voiced, false);
    assert.equal(res.text, NEUTRAL);
    assert.equal(res.reason, 'not_advanced');
  });
});

test('flags on, advanced level, but the WINDOW has lapsed → neutral', async () => {
  await withEnv({ [VOICE_KEY]: '1', [LADDER_KEY]: '1' }, async () => {
    const { admin } = stubAdmin({ level: 'advanced', mode: 'smart', phrasings: ['Hi! {{answer}}'] });
    const res = await voicedReplyText(input({ admin, addonActive: false }));
    assert.equal(res.voiced, false);
    assert.equal(res.reason, 'not_advanced');
  });
});

test('a query failure degrades to the neutral answer, never to silence', async () => {
  await withEnv({ [VOICE_KEY]: '1', [LADDER_KEY]: '1' }, async () => {
    const { admin } = stubAdmin({ throws: true });
    const res = await voicedReplyText(input({ admin }));
    assert.equal(res.text, NEUTRAL);
    assert.equal(res.voiced, false);
  });
});

// ── 3. the off-platform-contact lock survives the whole serving path ────────

test('a stored envelope carrying an off-platform contact is NOT served', async () => {
  await withEnv({ [VOICE_KEY]: '1', [LADDER_KEY]: '1' }, async () => {
    const { admin } = stubAdmin({
      level: 'advanced',
      mode: 'smart',
      phrasings: ['Hi po! {{answer}} Add us on Viber.'],
    });
    const res = await voicedReplyText(input({ admin }));
    assert.equal(res.voiced, false);
    assert.equal(res.text, NEUTRAL);
  });
});
