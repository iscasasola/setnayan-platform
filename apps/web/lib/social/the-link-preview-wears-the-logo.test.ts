/**
 * GUARD — THE LINK PREVIEW WEARS THE COUPLE'S OWN LOGO, and only when the Logo switch says so.
 *
 * Owner, 2026-10-20, verbatim: *"the link sent did not use the logo of cale-ice on the thumbnail"*. Measured on
 * production: the `og:image` of `/cale-ice` drew the typed initials "IC" while the couple's cover and their QR
 * centre drew the I&C logo they made — `/api/og/realstory-slug/[slug]` never selected the logo columns at all.
 *
 * ⚖ DECISION_LOG 2026-10-15 (4): `events.logo_wanted` is REAL — on ⇒ the logo shows; off ⇒ it shows nowhere.
 *
 * The PROPERTY, asserted on pixels where pixels can be had:
 *   • a logo that is set AND wanted ⇒ the card draws the logo (its ink is in the rendered picture);
 *   • switched off / unset / refused by the safety gate / unrenderable / too slow ⇒ the card draws the initials
 *     (the logo step returns null, and the initials element is what renders).
 *
 * `realstory-card.tsx` and the route carry `import 'server-only'`, which is not installed for `node:test`, so the
 * card's WIRING is pinned from source (the house pattern for these cards — `vendor-card.test.ts`), while the LOGO
 * STEP and the satori node it hands the card are rendered for real through the same satori + sharp pipeline.
 *
 * Run from apps/web:  npx tsx --test lib/social/the-link-preview-wears-the-logo.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import sharp from 'sharp';

import { cardLogoImage, cardLogoNode, type CardLogo } from '@/lib/social/card-logo';
import { shareCardLookToken } from '@/lib/social/share-card-look';
import { heroMarkSvg } from '@/lib/hero-monogram-data';
import { ogCardUrlFor } from '@/lib/a-withdrawal-reaches-every-copy';
import { stripComments } from '@/lib/strip-comments';

const WEB = dirname(fileURLToPath(import.meta.url)).replace(/\/lib\/social$/, '');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** A real drawn logo — the gold Setnayan mark, the shape every studio-written mark takes. */
const LOGO_FILE = read('public/brand/setnayan-mark.svg');
const LOGO = LOGO_FILE.slice(LOGO_FILE.indexOf('<svg'));
/** Its ink, measured: the mark is drawn in one gold. */
const isGold = (r: number, g: number, b: number) => Math.abs(r - 201) < 40 && Math.abs(g - 157) < 40 && Math.abs(b - 75) < 50;

const row = (logo_wanted: boolean | null | undefined, svg: string | null = LOGO) => ({
  monogram_custom_svg: svg,
  monogram_uploaded_svg: null,
  role_palette: {},
  logo_wanted,
});

/** Draw the card's logo slot exactly as the card does (satori → sharp) and count the logo's ink. */
async function goldPixelsOf(logo: CardLogo): Promise<number> {
  const tree = {
    type: 'div',
    props: {
      style: { width: '600px', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBFBFA' },
      children: [cardLogoNode(logo)],
    },
  };
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], { width: 600, height: 300, fonts: [] });
  const { data, info } = await sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) if (isGold(data[i]!, data[i + 1]!, data[i + 2]!)) n += 1;
  return n;
}

test('🖼 a logo that is set AND wanted is DRAWN — its ink is in the rendered picture', async () => {
  for (const wanted of [true, null] as const) {
    const logo = await cardLogoImage(heroMarkSvg(row(wanted)));
    assert.ok(logo, `logo_wanted=${wanted}: the card's logo step returned nothing — the preview would show initials`);
    assert.match(logo!.src, /^data:image\/png;base64,/, 'the card must draw an inert raster, never the stored SVG');
    const gold = await goldPixelsOf(logo!);
    assert.ok(gold > 2000, `logo_wanted=${wanted}: only ${gold} pixels of the logo's ink were drawn`);
  }
});

test('🔘 switched off, unset, unsafe, blank, broken or slow ⇒ no logo, so the card draws the initials', async () => {
  assert.equal(heroMarkSvg(row(false)), null, 'with the switch OFF the share card would still draw the logo');
  assert.equal(await cardLogoImage(heroMarkSvg(row(false))), null);
  assert.equal(await cardLogoImage(heroMarkSvg(row(true, null))), null, 'no logo set must mean initials');
  assert.equal(
    heroMarkSvg(row(true, '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>')),
    null,
    'the safety gate must refuse a hostile mark before the card ever sees it',
  );
  assert.equal(
    await cardLogoImage('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10 L90 90" fill="none"/></svg>'),
    null,
    'a mark that draws nothing must not become a blank box on the share card',
  );
  assert.equal(await cardLogoImage('<svg not really'), null, 'a mark sharp cannot read must fall back, never throw');
  assert.equal(await cardLogoImage(LOGO, { timeoutMs: 0 }), null, 'a raster past its time limit must fall back');
});

test('🧵 the card is WIRED to draw it: the route resolves the cover’s mark and every monogram card receives it', () => {
  const route = stripComments(read('app/api/og/realstory-slug/[slug]/route.ts'));
  const select = /\.from\('events'\)\s*\.select\(\s*'([^']*)'/.exec(route);
  assert.ok(select, 'the route no longer reads the event with one literal select — re-aim this guard');
  const cols = select![1]!.split(',').map((c) => c.trim());
  for (const c of ['monogram_custom_svg', 'monogram_uploaded_svg', 'role_palette', 'logo_wanted']) {
    assert.ok(cols.includes(c), `the share card's read lost ${c} — ${c === 'logo_wanted' ? 'the switch would read as "on"' : 'the logo would not draw as the cover draws it'}`);
  }
  assert.match(route, /logoSvg = heroMarkSvg\(event\)/, 'the route must resolve the logo through the cover’s own heroMarkSvg');
  const calls = route.match(/renderCoupleMonogramOgJpeg\(\{[^}]*\}/g) ?? [];
  assert.ok(calls.length >= 2, `anti-vacuity: expected both monogram cards (invitation + chosen monogram cover), found ${calls.length}`);
  for (const call of calls) assert.match(call, /\blogoSvg,/, 'a monogram share card is rendered without the logo');

  const card = stripComments(read('lib/social/realstory-card.tsx'));
  const render = card.slice(card.indexOf('export async function renderCoupleMonogramOgJpeg'));
  assert.match(render, /const logo = await cardLogoImage\(input\.logoSvg\);[\s\S]{0,200}monogramCardTree\(input, logo\)/, 'the renderer no longer hands the drawn logo to the card');
  const tree = card.slice(card.indexOf('function monogramCardTree'), card.indexOf('export async function renderCoupleMonogramOgJpeg'));
  assert.match(tree, /logo\s*\?\s*cardLogoNode\(logo\)\s*:\s*el\(/, 'the card no longer draws the logo in the initials’ place');
  assert.match(tree, /^\s+initials,$/m, 'the initials fallback is gone — a card with no logo would draw nothing');
});

test('🔗 the share card’s address moves with the mark it draws — a new logo or a flipped switch is a new address', () => {
  const site = 'https://www.setnayan.com';
  const at = '2026-10-20T00:00:00.000Z';
  const withLogo = shareCardLookToken({ markSvg: heroMarkSvg(row(true)), monogramText: null, monogramColor: '#C97B4B' });
  const switchedOff = shareCardLookToken({ markSvg: heroMarkSvg(row(false)), monogramText: null, monogramColor: '#C97B4B' });
  const otherLogo = shareCardLookToken({ markSvg: LOGO.replace('</svg>', '<circle cx="1" cy="1" r="1"/></svg>'), monogramText: null, monogramColor: '#C97B4B' });
  assert.notEqual(withLogo, switchedOff, 'flipping the Logo switch left the address unchanged — crawlers keep the old face');
  assert.notEqual(withLogo, otherLogo, 'a new logo left the address unchanged — crawlers keep the old face');
  assert.equal(withLogo, shareCardLookToken({ markSvg: heroMarkSvg(row(true)), monogramText: null, monogramColor: '#C97B4B' }), 'the token must be stable for an unchanged look');
  assert.equal(ogCardUrlFor(site, 'cale-ice', at, withLogo), `${site}/api/og/realstory-slug/cale-ice?v=${Math.floor(Date.parse(at) / 1000)}&look=${withLogo}`);
  assert.equal(ogCardUrlFor(site, 'cale-ice', null, withLogo), `${site}/api/og/realstory-slug/cale-ice?look=${withLogo}`);

  const page = stripComments(read('app/[slug]/page.tsx'));
  assert.match(
    page,
    /ogCardUrlFor\(\s*siteUrl,\s*event\.slug,\s*shareState\.versionAt,\s*shareCardLookToken\(\{\s*markSvg: heroMarkSvg\(event\)/,
    'the page’s og:image no longer carries the look of the mark — a changed logo would keep its cached preview',
  );
});
