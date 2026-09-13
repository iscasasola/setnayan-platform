/**
 * hub-stage-renders.test.ts — THE MEASUREMENT REACHES THE RENDER.
 *
 * `lib/event-hub-control.test.ts` proves the resolvers. This proves the pixels,
 * and the difference is the entire disease this build exists to cure: the guest
 * error that shipped was already bound and already in Sentry, and a couple with
 * 180 names was still told "No guests yet." A resolver returning `known:false`
 * changes nothing until something renders it differently.
 *
 * So this MOUNTS the stage — three phases, real emitted HTML — and reads what a
 * person would actually see:
 *
 *   107 days out ..... "Save-the-Date" is the live channel, "Stage 1 of 4"
 *   today ............ "Day-of", "Stage 3 of 4"
 *   last month ....... "Editorial", "Stage 4 of 4"
 *
 * and then the case with no visible difference at all: a refused read must NOT
 * emit a zero, a countdown, or a stage number.
 *
 * 🪤 `globalThis.React` IS SET BEFORE THE DYNAMIC IMPORTS AND IS NOT A HACK TO
 * BE TIDIED AWAY. tsconfig sets `"jsx": "preserve"` for Next, so `tsx` compiles
 * these components to the CLASSIC runtime — bare `React.createElement` with no
 * import of its own. Without the global every component throws "React is not
 * defined" before an assertion runs, and the imports must be DYNAMIC because a
 * static one is hoisted above the assignment. Precedent:
 * `app/_components/byline-renders-as-a-door.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const MNL = 'Asia/Manila';
const at = (iso: string) => new Date(iso).getTime();

type Mod = typeof import('./hub-stage');
type Control = typeof import('@/lib/event-hub-control');

async function paint(opts: {
  eventDate: string | null;
  nowMs: number;
  measured?: boolean;
  slug?: string | null;
  guestsMeasured?: boolean;
  guestsShared?: boolean;
  invited?: number;
  replied?: number;
}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubStage }: Mod = await import('./hub-stage');
  const control: Control = await import('@/lib/event-hub-control');
  const { PUBLIC_SITE_PAGES } = await import('@/lib/public-site-pages');

  const read = {
    measured: opts.measured ?? true,
    eventDate: opts.eventDate,
    eventEndDate: null,
    clearedAt: null,
    timezone: MNL,
    slug: opts.slug === undefined ? 'maria-and-jomar' : opts.slug,
  };
  const guests = {
    shared: opts.guestsShared ?? true,
    measured: opts.guestsMeasured ?? true,
    invited: opts.invited ?? 90,
    replied: opts.replied ?? 61,
  };
  const standing = control.resolveHubStanding(read, opts.nowMs);
  const facts = control.resolveHubFacts(read, guests, opts.nowMs);
  const idx = PUBLIC_SITE_PAGES.findIndex((p) => p.phaseParam === standing.stage);
  const channel = idx >= 0 ? PUBLIC_SITE_PAGES[idx] : null;

  return renderToStaticMarkup(
    React.createElement(HubStage, {
      slug: read.slug,
      standing,
      facts,
      channelName: channel?.name ?? null,
      channelBlurb: channel?.blurb ?? null,
      channelIndex: channel ? idx + 1 : null,
      channelCount: PUBLIC_SITE_PAGES.length,
      editHref: '/dashboard/E1/website/editor',
      /* VIEW AS is OFF in this harness on purpose. These observations are about
         the STAGE — the four channels and the four facts — and an empty offer
         list is exactly what a viewer the gate refused gets, so the stage is
         proved to stand on its own with no switcher under it. The switcher's
         own six reads are `view-as-reaches-the-render.test.ts` beside this. */
      roles: [],
      armedRole: null,
      roleHrefBase: '/dashboard/E1/launch',
    }),
  );
}

const NOW = at('2026-09-02T10:00:00+08:00');

/**
 * The FACTS STRIP only — label → rendered value, from the emitted `<dl>`.
 *
 * 🪤 THIS EXISTS BECAUSE A WHOLE-PAGE `assert.match(html, /—/)` CANNOT FAIL.
 * Measured: replacing the unknown-fact branch with a bare `{fact.value}` (which
 * renders NOTHING for an unknown fact) left every assertion in this file green,
 * because the stage's own standfirst — "your event — it changes itself" — puts
 * an em-dash in the markup no matter what the facts say. A guard whose failing
 * case produces the same output as its passing case is not a guard. So the
 * assertions below read THE CELL, not the page.
 */
function factCells(html: string): Record<string, string> {
  const dl = /<dl[^>]*>([\s\S]*?)<\/dl>/.exec(html);
  assert.ok(dl?.[1], 'the facts strip must render at all');
  const out: Record<string, string> = {};
  const strip = (x: string | undefined) => (x ?? '').replace(/<[^>]*>/g, '').trim();
  for (const m of dl[1].matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/g)) {
    out[strip(m[1])] = strip(m[2]);
  }
  assert.equal(Object.keys(out).length, 4, 'four facts, always — an absent one is not a blank one');
  return out;
}

/** What an UNKNOWN cell renders as, exactly. */
const EM_DASH = '\u2014';

test('⭐ OBSERVATION 1 · 107 days out — the save-the-date is on the stage', async () => {
  const html = await paint({ eventDate: '2026-12-18', nowMs: NOW });
  assert.match(html, /Save-the-Date/, 'the live channel is named');
  assert.match(html, /Stage 1 of 4/);
  assert.match(html, /Active now/);
  assert.match(html, /In 107 days/, 'the countdown reaches the eye');
  assert.match(html, /61 of 90 in/);
  assert.match(html, /29 have not replied/);
  assert.match(html, /setnayan\.com\/maria-and-jomar/);
  assert.doesNotMatch(html, /Day-of|Editorial/, 'and no other channel claims to be live');
});

test('⭐ OBSERVATION 2 · the day itself — the day-of page is on the stage', async () => {
  const html = await paint({ eventDate: '2026-09-02', nowMs: at('2026-09-02T15:00:00+08:00') });
  assert.match(html, /Day-of/);
  assert.match(html, /Stage 3 of 4/);
  assert.match(html, /Today/, 'the countdown says the day, not a number of days');
  assert.doesNotMatch(html, /Save-the-Date/);
});

test('⭐ OBSERVATION 3 · last month — the story is on the stage', async () => {
  const html = await paint({ eventDate: '2026-08-02', nowMs: NOW });
  assert.match(html, /Editorial/);
  assert.match(html, /Stage 4 of 4/);
  assert.match(html, /31 days ago/, 'never a bare negative number');
  assert.doesNotMatch(html, /Day-of/);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE ONE THAT LOOKS LIKE THE OTHERS — a refused read
   ══════════════════════════════════════════════════════════════════════════ */

test('⭐ THE GUARD · a REFUSED event read paints no stage, no number, no countdown', async () => {
  const html = await paint({ eventDate: null, nowMs: NOW, measured: false, slug: null });
  assert.doesNotMatch(html, /Stage \d of 4/, 'a stage number here is a claim about their event');
  assert.doesNotMatch(html, /Active now/);
  assert.doesNotMatch(html, /Save-the-Date/, 'the first stage is what a null date resolves to — not what this event is');
  assert.match(html, /could not reach your event/, 'it says what happened instead');
  const cells = factCells(html);
  assert.equal(cells.Stage, EM_DASH, 'the stage cell says "unknown", in the cell itself');
  assert.equal(cells['The day'], EM_DASH, 'and so does the countdown');
  assert.notEqual(cells.Stage, '', 'an EMPTY cell is not an honest one — it reads as "nothing to say"');
});

test('⭐ THE GUARD · a REFUSED guest read never paints "0 of 0"', async () => {
  const html = await paint({
    eventDate: '2026-12-18',
    nowMs: NOW,
    guestsMeasured: false,
    invited: 0,
    replied: 0,
  });
  assert.doesNotMatch(html, /0 of 0/, 'the sentence a couple with 180 names was once shown');
  assert.doesNotMatch(html, /Everyone replied/, 'nor its cheerful cousin');
  const cells = factCells(html);
  assert.equal(cells.Replies, EM_DASH, 'the reply cell says unknown, and says it visibly');
  assert.equal(cells['Still quiet'], EM_DASH);
  assert.match(html, /Stage 1 of 4/, 'the event itself was read, so the stage still paints');
  assert.match(html, /In 107 days/, 'and so does its countdown — one refused read does not blank the others');
});

test('⭐ THE GUARD · a GENUINELY empty guest list DOES paint its zero', async () => {
  // Non-vacuity for the two tests above: if `known` were simply always false,
  // they would pass while the page said nothing to anybody.
  const html = await paint({ eventDate: '2026-12-18', nowMs: NOW, invited: 0, replied: 0 });
  const cells = factCells(html);
  assert.equal(cells.Replies, '0 of 0 in', 'a measured zero is a fact and may be stated');
  assert.equal(cells['Still quiet'], 'Everyone replied');
  assert.notEqual(cells.Replies, EM_DASH, 'the two cases must not paint the same');
});

test('⭐ a delegate without the guest list is told so, on the stage', async () => {
  const html = await paint({
    eventDate: '2026-12-18',
    nowMs: NOW,
    guestsShared: false,
    guestsMeasured: false,
    invited: 0,
    replied: 0,
  });
  assert.equal(factCells(html).Replies, 'Not shared with you', 'a host decision, said plainly');
  assert.doesNotMatch(html, /0 of 0/, 'not an empty roster');
  assert.match(html, /Stage 1 of 4/, 'and the rest of the stage is still theirs');
});

test('⛔ EMPTY IS A PROMISE — an event with nothing set shows the page it will become', async () => {
  const html = await paint({ eventDate: '2026-12-18', nowMs: NOW, slug: null, invited: 0, replied: 0 });
  assert.match(html, /Save-the-Date/, 'the page it will become is drawn, not withheld');
  assert.match(html, /In 107 days/, 'with its countdown');
  assert.match(html, /Set your link/, 'and one lit thing to press');
  assert.doesNotMatch(html, /nothing here|no page yet|not created/i, 'never an apology');
});
