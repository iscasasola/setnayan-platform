/**
 * "MATEO TURNS SEVEN ARE MARRIED."
 *
 * That is what the story page printed on a seven-year-old's birthday. The owner
 * saw it on his own test event — the fifth time in one session that looking
 * beat measuring.
 *
 * 🔑 NO WORD-COUNT COULD HAVE FOUND IT. The sentence does not exist in any
 * source file: it is ASSEMBLED AT RUNTIME from a template (`${first} Are
 * Married`) and a display name. Every scan I ran searched for wedding words
 * sitting beside event words in the source; this one only becomes wrong when a
 * real event name is substituted in. **A defect can be composed rather than
 * written, and a grep can only find what was written.**
 *
 * So this file asserts the OUTPUT, not the template.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { EditorialData } from './data';

/* ── `server-only` shim ──────────────────────────────────────────────────────
 * `compose.ts` has a RUNTIME import from `./data`, which opens with
 * `import 'server-only'` — a module Next supplies to the BUNDLER that does not
 * exist in node_modules, so a static import here dies with MODULE_NOT_FOUND
 * before one assertion runs. The import is a bundler assertion with no runtime
 * behaviour and is separately guarded textually, so resolving it to an empty
 * module is faithful rather than a shortcut. Same shim and same reasoning as
 * `lib/booking-fee-anchor.test.ts`. Registered at module scope, with the real
 * import dynamic in `before()` — a static one would hoist above this. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_recap__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

let composeCopy: typeof import('./compose').composeCopy;
before(async () => {
  ({ composeCopy } = await import('./compose'));
});

/** The smallest shape `composeCopy` actually reads. */
function story(over: Partial<EditorialData> = {}): EditorialData {
  return {
    eventType: 'wedding',
    displayName: 'Maria & Juan',
    firstNames: 'Maria & Juan',
    eventDate: '2027-01-12',
    eventDateFormatted: 'January 12, 2027',
    venueName: 'Santuario de San Antonio',
    venueCity: 'Makati',
    togetherSince: null,
    loveStory: {},
    draft: {},
    tone: 'warm',
    archetype: { key: 'garden' },
    metrics: { guests: 120 },
    ...over,
  } as unknown as EditorialData;
}

const birthday = () =>
  story({
    eventType: 'birthday',
    displayName: 'Mateo Turns Seven',
    firstNames: 'Mateo Turns Seven',
    venueName: 'Kidzoona SM North',
  });

test('a birthday recap never says anybody is married', () => {
  const c = composeCopy(birthday());
  // 🪤 THIS READ `c.paragraphs`, WHICH DOES NOT EXIST — the field is
  // `leadParagraphs`. `?? []` turned the typo into "nothing to check", so the
  // body of the story was never examined and ungating the closing verb stayed
  // GREEN. Caught by mutation. **A `??` on a misspelt field is a guard that
  // reads nothing and reports success** — the fourth of this shape in one day.
  const everything = [c.headline, c.deck, ...c.leadParagraphs].join(' \n ');
  assert.ok(
    !/marri(ed|age)/i.test(everything),
    `a birthday's story page still announces a marriage:\n${everything}`,
  );
});

test('the exact sentence the owner saw can never come back', () => {
  // Pinned literally. This is the string that reached a real screen.
  assert.notEqual(composeCopy(birthday()).headline, 'Mateo Turns Seven Are Married');
});

test('a birthday announces ITSELF — the name is already the occasion', () => {
  assert.equal(composeCopy(birthday()).headline, 'Mateo Turns Seven');
});

test('🔒 a wedding is byte-identical — it still announces a marriage', () => {
  const c = composeCopy(story());
  assert.equal(c.headline, 'Maria & Juan Are Married');
  assert.match(c.deck, /are married/);
});

test('a missing or legacy event type reads as a wedding', () => {
  // Every other fallback in the guest tree does the same, and it is the only
  // safe direction: production is weddings, and none of them may move.
  assert.equal(composeCopy(story({ eventType: null })).headline, 'Maria & Juan Are Married');
});

test('"After N years together" is a couple\'s framing and stays on weddings', () => {
  const w = composeCopy(story({ togetherSince: '2019-01-01' }));
  assert.match(w.deck, /After .* together/);
  const b = composeCopy({ ...birthday(), togetherSince: '2019-01-01' } as EditorialData);
  assert.ok(!/together/i.test(b.deck), `a birthday counted years together:\n${b.deck}`);
});
