/**
 * 🗣 A MOMENT SHOWS ONLY THE VOICES THAT WROTE — owner 2026-10-17 (DECISION_LOG "APPROVED — LOVE STORY, TWO
 * VOICES"; prototype `love_story_two_voices_2026-10-17.html`), verbatim: *"has both a his and her side. it is like he
 * said she said style"* → *"Approved — build the two-voices Love Story: Conversation as the default look, Timeline and
 * Swipe cards as Pro looks in Style."*
 *
 * The one rule every reader keeps: a moment's voices are slot-keyed (a = the first partner, b = the second, in the
 * order `loveStoryPartners` gives); ONLY the voices that were written are drawn, each under its own partner's name;
 * a moment nobody wrote a voice for reads its line told together, unchanged. Held here for:
 *   · the reading (`readMoment` keeps a voice with no line; a moment with nothing is still dropped);
 *   · the writing (`momentFromForm` — voice_a / voice_b; one of line · a · b is required; a form without the line
 *     keeps it, so writing a voice never blanks it; a form without a voice keeps that voice);
 *   · EVERY look the scene draws (Conversation · Two-lane timeline · Swipe cards · Chapters · The years) and the
 *     printed Our Story poster;
 *   · "Added by" hiding once both voices are written.
 *
 * 🪤 Same harness as the neighbouring render tests: `globalThis.React` before the DYNAMIC imports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  loveStoryPartners,
  momentHasBothVoices,
  momentReadLine,
  momentVoiceLines,
  printStoryChapters,
  readMoment,
  resolveMoments,
} from './love-story-moments';
import { MOMENT_NEEDS, applyMomentIntent } from './love-story-moment-intent';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const PARTNERS = ['Maria', 'Jose'] as const;
const BOTH = { a: 'Her side of the umbrella.', b: 'His side of the umbrella.' };
const STORY = {
  moments: [
    { id: 'both', date: { y: 2019 }, title: 'Both wrote', line: 'Told together, never shown here.', voices: BOTH, order: 0, canvas: {} },
    { id: 'one', date: { y: 2020 }, title: 'Only the second wrote', line: '', voices: { b: 'Only Jose wrote this.' }, order: 1, canvas: {} },
    { id: 'none', date: { y: 2021 }, title: 'Neither wrote', line: 'The line told together.', order: 2, canvas: {} },
  ],
};

const form = (pairs: Array<[string, string]>) => {
  const fd = new FormData();
  for (const [k, v] of pairs) fd.append(k, v);
  return fd;
};

/** Each `<article data-love-scene="id">`'s own markup. */
function articles(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<article[^>]*data-love-scene="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g;
  for (const m of html.matchAll(re)) out[m[1]!] = m[2]!;
  return out;
}

test('the partners are the Maker’s "Added by" order, and a voice is named by its slot', () => {
  assert.deepEqual(loveStoryPartners('Maria & Jose', 'wedding'), ['Maria', 'Jose']);
  assert.deepEqual(loveStoryPartners('Maria', 'debut'), ['Maria']);
  assert.deepEqual(loveStoryPartners('', 'wedding'), []);
  assert.deepEqual(
    momentVoiceLines({ voices: { b: 'second' } }, PARTNERS),
    [{ slot: 'b', name: 'Jose', words: 'second' }],
    'only the voice that wrote, under its own name — never moved into slot a',
  );
  assert.deepEqual(momentVoiceLines({ voices: null }, PARTNERS), []);
  assert.equal(momentReadLine({ voices: null, line: 'together' }, PARTNERS), 'together', 'no voice → the line');
  assert.equal(momentReadLine({ voices: BOTH, line: 'together' }, PARTNERS, ' · '), 'Maria: Her side of the umbrella. · Jose: His side of the umbrella.');
});

test('reading: a voice alone is a moment; nothing at all is not', () => {
  const m = readMoment({ id: 'v', date: { y: 2020 }, voices: { a: '  only her  ' }, canvas: {} });
  assert.ok(m, 'a moment with a voice and no line is kept');
  assert.deepEqual(m!.voices, { a: 'only her' });
  assert.equal(m!.line, '');
  assert.equal(readMoment({ id: 'x', date: { y: 2020 }, voices: { a: '   ' }, canvas: {} }), null, 'an empty voice is no words');
  const long = readMoment({ id: 'l', line: 'x', voices: { a: 'y'.repeat(900) }, canvas: {} });
  assert.equal(long!.voices!.a!.length, 600, 'a voice is at most 600 characters');
  const legacy = readMoment({ id: 'old', line: 'We met at a wedding.', canvas: {} });
  assert.equal(legacy!.voices, undefined, 'a moment written before the voices has none — it reads exactly as before');
});

test('writing: voice_a / voice_b; one of three is required; the line is never blanked by a voice', () => {
  const before = resolveMoments(STORY);
  const added = applyMomentIntent(before, 'add', form([['date_y', '2024'], ['voice_a', 'Mine.'], ['voice_b', '']]), () => 0.3);
  assert.ok(added.ok && added.touched);
  assert.deepEqual(added.touched!.voices, { a: 'Mine.' }, 'an empty field is no voice');
  assert.equal(added.touched!.line, '', 'a new moment has no line of its own');

  const nothing = applyMomentIntent(before, 'add', form([['date_y', '2024'], ['voice_a', ''], ['voice_b', '']]));
  assert.deepEqual(nothing, { ok: false, error: MOMENT_NEEDS });

  /* A legacy moment gains a voice: the sheet no longer sends its line — the line is KEPT. */
  const voiced = applyMomentIntent(before, 'edit', form([['id', 'none'], ['date_y', '2021'], ['voice_b', 'Now he wrote.']]));
  assert.ok(voiced.ok);
  const v = voiced.after.find((m) => m.id === 'none')!;
  assert.equal(v.line, 'The line told together.', 'writing a voice never blanks the line told together');
  assert.deepEqual(v.voices, { b: 'Now he wrote.' });

  /* The Studio's quick edits send no voice — the voices stay. */
  const titled = applyMomentIntent(before, 'edit', form([['id', 'both'], ['date_y', '2019'], ['title', 'Renamed'], ['line', 'x']]));
  assert.ok(titled.ok);
  assert.deepEqual(titled.after.find((m) => m.id === 'both')!.voices, BOTH, 'a form without the voices keeps them');

  /* A voice sent empty is cleared. */
  const cleared = applyMomentIntent(before, 'edit', form([['id', 'both'], ['date_y', '2019'], ['voice_a', ''], ['voice_b', 'His side of the umbrella.']]));
  assert.ok(cleared.ok);
  assert.deepEqual(cleared.after.find((m) => m.id === 'both')!.voices, { b: 'His side of the umbrella.' });
});

test('every look draws only the voices that wrote, under their names; none → the line', async () => {
  const { OurLoveStoryWidget } = await import('../app/[slug]/_components/our-love-story-widget');
  for (const look of ['conversation', 'timeline', 'cards', 'chapters']) {
    const html = renderToStaticMarkup(React.createElement(OurLoveStoryWidget, { config: STORY, sceneStyle: look, partners: PARTNERS }));
    const a = articles(html);
    assert.deepEqual(Object.keys(a), ['both', 'one', 'none'], `${look}: one part per moment, in story order`);

    assert.match(a.both!, /data-love-voice-a=""[^>]*>Her side of the umbrella\./, `${look}: voice a drawn`);
    assert.match(a.both!, /data-love-voice-b=""[^>]*>His side of the umbrella\./, `${look}: voice b drawn`);
    assert.ok(a.both!.indexOf('data-love-voice-a') < a.both!.indexOf('data-love-voice-b'), `${look}: the first partner first`);
    assert.ok(a.both!.includes('Maria') && a.both!.includes('Jose'), `${look}: each voice under its partner’s name`);
    assert.doesNotMatch(a.both!, /data-love-line/, `${look}: a moment with voices does not also draw its line`);

    assert.doesNotMatch(a.one!, /data-love-voice-a/, `${look}: a voice nobody wrote is not drawn — no empty bubble`);
    assert.match(a.one!, /data-love-voice-b=""[^>]*>Only Jose wrote this\./, `${look}: the one voice that wrote`);
    assert.doesNotMatch(a.one!, />Maria</, `${look}: the partner who did not write is not named`);

    assert.doesNotMatch(a.none!, /data-love-voice-/, `${look}: no voice → no bubble`);
    assert.match(a.none!, /data-love-line=""[^>]*>The line told together\./, `${look}: no voice → the line told together`);
  }
  const years = renderToStaticMarkup(React.createElement(OurLoveStoryWidget, { config: STORY, sceneStyle: 'years', partners: PARTNERS }));
  assert.ok(years.includes('Maria: Her side of the umbrella.'), 'the years: the open moment reads each voice, named');
  assert.ok(!years.includes('Told together, never shown here.'), 'the years: never the line beside the voices');
});

test('the looks are one root each, marked, and the default look carries the story tab’s anchor', async () => {
  const { OurLoveStoryWidget } = await import('../app/[slug]/_components/our-love-story-widget');
  for (const look of ['conversation', 'timeline', 'cards']) {
    const html = renderToStaticMarkup(React.createElement(OurLoveStoryWidget, { config: STORY, sceneStyle: look, partners: PARTNERS }));
    assert.match(html, new RegExp(`^<section[^>]*data-scene-style="${look}"`), `${look}: one section root`);
    assert.match(html, /^<section[^>]*id="[^"]+"/, `${look}: the Love Story tab lands here`);
    assert.doesNotMatch(html, /data-love-entrance/, `${look}: no entrance without an Animate choice (◆ Pro)`);
  }
  const moving = renderToStaticMarkup(React.createElement(OurLoveStoryWidget, { config: STORY, sceneStyle: 'conversation', partners: PARTNERS, entrance: true }));
  assert.match(moving, /data-love-entrance=""/, 'with an entrance chosen, the look’s choreography is armed');
  assert.doesNotMatch(moving, /data-love-play=""/, 'and never plays at rest — only once seen');
});

test('the Our Story poster prints each voice, named; a moment with none prints its line', () => {
  const chapters = printStoryChapters(STORY, PARTNERS);
  const lines = chapters.flatMap((c) => c.moments.map((m) => m.line));
  assert.ok(lines.some((l) => l.includes('Maria: Her side of the umbrella. · Jose: His side of the umbrella.')));
  assert.ok(lines.some((l) => l.includes('Jose: Only Jose wrote this.') && !l.includes('Maria')));
  assert.ok(lines.some((l) => l.includes('The line told together.')));
  assert.ok(!lines.some((l) => l.includes('Told together, never shown here.')), 'a voiced moment never prints its line too');
});

test('"Added by" hides once both voices are written', async () => {
  const { addedByShows } = await import('../app/dashboard/[eventId]/website/our-story/_components/moment-voices-fields');
  const [both, one, none] = resolveMoments(STORY);
  assert.equal(momentHasBothVoices(both!), true);
  assert.equal(addedByShows(both!), false);
  assert.equal(addedByShows(one!), true);
  assert.equal(addedByShows(none!), true);
  assert.equal(addedByShows(null), true, 'a new moment shows it');
});
