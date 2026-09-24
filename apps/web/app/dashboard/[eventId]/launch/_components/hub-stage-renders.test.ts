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
 *   107 days out ..... Save the Date is the live stage, "Stage 1 of 4"
 *   today ............ On the Day, "Stage 3 of 4"
 *   last month ....... Post Event, "Stage 4 of 4"
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

/* The stage's words come from ONE record (owner's set, 2026-09-24). Read them
   from it, so a relabel is a one-line change there and never a silent pass
   here — a hard-coded old label in a `doesNotMatch` would go vacuous. */
import { PUBLIC_STAGE_LABELS as W } from '@/lib/public-site-stage-labels';
const re = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
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
  /** `?stage=` — the "When" switch's deep link. */
  stage?: string;
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

  return renderToStaticMarkup(
    React.createElement(HubStage, {
      slug: read.slug,
      standing,
      facts,
      livePhase: standing.stage,
      initialPhase: control.resolveHubStageSelection({ param: opts.stage, live: standing.stage }),
      stages: PUBLIC_SITE_PAGES.map((p) => ({ phase: p.phaseParam, blurb: p.blurb })),
      editHref: '/dashboard/E1/website/editor',
      workroomHref: '/dashboard/E1/story',
      /* VIEW AS is OFF in this harness on purpose. These observations are about
         the STAGE — the four channels and the four facts — and an empty offer
         list is exactly what a viewer the gate refused gets, so the stage is
         proved to stand on its own with no switcher under it. The switcher's
         own six reads are `view-as-reaches-the-render.test.ts` beside this. */
      rolesByPhase: {},
      armedRole: null,
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

/**
 * THE "WHEN" SWITCH, chip by chip — which stage is LIVE (carries "Active now")
 * and which is PICKED (aria-pressed). Read per element, never off the whole
 * page: all four stage names are always painted now, so "the page mentions
 * Day-of" says nothing about which stage is live.
 */
function whenChips(html: string): { live: string[]; picked: string[]; all: string[] } {
  const chips = [...html.matchAll(/<button\b[^>]*data-phase="([a-z_]+)"[^>]*>([\s\S]*?)<\/button>/g)];
  const all = chips.map((m) => m[1] as string);
  const live = chips.filter((m) => /data-live="true"/.test(m[0]) && /Active now/.test(m[2] ?? '')).map((m) => m[1] as string);
  const picked = chips.filter((m) => /aria-pressed="true"/.test(m[0])).map((m) => m[1] as string);
  return { live, picked, all };
}

/** What an UNKNOWN cell renders as, exactly. */
const EM_DASH = '\u2014';

test('⭐ OBSERVATION 1 · 107 days out — the save-the-date is on the stage', async () => {
  const html = await paint({ eventDate: '2026-12-18', nowMs: NOW });
  assert.match(html, re(W.save_the_date), 'the live channel is named');
  assert.match(html, /Stage 1 of 4/);
  assert.match(html, /Active now/);
  assert.match(html, /In 107 days/, 'the countdown reaches the eye');
  assert.match(html, /61 of 90 in/);
  assert.match(html, /29 have not replied/);
  assert.match(html, /setnayan\.com\/maria-and-jomar/);
  const chips = whenChips(html);
  assert.deepEqual(chips.all, ['save_the_date', 'rsvp', 'event', 'editorial'], 'all four stages are on the switch');
  assert.deepEqual(chips.live, ['save_the_date'], 'and no other stage claims to be live');
  assert.deepEqual(chips.picked, ['save_the_date'], 'the switch opens on today\u2019s stage');
  assert.equal((html.match(/Active now/g) ?? []).length, 2, 'the live chip, and the caption of the stage it opened on');
});

test('⭐ OBSERVATION 2 · the day itself — the day-of page is on the stage', async () => {
  const html = await paint({ eventDate: '2026-09-02', nowMs: at('2026-09-02T15:00:00+08:00') });
  assert.match(html, re(W.event));
  assert.match(html, /Stage 3 of 4/);
  assert.match(html, /Today/, 'the countdown says the day, not a number of days');
  assert.deepEqual(whenChips(html).live, ['event'], 'the day itself is the ONE live stage');
  assert.deepEqual(whenChips(html).picked, ['event']);
});

test('⭐ OBSERVATION 3 · last month — the story is on the stage', async () => {
  const html = await paint({ eventDate: '2026-08-02', nowMs: NOW });
  assert.match(html, re(W.editorial));
  assert.match(html, /Stage 4 of 4/);
  assert.match(html, /31 days ago/, 'never a bare negative number');
  assert.deepEqual(whenChips(html).live, ['editorial'], 'the after-story is the ONE live stage');
});

/* ══════════════════════════════════════════════════════════════════════════
   THE ONE THAT LOOKS LIKE THE OTHERS — a refused read
   ══════════════════════════════════════════════════════════════════════════ */

test('⭐ THE GUARD · a REFUSED event read paints no stage, no number, no countdown', async () => {
  const html = await paint({ eventDate: null, nowMs: NOW, measured: false, slug: null });
  assert.doesNotMatch(html, /Stage \d of 4/, 'a stage number here is a claim about their event');
  assert.doesNotMatch(html, /Active now/);
  assert.doesNotMatch(html, re(W.save_the_date), 'the first stage is what a null date resolves to — not what this event is');
  assert.deepEqual(whenChips(html).all, [], 'no When switch — picking a stage of an event we could not read is a guess');
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
  assert.match(html, re(W.save_the_date), 'the page it will become is drawn, not withheld');
  assert.match(html, /In 107 days/, 'with its countdown');
  assert.match(html, /Set your link/, 'and one lit thing to press');
  assert.doesNotMatch(html, /nothing here|no page yet|not created/i, 'never an apology');
});

/* ═════════════════════════════════════════════════════════════════════════
   THE MINIATURE — the controller looks at the page instead of describing it
   ═════════════════════════════════════════════════════════════════════════ */

/** The frame's `src`, or null when no frame was painted at all. */
function frameSrc(html: string): string | null {
  // 🪤 `m?.[1] ?? null`, not `m ? m[1] : null`. `noUncheckedIndexedAccess`
  // types a capture group as `string | undefined`, and the second form returns
  // that `undefined` — which `assert.equal(frameSrc(html), null)` would then
  // FAIL on for the right reason and the wrong value. tsc caught it.
  const m = /<iframe\b[^>]*\bsrc="([^"]*)"/.exec(html);
  return m?.[1] ?? null;
}

test('⭐ THE MINIATURE · the stage paints the page, at the SAME address as its button', async () => {
  const html = await paint({ eventDate: '2026-12-18', nowMs: NOW });
  assert.equal(
    frameSrc(html),
    '/maria-and-jomar',
    'the frame is the couple\u2019s own address — no ?phase=, no ?as=, no ?editor=1',
  );
  // The door beneath it must agree. Two addresses on one card is the bug this
  // whole component exists to not have.
  assert.match(html, /href="\/maria-and-jomar"/, 'the button opens what the frame shows');
  assert.match(html, /pointer-events-none/, 'it is a picture, not a second app');
  assert.match(html, /tabIndex="-1"|tabindex="-1"/, 'and it is out of the tab order');
});

test('⭐ THE MINIATURE · the ribbon is NAMED, and the eyebrow never claims a guest\u2019s eye', async () => {
  const html = await paint({ eventDate: '2026-12-18', nowMs: NOW });
  assert.match(html, /That strip across the top is yours alone/, 'the ribbon is explained where it is seen');
  assert.doesNotMatch(
    html,
    /As your guests see it/,
    'the frame carries the owner ribbon, so this label would be false in the pixels',
  );
  assert.doesNotMatch(
    html,
    /Open as a guest/,
    'and so would a button that opens the host\u2019s own signed-in page',
  );
});

test('⛔ THE GUARD · a REFUSED read paints NO frame — not an empty one, none', async () => {
  const html = await paint({ eventDate: null, nowMs: NOW, measured: false, slug: null });
  assert.equal(frameSrc(html), null, 'a frame here is a picture of a page we never confirmed');
  assert.match(html, /could not reach your event/, 'it still says what happened');
});

test('⛔ THE GUARD · no address yet — the card stays, the frame does not', async () => {
  // Non-vacuity in the other direction: the frame is gated on the SLUG as well
  // as on the read, and losing the slug must not blank the stage with it.
  const html = await paint({ eventDate: '2026-12-18', nowMs: NOW, slug: null });
  assert.equal(frameSrc(html), null, 'there is no page to photograph yet');
  assert.match(html, re(W.save_the_date), 'but the page it will become is still drawn');
  assert.match(html, /In 107 days/, 'with its countdown');
  assert.match(html, /Set your link/, 'and one lit thing to press');
  assert.doesNotMatch(html, /That strip across the top/, 'and no ribbon note for a frame that is absent');
});

/* ═════════════════════════════════════════════════════════════════════════
   WHO × WHEN — the four stage cards folded into the stage (owner 2026-09-24:
   "this 2 can integrate to each other"). The cards carried two doors each;
   those doors now follow the PICKED stage, and these hold that they do.
   ═════════════════════════════════════════════════════════════════════════ */

test('⭐ WHEN · a picked stage reaches the FRAME, the caption and the Preview door', async () => {
  // 14 days out: RSVP is live. The couple picks Editorial.
  const html = await paint({ eventDate: '2026-09-16', nowMs: NOW, stage: 'editorial' });
  const chips = whenChips(html);
  assert.deepEqual(chips.live, ['rsvp'], 'picking a stage does not move "Active now"');
  assert.deepEqual(chips.picked, ['editorial'], 'the deep link opens the stage it names');
  assert.equal(frameSrc(html), '/maria-and-jomar?phase=editorial', 'the frame asks for the picked stage');
  assert.match(
    html,
    /href="\/maria-and-jomar\?phase=editorial"[^>]*target="_blank"[^>]*data-stage-preview="editorial"/,
    'ONE Preview door, for the stage picked, in a new tab — what each card used to carry',
  );
  assert.match(html, /Stage 4 of 4/, 'the caption names the picked stage');
});

test('⭐ WHEN · Editorial picked ⇒ the workroom door, same tab, into the SHIPPED route', async () => {
  const html = await paint({ eventDate: '2026-09-16', nowMs: NOW, stage: 'editorial' });
  const door = /<a\b[^>]*href="\/dashboard\/E1\/story"[^>]*>[\s\S]*?<\/a>/.exec(html)?.[0];
  assert.ok(door, 'Editorial\u2019s "Open the workroom" door moved here with the card');
  assert.match(door, /Open the workroom/);
  assert.doesNotMatch(door, /target="_blank"/, 'a workroom is opened, not previewed in a new tab');
});

test('⛔ WHEN · any other stage picked ⇒ NO workroom door', async () => {
  for (const stage of ['save_the_date', 'rsvp', 'event']) {
    const html = await paint({ eventDate: '2026-09-16', nowMs: NOW, stage });
    assert.doesNotMatch(html, /Open the workroom/, `the workroom door leaked onto ${stage}`);
    assert.match(
      html,
      new RegExp(`href="/maria-and-jomar\\?phase=${stage}"[^>]*data-stage-preview="${stage}"`),
      `and ${stage}\u2019s own Preview door is there instead`,
    );
  }
});

test('⛔ WHEN · a stage the switch does not have opens on TODAY\u2019s, never on a guess', async () => {
  const html = await paint({ eventDate: '2026-09-16', nowMs: NOW, stage: 'bogus' });
  assert.deepEqual(whenChips(html).picked, ['rsvp']);
  assert.equal(frameSrc(html), '/maria-and-jomar', 'today\u2019s stage is the bare address, pin and all');
});

