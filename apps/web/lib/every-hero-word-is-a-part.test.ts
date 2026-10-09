/**
 * every-hero-word-is-a-part.test.ts — THE LINK DOWN IS A PART, AND NO WORD ON
 * THE HERO IS LEFT OUT OF THE PARTS AGAIN.
 *
 * Owner, 2026-09-28, tapping "the day, the place, the story ↓" in the Maker:
 * *"why can't i update the text"*. Every other word on the hero was a part —
 * tap it, and its sheet opens — but the link was drawn as a fixed string
 * outside the `el()` / `txt()` helpers, in The Card and in Designs 2–4 alike.
 * So was the plain masthead's venue line. What this proves, by RENDERING:
 *
 *   1. a guest reads the couple's own words on the link, in every design, and
 *      the link still takes them to the details (its href is untouched);
 *   2. no words chosen, or words cleared → the card's own words (an absence,
 *      the joiner's rule) — never an empty link;
 *   3. the link's look (colour · size) reaches the words AND the ↓, and a
 *      hidden link is gone for a guest, ghosted in the Maker;
 *   4. the link's words are plain text, one short line;
 *   5. the venue is a part for STYLE only — its words are the event's venue,
 *      so a stored word on it is dropped;
 *   6. the Part sheet offers the link a words row, and the venue none;
 *   7. 🔒 THE GUARD: every text a guest can read in the masthead — every
 *      design, card and plain — sits inside a registered hero part, and nothing
 *      between the part and its words wears a colour or face of its own that
 *      would stop the couple's choice reaching the pixels. Text the masthead
 *      does not write (the slots its caller fills: the mark, the day-of pill,
 *      the photo) is not its words and is not held here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  HUB_ELEMENT_FIELDS,
  HUB_HERO_ELEMENT_KEYS,
  HUB_LINK_DEFAULT_WORDS,
  HUB_PART_LINE_MAX,
  heroPartsFor,
  sanitizeHubElements,
  sanitizeHubPartLine,
} from './element-style';
import { HERO_DESIGNS, type HeroDesignId } from './hero-design';
import { invitationCard } from '../app/[slug]/_lib/invitation-card';

(globalThis as unknown as { React: unknown }).React = React;

/** The card as the guest page builds it — the real href and the real default words. */
const CARD = invitationCard({
  words: { solemn: false, twoPeople: true, eventWord: 'wedding' },
  firstStartAt: '2026-12-18T13:30:00+08:00',
})!;

async function hero(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('../app/[slug]/_components/pahina-masthead');
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Cale & Ice',
      eventDate: '2026-12-18',
      twoPeople: true,
      card: CARD,
      ...props,
    }),
  );
}

/** The link part: its opening tag and everything inside it. */
function linkOf(html: string): string | null {
  const m = /<div[^>]*(?:data-el="link")?[^>]*class="mt-4 font-pahina[^"]*"[^>]*>([\s\S]*?<\/a>)<\/div>/.exec(html);
  return m ? m[0] : null;
}

/* ═══ 1 · THE COUPLE'S WORDS, IN EVERY DESIGN, AND THE LINK STILL WORKS ═══ */

for (const design of HERO_DESIGNS) {
  test(`1 · ${design}: a guest reads the couple’s own words on the link, and it still goes to the details`, async () => {
    const elements = sanitizeHubElements({ link: { word: 'See you there' } });
    const html = await hero({ design, elements });
    const link = linkOf(html);
    assert.ok(link, `${design}: no link drawn`);
    assert.match(link!, new RegExp(`<a href="${CARD.hubHref}"`), 'the link keeps its anchor');
    assert.equal(CARD.hubHref, '#site-details');
    assert.match(link!, />See you there</, 'the couple’s words');
    assert.doesNotMatch(link!, new RegExp(HUB_LINK_DEFAULT_WORDS), 'the card’s words are replaced, not added to');
    assert.match(link!, /aria-hidden="true">↓</, 'the ↓ stays with the words');
    assert.doesNotMatch(link!, /data-el/, 'a guest’s markup never carries data-el');
  });
}

/* ═══ 2 · NONE CHOSEN, OR CLEARED → THE CARD'S OWN WORDS ═══ */

test('2 · no words chosen, or words cleared → the card’s own words, never an empty link', async () => {
  assert.equal(CARD.hubLabel, HUB_LINK_DEFAULT_WORDS, 'the card draws the default words');
  const before = await hero({});
  assert.match(linkOf(before)!, new RegExp(`>${HUB_LINK_DEFAULT_WORDS}<`));
  for (const cleared of ['', '   ', '\n']) {
    const elements = sanitizeHubElements({ link: { word: cleared } });
    assert.equal(elements, null, `"${JSON.stringify(cleared)}" is an absence`);
    assert.equal(await hero({ elements }), before);
  }
});

/* ═══ 3 · ITS LOOK REACHES THE WORDS AND THE ↓; HIDDEN IS GONE FOR A GUEST ═══ */

test('3 · the link’s colour and size sit on the part the words and ↓ inherit from', async () => {
  const html = await hero({ elements: sanitizeHubElements({ link: { color: '#8a1c2b', size: 120 } }), stampElements: true });
  assert.match(html, /<div data-el="link" style="color:#8a1c2b;zoom:1\.2" class="mt-4 font-pahina/);
  const hidden = sanitizeHubElements({ link: { hidden: true } });
  assert.match(await hero({ elements: hidden, stampElements: true }), /data-el="link" style="opacity:0\.3"/, 'ghosted in the Maker');
  assert.match(await hero({ elements: hidden }), /<div style="display:none" class="mt-4 font-pahina/, 'gone for a guest');
});

/* ═══ 4 · PLAIN TEXT, ONE SHORT LINE ═══ */

test('4 · the link’s words are plain text, one short line', () => {
  assert.equal(sanitizeHubPartLine('  see   you\nthere '), 'see you there');
  assert.equal(sanitizeHubPartLine('x'.repeat(HUB_PART_LINE_MAX)), 'x'.repeat(HUB_PART_LINE_MAX));
  assert.equal(sanitizeHubPartLine('x'.repeat(HUB_PART_LINE_MAX + 1)), null);
  assert.equal(sanitizeHubPartLine('a\u0000b'), null, 'no control characters');
  assert.equal(sanitizeHubPartLine('a‮b'), null, 'no direction overrides');
  assert.equal(sanitizeHubPartLine(42), null);
  assert.equal(sanitizeHubPartLine('ang araw, ang lugar ✨'), 'ang araw, ang lugar ✨');
});

/* ═══ 5 · THE VENUE IS STYLE ONLY ═══ */

test('5 · the venue is a part for style only — its words are the event’s venue', async () => {
  assert.ok(!HUB_ELEMENT_FIELDS.venue.includes('word'), 'the venue takes no words of its own');
  assert.equal(sanitizeHubElements({ venue: { word: 'Somewhere else' } }), null, 'a stored word on the venue is dropped');
  const elements = sanitizeHubElements({ venue: { color: '#123456', word: 'Somewhere else' } });
  const plain = { card: undefined, venueName: 'San Agustin Church', elements, stampElements: true };
  for (const design of HERO_DESIGNS) {
    const html = await hero({ ...plain, design });
    assert.match(html, /<p data-el="venue" style="color:#123456" class="mt-2 text-base text-ink\/70">San Agustin Church<\/p>/, design);
    assert.doesNotMatch(html, /Somewhere else/);
  }
});

/* ═══ 6 · THE PART SHEET: A WORDS ROW FOR THE LINK, NONE FOR THE VENUE ═══ */

test('6 · the Part sheet offers the link its words (the card’s as the hint) and the venue none', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PartTextTab } = await import('../app/dashboard/[eventId]/website/editor/_components/part-inspector');
  const tab = (el: 'link' | 'venue', word?: string) =>
    renderToStaticMarkup(
      React.createElement(PartTextTab, {
        el,
        face: {},
        style: word ? { word } : {},
        onRange: false,
        choose: () => {},
        chooseAlign: () => {},
        resetText: () => {},
        board: [],
        shownColour: '#000000',
        contrast: null,
        eventId: 'e',
      }),
    );
  const link = tab('link');
  assert.match(link, /data-row="part-words"/);
  assert.match(link, new RegExp(`placeholder="${HUB_LINK_DEFAULT_WORDS}"`));
  assert.match(link, new RegExp(`maxLength="${HUB_PART_LINE_MAX}"`));
  assert.match(tab('link', 'See you there'), /value="See you there"/, 'their words, ready to change');
  assert.doesNotMatch(tab('venue'), /data-row="part-words"|id="part-own-words"|data-inspector-row="joiner"/, 'the venue’s words are the event’s');
});

/* ═══ 7 · 🔒 THE GUARD — EVERY WORD ON THE HERO IS A PART ═══ */

type Node = { tag: string; attrs: Record<string, string>; parent: Node | null };

/** Every non-blank text in React's server HTML, with its element ancestry. */
function textsOf(html: string): Array<{ text: string; chain: Node[] }> {
  const out: Array<{ text: string; chain: Node[] }> = [];
  const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source']);
  let cur = null as Node | null;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)>|<([a-zA-Z0-9]+)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) cur = cur?.parent ?? null;
    else if (m[2]) {
      const attrs: Record<string, string> = {};
      for (const a of (m[3] ?? '').matchAll(/([^\s=>/]+)(?:="([^"]*)")?/g)) attrs[a[1]!] = a[2] ?? '';
      const node: Node = { tag: m[2].toLowerCase(), attrs, parent: cur };
      if (!m[4] && !VOID.has(node.tag)) cur = node;
    } else if (m[5] && m[5].trim()) {
      const chain: Node[] = [];
      for (let n = cur; n; n = n.parent) chain.push(n);
      out.push({ text: m[5].trim(), chain });
    }
  }
  return out;
}

/**
 * A class on an element BETWEEN a part and its words that sets the words' own
 * colour or face — the part's inline choice would then stop at that element,
 * and the couple's pick would move no pixels. Sizes, alignment and weights are
 * not colour or face.
 */
const OWN_COLOUR = /^(?:[a-z-]+:)?text-(?!(?:xs|sm|base|lg|[2-9]?xl|left|center|right|justify)$)(?!\[)/;
const OWN_FACE = /^font-(?:pahina|serif|sans|mono|display|script)$/;

/**
 * 🧾 KNOWN, REPORTED, NOT YET FIXED — a list that may only shrink. Each entry
 * is `<part>:<the class on the inner element>`, with why. EMPTY: the Date's
 * inner span carried its own face and colour (`font-pahina … text-ink`, The
 * Crest's `text-ink/60`) until 2026-09-28, so a colour or font chosen for the
 * Date stopped at that span — found by this guard, fixed in the same PR.
 */
const KNOWN_BLOCKED = new Set<string>([]);

/** Text the masthead writes that is deliberately NOT a part, with why. */
const NOT_A_PART_BY_DESIGN: ReadonlyArray<{ tag: string; why: string }> = [
  // EMPTY. The cover plate's caption was here until the owner answered
  // "make it editable" (2026-09-28) — it is the `caption` part now.
];

async function everyMasthead(): Promise<Array<{ name: string; html: string }>> {
  const slots = {
    // Text the CALLER fills — marked so the guard can tell it from the masthead's own words.
    badgeSlot: React.createElement('p', { 'data-slot': 'badge' }, 'Happening now'),
    monogramSlot: React.createElement('span', { 'data-slot': 'mark' }, 'C&I'),
  };
  const out: Array<{ name: string; html: string }> = [];
  for (const design of HERO_DESIGNS as readonly HeroDesignId[]) {
    out.push({ name: `${design} · card`, html: await hero({ design, ...slots, stampElements: true, venueName: 'San Agustin' }) });
    out.push({
      name: `${design} · plain (hero photo)`,
      html: await hero({
        design,
        ...slots,
        stampElements: true,
        card: undefined,
        venueName: 'San Agustin',
        mediaSlot: React.createElement('img', { alt: '', 'data-slot': 'media' }),
        mediaCaption: 'San Agustin',
      }),
    });
    out.push({ name: `${design} · solemn (no eyebrow)`, html: await hero({ design, ...slots, stampElements: true, card: undefined, eyebrow: null, venueName: 'St. Peter Chapels' }) });
  }
  return out;
}

test('7 · 🔒 every word a guest can read on the hero is a registered part, and the part’s look can reach it', async () => {
  const unregistered: string[] = [];
  const blocked: string[] = [];
  const exempted = new Set<string>();
  const knownSeen = new Set<string>();
  for (const { name, html } of await everyMasthead()) {
    for (const { text, chain } of textsOf(html)) {
      if (chain.some((n) => 'data-slot' in n.attrs)) continue;
      const at = chain.findIndex((n) => 'data-el' in n.attrs);
      const why = NOT_A_PART_BY_DESIGN.find((x) => chain.some((n) => n.tag === x.tag));
      if (at < 0) {
        if (why) {
          exempted.add(why.tag);
          continue;
        }
        unregistered.push(`${name}: "${text}"`);
        continue;
      }
      const key = chain[at]!.attrs['data-el']!;
      if (!(HUB_HERO_ELEMENT_KEYS as readonly string[]).includes(key)) unregistered.push(`${name}: "${text}" sits in unknown part "${key}"`);
      for (const n of chain.slice(0, at)) {
        for (const cls of (n.attrs.class ?? '').split(/\s+/)) {
          if (!OWN_COLOUR.test(cls) && !OWN_FACE.test(cls)) continue;
          if (KNOWN_BLOCKED.has(`${key}:${cls}`)) {
            knownSeen.add(`${key}:${cls}`);
            continue;
          }
          blocked.push(`${name}: "${text}" in ${key} — an inner <${n.tag}> carries "${cls}"`);
        }
      }
    }
  }
  assert.deepEqual(unregistered, [], `hero text outside every part — make it a part (el/txt), or it cannot be edited:\n${unregistered.join('\n')}`);
  assert.deepEqual(blocked, [], `a part's colour or face stops before its words:\n${blocked.join('\n')}`);
  // The exemptions are live, not stale: each one still matches something.
  for (const x of NOT_A_PART_BY_DESIGN) assert.ok(exempted.has(x.tag), `stale exemption: ${x.tag} no longer drawn — remove it`);
  for (const k of KNOWN_BLOCKED) assert.ok(knownSeen.has(k), `${k} is fixed — take it off KNOWN_BLOCKED so it stays fixed`);
});

test('7b · the guard can see: a hero word drawn outside every part is caught', () => {
  const texts = textsOf('<header><p data-el="names">Cale</p><a href="#x"><span>loose words</span></a></header>');
  const loose = texts.filter(({ chain }) => !chain.some((n) => 'data-el' in n.attrs)).map((t) => t.text);
  assert.deepEqual(loose, ['loose words']);
  assert.ok(OWN_COLOUR.test('text-mulberry') && OWN_COLOUR.test('hover:text-ink/60') && OWN_FACE.test('font-pahina'));
  assert.ok(!OWN_COLOUR.test('text-base') && !OWN_COLOUR.test('text-2xl') && !OWN_COLOUR.test('text-[0.5em]') && !OWN_FACE.test('font-light'));
});

test('7c · every part the masthead can draw is one the hero registers — none drawn under an unknown key', async () => {
  const drawn = new Set<string>();
  for (const { html } of await everyMasthead()) for (const m of html.matchAll(/data-el="([a-z]+)"/g)) drawn.add(m[1]!);
  assert.deepEqual([...drawn].sort(), [...HUB_HERO_ELEMENT_KEYS].sort(), 'drawn parts ≠ registered hero parts');
});

/* The guard's input must be real — a render that drew nothing would pass 7. */
test('7d · the guard reads real mastheads (non-empty, with the link and the venue)', async () => {
  const all = await everyMasthead();
  assert.equal(all.length, HERO_DESIGNS.length * 3);
  for (const { name, html } of all) assert.ok(textsOf(html).length >= 4, `${name}: drew almost nothing`);
  assert.ok(all.some(({ html }) => html.includes('data-el="link"')));
  assert.ok(all.some(({ html }) => html.includes('data-el="venue"')));
});

/* ═══ 8 · THE DATE'S OWN COLOUR AND FONT REACH ITS WORDS ═══ */

test('8 · the couple’s Date colour and font sit on the part, and no inner span overrides them — every design', async () => {
  const elements = sanitizeHubElements({ date: { color: '#123456', font: 'fraunces' } });
  for (const design of HERO_DESIGNS) {
    const html = await hero({ design, elements, stampElements: true });
    const m = /<p data-el="date"[^>]*style="([^"]*)"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    assert.ok(m, `${design}: no date part`);
    assert.match(m![1]!, /color:#123456/, `${design}: the colour is on the part`);
    assert.match(m![1]!, /font-family:/, `${design}: the font is on the part`);
    for (const cls of m![2]!.matchAll(/class="([^"]*)"/g)) {
      assert.doesNotMatch(cls[1]!, /(?:^|\s)(?:text-ink|text-gild|font-pahina|font-serif)(?:\/\d+)?(?=\s|$)/, `${design}: an inner span still sets its own colour or face: ${cls[1]}`);
    }
    assert.match(m![2]!, /December 18, 2026/);
  }
});

/* ═══ 9 · THE PHOTO CAPTION IS THE COUPLE'S (owner 2026-09-28: "make it editable") ═══ */

const PHOTO = { card: undefined, mediaSlot: React.createElement('img', { alt: '' }), mediaCaption: 'San Agustin Church' };
const captionOf = (html: string) => /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(html);

test('9 · a guest reads the couple’s own caption under the photo, in every design; none or cleared → the venue', async () => {
  for (const design of HERO_DESIGNS) {
    const own = captionOf(await hero({ ...PHOTO, design, elements: sanitizeHubElements({ caption: { word: 'Where it all began' } }) }));
    assert.ok(own, `${design}: no caption`);
    assert.equal(own![1], 'Where it all began', `${design}: the couple’s words replace the venue`);
    assert.doesNotMatch(own![0], /data-el/, 'a guest’s markup never carries data-el');
    const before = await hero({ ...PHOTO, design });
    assert.equal(captionOf(before)![1], 'San Agustin Church', `${design}: the venue while they wrote none`);
    assert.equal(sanitizeHubElements({ caption: { word: '  ' } }), null, 'cleared is an absence');
  }
});

test('9b · the caption takes a look like any part, and the Maker keeps the venue on it to put back', async () => {
  const html = await hero({ ...PHOTO, stampElements: true, elements: sanitizeHubElements({ caption: { word: 'Hi', color: '#123456' } }) });
  const tag = /<figcaption[^>]*>/.exec(html)![0];
  assert.match(tag, /data-el="caption"/);
  assert.match(tag, /data-el-word="San Agustin Church"/, 'the default the canvas puts back when the words are cleared');
  assert.match(tag, /color:#123456/);
  assert.match(await hero({ ...PHOTO, elements: sanitizeHubElements({ caption: { hidden: true } }) }), /<figcaption style="display:none"/);
});

test('9c · the Part sheet offers the caption its words, the venue as the hint; Part ▾ lists it only under a photo', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PartTextTab } = await import('../app/dashboard/[eventId]/website/editor/_components/part-inspector');
  const html = renderToStaticMarkup(
    React.createElement(PartTextTab, {
      el: 'caption',
      face: {},
      style: {},
      onRange: false,
      choose: () => {},
      chooseAlign: () => {},
      resetText: () => {},
      board: [],
      shownColour: '#000000',
      contrast: null,
      eventId: 'e',
    }),
  );
  assert.match(html, /data-row="part-words"/);
  assert.match(html, /placeholder="The venue"/);
  assert.ok(heroPartsFor(false, true, true).includes('caption'), 'a hero photo lists its caption');
  assert.ok(!heroPartsFor(false, true, false).includes('caption'), 'no photo, no caption to style');
  assert.ok(!heroPartsFor(true, true, false).includes('caption'), 'the card draws no caption');
});
