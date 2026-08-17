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
  'pabati-prompt.tsx',
  'selfie-capture.tsx',
  'guest-column-form.tsx',
  'day-of-face-enroll.tsx',
  'live-wall-block.tsx',
];

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
});

test('no consumer went back to a hardcoded "the couple"', () => {
  // The whole point is that these sentences are no longer literals. A revert
  // would typecheck, pass every other test, and read fine on a wedding.
  for (const file of CONSUMERS) {
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
