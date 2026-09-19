/**
 * THE PROVIDER IS ACTUALLY MOUNTED, AND THE SILENT FALLBACK CANNOT HIDE.
 *
 * ── THE RISK THIS EXISTS FOR ────────────────────────────────────────────────
 * The client half of the guest tree reads the organiser noun from a React
 * context, and a consumer with no provider above it falls back to
 * `WORDS_AS_SHIPPED` — literally "the couple".
 *
 * That fallback is the right call (the alternative would make every real
 * couple's live invitation say "the host" the moment the provider went
 * missing), but it has a cost: **a missing provider is invisible on a
 * wedding, and every launched production event is a wedding.** The wiring
 * could be deleted tomorrow and nothing anyone can see would change — until a
 * birthday launched, months from now, reading like somebody's wedding.
 *
 * 🔑 A SILENT FALLBACK IS ONLY ACCEPTABLE WHEN SOMETHING ELSE IS WATCHING.
 * This file is that something. It is not testing React — it is testing that
 * the wiring exists at all, which is the part no runtime check would catch.
 *
 * Run from inside this directory: `npx tsx --test ./event-words-mounted.test.ts`
 * 🪤 With a bracketed path it prints "# tests 0" and exits GREEN.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WORDS_AS_SHIPPED } from '../_components/event-words-provider';
import { eventWordsFromProfile } from './event-words';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';

const COMPONENTS = resolve(dirname(fileURLToPath(import.meta.url)), '../_components');
const read = (f: string) => readFileSync(join(COMPONENTS, f), 'utf8');
const BODY = read('site-body.tsx');

/** Every client surface that reads the noun from context. */
const CONSUMERS = [
  'countdown.tsx',
  'selfie-capture.tsx',
  'guest-column-form.tsx',
  'day-of-face-enroll.tsx',
  'live-wall-block.tsx',
];

/**
 * The guest-page-borrowed surfaces — `VendorDoorway` and `SupplierDesk`. They
 * do NOT call `useEventWords()`: `site-body.tsx` resolves `clientWords` from
 * the event type ONCE, server-side, and hands it to them as a typed
 * `words: ClientEventWords` prop — the same value the provider is mounted
 * with, threaded a second way. So the missing-provider fallback test above
 * does not apply to them (there is no context read to fall back from), but
 * the hardcoded-noun regression it guards against does: SUP-49.
 */
const PROP_CONSUMERS = ['vendor-doorway.tsx', 'supplier-desk.tsx'];

test('the provider is mounted, and above BOTH identity trees', () => {
  assert.ok(
    BODY.includes('<EventWordsProvider'),
    'nothing mounts the provider — every client surface silently falls back to ' +
      '"the couple", which is invisible on a wedding and wrong on everything else',
  );
  // Above both trees means: BEFORE the identity fork, so the guest tree and the
  // anonymous tree are both inside it. If it moved into one, the other would
  // keep saying "the couple" at a graduation — and the two have drifted before.
  //
  // ⚠ It sits INSIDE <InvitationShell>, deliberately. Wrapping the shell broke
  // `doorways-before-the-day.test.ts`, which anchors on the exact text
  // `return (\n    <InvitationShell` — it reported "the shell return moved,
  // this scan is now blind", which was correct, so the mount moved instead.
  const open = BODY.indexOf('<EventWordsProvider');
  const fork = BODY.indexOf("identity.kind === 'anonymous' ? anonymousTree(identity)");
  assert.ok(fork > 0, 'the identity fork moved — this scan is now blind');
  assert.ok(
    open > 0 && open < fork,
    'the provider no longer wraps both identity trees — one of them will keep ' +
      'the wedding wording on every other kind of event',
  );
  assert.ok(
    BODY.includes('  return (\n    <InvitationShell'),
    'the provider was wrapped around the shell again — that blinds the doorway ' +
      'strip guard, which anchors on this exact text. Mount it INSIDE the shell.',
  );
});

test('the words handed to the provider are resolved from the event type', () => {
  assert.match(
    BODY,
    /const clientWords = await eventWordsFor\(event\.event_type\)/,
    'the provider is being handed something other than the resolved per-type ' +
      'words — a hardcoded object here would defeat the whole mechanism',
  );
  assert.match(BODY, /<EventWordsProvider words=\{clientWords\}>/);
});

test('every consumer handles a missing provider instead of crashing a guest', () => {
  for (const file of CONSUMERS) {
    const src = read(file);
    assert.match(
      src,
      /useEventWords\(\) \?\? WORDS_AS_SHIPPED/,
      `${file} reads the context without a fallback. A guest's invitation must ` +
        `never crash over a noun.`,
    );
  }
});

test('the fallback is byte-identical to what a wedding reads', () => {
  // If these drift, the fallback stops being "what shipped" and starts being a
  // second opinion about a wedding — two vocabularies again.
  const wedding = eventWordsFromProfile(WEDDING_PROFILE);
  assert.equal(WORDS_AS_SHIPPED.theOrganizer, wedding.theOrganizer);
  assert.equal(WORDS_AS_SHIPPED.TheOrganizer, wedding.TheOrganizer);
  assert.equal(WORDS_AS_SHIPPED.theOrganizerPossessive, wedding.theOrganizerPossessive);
  // And pinned literally, so a change to the wedding profile cannot silently
  // move both sides together and keep this green.
  assert.equal(WORDS_AS_SHIPPED.theOrganizer, 'the couple');
  assert.equal(WORDS_AS_SHIPPED.theOrganizerPossessive, 'the couple’s');
  assert.equal(WORDS_AS_SHIPPED.eventWord, 'wedding');
});

test('the countdown label is a WEDDING VOW and only a wedding gets it', () => {
  // 🔴 "Until we say 'I do'" was rendering on a seven-year-old's birthday and on
  // a graduation. It was seen on the real page, not caught by any scan — it
  // contains none of the words a wedding-word search looks for.
  const src = readFileSync(join(COMPONENTS, 'countdown.tsx'), 'utf8');
  assert.match(
    src,
    /w\.eventWord === 'wedding'/,
    'the countdown no longer asks whether this is a wedding before promising vows',
  );
  assert.ok(
    src.includes('Until the day'),
    'the countdown has no non-wedding label',
  );
});

test('no consumer went back to a hardcoded "the couple"', () => {
  // The whole point is that these sentences are no longer literals. A revert
  // would typecheck, pass every other test, and read fine on a wedding.
  // Covers both wiring shapes: the hook consumers AND the two guest-page-
  // borrowed surfaces that get the same words via a prop instead (SUP-49) —
  // a hardcoded "the couple" is the same defect either way it got there.
  for (const file of [...CONSUMERS, ...PROP_CONSUMERS]) {
    const src = read(file)
      // strip comments — several of these files EXPLAIN the change, and prose
      // about the defect must not read as the defect
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, '');
    const hits = src.match(/\bthe couple\b/gi) ?? [];
    assert.equal(
      hits.length,
      0,
      `${file} has ${hits.length} hardcoded "the couple" back in its rendered ` +
        `text: ${hits.join(', ')}`,
    );
  }
});

test('the guest-page-borrowed surfaces take the resolved words as a prop, not a literal', () => {
  // These two are rendered from site-body.tsx BEFORE the identity fork, off
  // the same `clientWords` the provider is mounted with — so proving the prop
  // is typed `ClientEventWords` and actually used downstream (not merely
  // accepted and dropped) is what stands in for the hook-fallback check above.
  for (const file of PROP_CONSUMERS) {
    const src = read(file);
    assert.match(
      src,
      /words:\s*ClientEventWords/,
      `${file} no longer declares a typed words prop — SUP-49's coverage gap ` +
        'would reopen if it silently went back to a hardcoded noun',
    );
  }
  // vendor-doorway.tsx only FORWARDS the prop, to the desk it renders — the
  // actual sentence lives in supplier-desk.tsx, which must read it.
  assert.match(
    read('vendor-doorway.tsx'),
    /<SupplierDesk\s+desk=\{desk\}\s+words=\{words\}\s*\/>/,
    'vendor-doorway.tsx no longer forwards the words it was handed to the desk',
  );
  assert.match(
    read('supplier-desk.tsx'),
    /\bwords\.(theOrganizer|TheOrganizer|theOrganizerPossessive|eventWord|occasion|twoPeople|solemn)\b/,
    'supplier-desk.tsx accepts the words prop but never reads it',
  );
});
