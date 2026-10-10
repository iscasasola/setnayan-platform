/**
 * 🧾 NOTHING STORED = TODAY'S PAGE, BYTE FOR BYTE — the note a guest sees after a Yes and after a No.
 *
 * The Maker's RSVP stage lets a couple add a line to the When-yes and When-no notes, reorder their lines and group
 * them (owner's ruling 2026-10-09). `invite/enter/page.tsx` is a page — it reads the database — so no test can render
 * it. What CAN be held:
 *
 *   1. `note-as-shipped.fixture.tsx` is the page's own JSX for the two notes, copied by a script from the page at
 *      `origin/main` 64746f064. THIS TEST PROVES THE COPY: the page's source still carries both blocks, character
 *      for character (indentation aside). [Held in the commit that recorded the record — the page was untouched
 *      there; once the page draws the note from a list the block is gone from it, and § 1 becomes § 3.]
 *   2. `the-note-after-a-reply-is-todays-page.golden.json` is that JSX RENDERED, for every case that changes what it
 *      holds: a Yes / a No × a guest / the Maker's sample × the couple's own message or none × their own heading.
 *      The reference still renders to it (so the reference cannot drift).
 *
 * TO RECORD AGAIN (only when the note is MEANT to change for every guest — say so in the commit):
 *   RECORD_NOTE=1 ../../node_modules/.bin/tsx --test "app/[[]slug[]]/invite/enter/the-note-after-a-reply-is-todays-page.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

const h = React.createElement;
const HERE = __dirname;
const GOLDEN = join(HERE, 'the-note-after-a-reply-is-todays-page.golden.json');

type Props = { reply: 'yes' | 'no'; canvas: boolean; wordKeys: { heading: string; message: string } | null; headline: string; ownHeadline: string; ownMessage: string | null; firstName: string };

/** Every case, by name — the page's own variables, as the page would hold them. */
export function noteCases(): Array<[string, Props]> {
  const out: Array<[string, Props]> = [];
  for (const reply of ['yes', 'no'] as const) {
    const ownHeadline = reply === 'yes' ? 'You replied — see you there' : 'We’ll miss you.';
    const keys = reply === 'yes' ? { heading: 'thanksHeading', message: 'thanksMessage' } : { heading: 'declineHeading', message: 'declineMessage' };
    for (const canvas of [false, true]) {
      for (const [said, ownMessage] of [['no message of their own', null], ['their own message', 'We cannot wait — bring your dancing shoes & a jacket.']] as const) {
        for (const [whose, headline] of [['the page’s heading', ownHeadline], ['their own heading', 'Salamat, Ana <3']] as const) {
          out.push([`after a ${reply} · ${canvas ? 'the Maker’s sample' : 'a guest'} · ${said} · ${whose}`, { reply, canvas, wordKeys: keys, headline, ownHeadline, ownMessage, firstName: 'Ana' }]);
        }
      }
    }
    /* A reply whose words the Maker cannot type (the page's `wordKeys` is null): the sample is drawn as a guest's. */
    out.push([`after a ${reply} · the Maker’s sample · no words to type`, { reply, canvas: true, wordKeys: null, headline: ownHeadline, ownHeadline, ownMessage: null, firstName: 'Ana' }]);
  }
  return out;
}

async function asShipped(props: Props): Promise<string> {
  const { NoteAsShipped } = await import('./note-as-shipped.fixture');
  return renderToStaticMarkup(h(NoteAsShipped as never, props as never));
}

const dedent = (text: string) => {
  const lines = text.split('\n');
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length));
  return lines.map((l) => l.slice(pad)).join('\n');
};

test('1 · the reference IS the page’s own JSX — both notes, character for character', () => {
  const page = readFileSync(join(HERE, 'page.tsx'), 'utf8');
  const fixture = readFileSync(join(HERE, 'note-as-shipped.fixture.tsx'), 'utf8');
  const blocks = [...fixture.matchAll(/\/\* ── verbatim: the (No|Yes) branch ── \*\/\n([\s\S]*?)\n\/\* ── end ── \*\//g)];
  assert.deepEqual(blocks.map((b) => b[1]), ['No', 'Yes']);
  const pageLines = page.split('\n');
  for (const [, name, body] of blocks) {
    const want = dedent(body!);
    const first = want.split('\n')[0]!;
    const n = want.split('\n').length;
    const at = pageLines.findIndex((l, i) => l.trim() === first.trim() && dedent(pageLines.slice(i, i + n).join('\n')) === want);
    assert.ok(at >= 0, `the page no longer carries the ${name} note as the reference has it`);
  }
});

test('2 · the reference renders to the record', async () => {
  const cases = noteCases();
  assert.equal(new Set(cases.map(([n]) => n)).size, cases.length, 'two cases share a name');
  const now: Record<string, string> = {};
  for (const [name, props] of cases) now[name] = await asShipped(props);
  if (process.env.RECORD_NOTE === '1') {
    writeFileSync(
      GOLDEN,
      `${JSON.stringify(
        {
          _about:
            'RECORDED 2026-10-10 from the note after a reply AS invite/enter/page.tsx DREW IT at origin/main 64746f064 (its own JSX, copied verbatim into note-as-shipped.fixture.tsx — the-note-after-a-reply-is-todays-page.test.ts § 1 proved the copy against the page in the commit that recorded this), BEFORE its lines were drawn from a list (the RSVP stage’s ＋, drag and Group). Each case is the note’s whole HTML (react-dom/server renderToStaticMarkup). Record again ONLY when the note is meant to change for every guest.',
          cases: now,
        },
        null,
        1,
      )}\n`,
    );
    console.log(`# recorded ${cases.length} cases`);
    return;
  }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as { cases: Record<string, string> };
  assert.deepEqual(Object.keys(now), Object.keys(golden.cases), 'the cases are not the record’s cases');
  for (const [name] of cases) assert.equal(now[name], golden.cases[name], name);
  /* The record is of notes that HAVE their lines, and of a guest's page that carries nothing of the Maker's. */
  const guestNo = golden.cases['after a no · a guest · no message of their own · the page’s heading']!;
  assert.match(guestNo, /data-landing-missed=""/);
  assert.match(guestNo, /data-rsvp-line="heading"[^>]*>We’ll miss you\.<\/p>/);
  assert.doesNotMatch(guestNo, /data-rsvp-word|data-rsvp-default|data-rsvp-name/);
  const guestYes = golden.cases['after a yes · a guest · their own message · their own heading']!;
  assert.match(guestYes, /data-rsvp-line="heading">✓ <span data-landing-heading="">Salamat, Ana &lt;3<\/span>/);
  assert.match(guestYes, /data-rsvp-line="message">We cannot wait — bring your dancing shoes &amp; a jacket\.<\/p>/);
});
