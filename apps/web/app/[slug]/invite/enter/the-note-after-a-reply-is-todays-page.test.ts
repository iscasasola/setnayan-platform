/**
 * 🧾 NOTHING STORED = TODAY'S PAGE, BYTE FOR BYTE — the note a guest sees after a Yes and after a No.
 *
 * The Maker's RSVP stage lets a couple add a line to the When-yes and When-no notes, reorder their lines and group
 * them (owner's ruling 2026-10-09). `invite/enter/page.tsx` is a page — it reads the database — so no test can render
 * it. What CAN be held:
 *
 *   1. `note-as-shipped.fixture.tsx` is the page's own JSX for the two notes, copied by a script from the page at
 *      `origin/main` 64746f064. The copy was PROVED against the page — both blocks, character for character,
 *      indentation aside — in the commit that recorded the record, where the page still carried them (this file's
 *      § 1 as it stood in that commit). The page now draws the note through `RsvpNoteLines`; § 1 holds that it does.
 *   2. `the-note-after-a-reply-is-todays-page.golden.json` is that JSX RENDERED, for every case that changes what it
 *      holds: a Yes / a No × a guest / the Maker's sample × the couple's own message or none × their own heading.
 *      The reference still renders to it (so the reference cannot drift).
 *   3. THE NOTE AS THE PAGE DRAWS IT NOW (`RsvpNoteLines`, no list) renders to the same record, to the byte.
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

async function asDrawnNow(props: Props): Promise<string> {
  const { RsvpNoteLines } = await import('../../_components/rsvp-note-lines');
  return renderToStaticMarkup(h(RsvpNoteLines as never, props as never));
}

test('1 · the page draws the note through the one component — and hands it the list from the config it already holds', () => {
  /* (Until the note was drawn from a list this section proved the reference against the page's own JSX, character
     for character — in the commit that recorded the record, where the page still carried it. The page's two blocks
     are now `RsvpNoteLines`; what is held from here on is § 2 and § 3.) */
  const page = readFileSync(join(HERE, 'page.tsx'), 'utf8');
  assert.match(
    page,
    /<RsvpNoteLines\s+reply=\{reply === 'no' \? 'no' : 'yes'\}\s+canvas=\{canvas\}\s+wordKeys=\{wordKeys\}\s+headline=\{headline\}\s+ownHeadline=\{ownHeadline\}\s+ownMessage=\{ownMessage\}\s+firstName=\{firstName\}\s+lines=\{rsvpScreenLayout\(readRsvpLook\(event\.rsvp_ask_config\), reply === 'no' \? 'nonote' : 'yesnote'\)\}\s+\/>/,
  );
  /* The note's lines are drawn nowhere else on the page. */
  assert.doesNotMatch(page, /data-landing-missed|data-landing-done|data-thank-you-message/);
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

test('3 · the note the page draws NOW is the record, to the byte, when the couple arranged nothing', async () => {
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as { cases: Record<string, string> };
  for (const [name, props] of noteCases()) {
    assert.equal(await asDrawnNow(props), golden.cases[name], name);
    assert.equal(await asDrawnNow({ ...props, lines: null } as never), golden.cases[name], `${name} (lines: null)`);
  }
});
