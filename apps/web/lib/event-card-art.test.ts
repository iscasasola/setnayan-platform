/**
 * Unit suite for the event-card art derivation.
 *
 * Two things are load-bearing and both are proved here rather than eyeballed:
 *
 *   1. DETERMINISM + DISCRIMINATION — same event_id always yields the same
 *      treatment (a card must not shuffle between renders), different ids
 *      yield different ones (the whole point: two weddings must stop looking
 *      like the same photograph).
 *
 *   2. LEGIBILITY — the card sets a WHITE title and a white type-badge pill
 *      over this band. The wash must never make either harder to read than the
 *      un-washed card already can. That is asserted numerically across the
 *      FULL hue range (all 360), at four scrim depths, against both a pure
 *      white photo (the blown-out-sky extreme) and a pure black one.
 *
 * The compositing model mirrors the real stack in event-scene.tsx, bottom to
 * top:  type photo  →  the wash  →  the scrim  ( →  the badge pill ).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_CARD_CROP_STOPS,
  EVENT_CARD_WASH_ANGLES,
  EVENT_CARD_WASH_MAX_ALPHA,
  EVENT_CARD_WASH_MAX_LIGHTNESS,
  EVENT_CARD_ZOOM_STOPS,
  eventCardArtKey,
  eventCardFramingKey,
  eventCardTreatment,
  hashToHue,
  renderableImageSrc,
  stableHash32,
  type EventCardWashStop,
} from './event-card-art';

// ---------------------------------------------------------------------------
// Colour math (test-local — production has no need to composite anything)
// ---------------------------------------------------------------------------

type RGB = { r: number; g: number; b: number };

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };
/** --color-ink, light theme (globals.css `:root`) — espresso #2C2A29. The app
 *  is light-LOCKED (owner 2026-06-04), so this is the only ink that renders. */
const INK: RGB = { r: 44, g: 42, b: 41 };
/** --sn-gold-700 #8A6B39 — the type-badge label colour. */
const GOLD_700: RGB = { r: 138, g: 107, b: 57 };

function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(c: RGB): number {
  return (
    0.2126 * srgbToLinear(c.r) +
    0.7152 * srgbToLinear(c.g) +
    0.0722 * srgbToLinear(c.b)
  );
}

function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Source-over: `top` at `alpha` composited onto `base`, in sRGB (what the
 *  browser does for a plain translucent layer). */
function over(top: RGB, alpha: number, base: RGB): RGB {
  return {
    r: alpha * top.r + (1 - alpha) * base.r,
    g: alpha * top.g + (1 - alpha) * base.g,
    b: alpha * top.b + (1 - alpha) * base.b,
  };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const S = s / 100;
  const L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = L - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

function stopRgb(s: EventCardWashStop): RGB {
  return hslToRgb(s.hue, s.saturation, s.lightness);
}

/** Linear interpolation between two gradient stops — the pixels BETWEEN the
 *  declared stops are what actually covers most of the band. */
function lerpStop(
  a: EventCardWashStop,
  b: EventCardWashStop,
  t: number,
): { rgb: RGB; alpha: number } {
  const ca = stopRgb(a);
  const cb = stopRgb(b);
  return {
    rgb: {
      r: ca.r + (cb.r - ca.r) * t,
      g: ca.g + (cb.g - ca.g) * t,
      b: ca.b + (cb.b - ca.b) * t,
    },
    alpha: a.alpha + (b.alpha - a.alpha) * t,
  };
}

/** Every colour the wash can paint: the declared stops plus interpolations. */
function washSamples(
  stops: EventCardWashStop[],
): Array<{ rgb: RGB; alpha: number }> {
  const out: Array<{ rgb: RGB; alpha: number }> = stops.map((s) => ({
    rgb: stopRgb(s),
    alpha: s.alpha,
  }));
  for (let i = 0; i < stops.length - 1; i += 1) {
    for (const t of [0.25, 0.5, 0.75]) {
      out.push(lerpStop(stops[i]!, stops[i + 1]!, t));
    }
  }
  return out;
}

/**
 * The card's legibility scrim is `bg-gradient-to-t from-ink/90 via-ink/45
 * to-ink/10`. These are the depths the three overlaid elements actually sit
 * at, measured off the shipped markup in page.tsx:
 *   0.10 — the type badge (`top-3` in a 128–144px band)
 *   0.45 — the band's midpoint
 *   0.65 — the TOP EDGE of the title block (`inset-x-3 bottom-2.5`), the
 *          shallowest scrim any title pixel gets, i.e. the worst case
 *   0.90 — the very bottom
 */
const SCRIM_ALPHAS = [0.1, 0.45, 0.65, 0.9] as const;
/** Shallowest scrim the white title sits under — the case that must pass AA. */
const TITLE_SCRIM_ALPHA = 0.65;
/** The badge pill is `bg-white/85`; the backdrop bleeds through the other 15%. */
const BADGE_PILL_ALPHA = 0.85;
const BADGE_SCRIM_ALPHA = 0.1;

const PHOTO_EXTREMES: RGB[] = [WHITE, BLACK];

/**
 * Three event ids, standing in for the prod rows that once rendered the
 * identical photograph on the owner's home.
 *
 * ⚠ THESE USED TO BE THE REAL PROD IDS, and they are not any more. Two reasons,
 * and the second is the one that matters:
 *   • a high-entropy literal in a test is indistinguishable from a leaked key,
 *     and the secret scanner is right to say so rather than be taught the
 *     difference;
 *   • **nothing here ever needed a real row.** The property under test is that
 *     the treatment is a pure function of the id — pinning prod rows made the
 *     test read as though it verified something about those weddings, when it
 *     verifies arithmetic. If a couple is ever deleted, the pinned id would
 *     have kept passing while meaning nothing.
 */
const WEDDING_IDS = [
  '00000000-0000-4000-8000-00000000e001',
  '00000000-0000-4000-8000-00000000e002',
  '00000000-0000-4000-8000-00000000e003',
];

// ---------------------------------------------------------------------------
// 1 · Determinism + discrimination
// ---------------------------------------------------------------------------

test('the treatment is stable — same event_id always derives the same art', () => {
  for (const id of WEDDING_IDS) {
    const a = eventCardTreatment(id);
    const b = eventCardTreatment(id);
    assert.deepEqual(a, b);
    assert.equal(a.wash, b.wash);
    assert.equal(a.objectPosition, b.objectPosition);
  }
  // Stable across a fresh string with the same characters (no identity/memo
  // dependence — the treatment must survive a serialization round trip).
  const viaSplit = WEDDING_IDS[0]!.split('').join('');
  assert.deepEqual(
    eventCardTreatment(viaSplit),
    eventCardTreatment(WEDDING_IDS[0]!),
  );
});

test('THE DEFECT: the three real prod weddings no longer render the same picture', () => {
  const arts = WEDDING_IDS.map((id) => eventCardTreatment(id));
  const keys = new Set(arts.map(eventCardArtKey));
  assert.equal(
    keys.size,
    WEDDING_IDS.length,
    `two prod weddings still derive identical art: ${[...keys].join(' / ')}`,
  );

  // The bar that matters, and the one an earlier cut of this failed: every
  // PAIR must differ in the FRAMING — the slice of the photograph on screen —
  // not merely in its colour cast. "Same couple, same fence, same sky" stays
  // true under any tint, so a hue difference alone does not close the defect.
  const framings = new Set(arts.map(eventCardFramingKey));
  assert.equal(
    framings.size,
    WEDDING_IDS.length,
    `two prod weddings still show the SAME framing of the same photo, only a colour cast apart: ${[...framings].join(' / ')}`,
  );
});

test('different event ids derive different art at scale', () => {
  const ids = Array.from({ length: 2000 }, (_, i) => `evt-${i}-fixture`);
  const keys = new Set(ids.map((id) => eventCardArtKey(eventCardTreatment(id))));
  // 360 hues × 6 angles × 4 crops × 2 mirrors × 3 zooms = 51,840 combinations.
  // Drawing 2,000 with replacement, the expected distinct count is
  // 51840·(1−e^(−2000/51840)) ≈ 1,962 — so ≥97% is the honest bar, and
  // dropping below it means an axis has silently stopped varying.
  assert.ok(
    keys.size > ids.length * 0.97,
    `only ${keys.size} distinct treatments across ${ids.length} ids`,
  );
  // The framing space is small on purpose (24 slices), so it WILL repeat
  // across 2,000 events — but it must use all of it.
  const framings = new Set(
    ids.map((id) => eventCardFramingKey(eventCardTreatment(id))),
  );
  assert.equal(
    framings.size,
    EVENT_CARD_CROP_STOPS.length * 2 * EVENT_CARD_ZOOM_STOPS.length,
    `framing space under-used: ${framings.size} of 24`,
  );
  // Neighbouring ids (the realistic case — events created back to back) must
  // never share art.
  for (let i = 0; i < 500; i += 1) {
    assert.notEqual(
      eventCardArtKey(eventCardTreatment(`evt-${i}-fixture`)),
      eventCardArtKey(eventCardTreatment(`evt-${i + 1}-fixture`)),
    );
  }
});

test('the axes are independent — a hue collision drags the framing nothing with it', () => {
  // The salted re-hash is the reason this holds; bit-slicing one hash would
  // not (raw FNV-1a's low bits barely move between `id:hue` and `id:crop`,
  // which is why stableHash32 carries an fmix32 finalizer). Gather id pairs
  // that collide on hue and check the framing is still uniformly spread.
  const byHue = new Map<number, string[]>();
  for (let i = 0; i < 20000; i += 1) {
    const id = `independence-${i}`;
    const hue = eventCardTreatment(id).hue;
    byHue.set(hue, [...(byHue.get(hue) ?? []), id]);
  }
  let collidingPairs = 0;
  let alsoSameFraming = 0;
  for (const ids of byHue.values()) {
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < Math.min(ids.length, i + 6); j += 1) {
        collidingPairs += 1;
        if (
          eventCardFramingKey(eventCardTreatment(ids[i]!)) ===
          eventCardFramingKey(eventCardTreatment(ids[j]!))
        ) {
          alsoSameFraming += 1;
        }
      }
    }
  }
  assert.ok(collidingPairs > 1000, 'not enough hue collisions sampled');
  const rate = alsoSameFraming / collidingPairs;
  // Independent axes ⇒ P(same framing | same hue) = 1/24 ≈ 0.042. A
  // correlated derivation pushes this toward 1 (the pre-finalizer cut of this
  // module measured 0.330 against an expected 0.083).
  const expected = 1 / (EVENT_CARD_CROP_STOPS.length * 2 * EVENT_CARD_ZOOM_STOPS.length);
  assert.ok(
    rate > expected * 0.5 && rate < expected * 1.7,
    `framing is correlated with hue — same-framing rate ${rate.toFixed(3)}, expected ~${expected.toFixed(3)}`,
  );
});

test('the derived fields stay inside their declared domains', () => {
  for (let i = 0; i < 5000; i += 1) {
    const t = eventCardTreatment(`domain-probe-${i}`);
    assert.ok(t.hue >= 0 && t.hue < 360, `hue out of range: ${t.hue}`);
    assert.ok(t.hue2 >= 0 && t.hue2 < 360, `hue2 out of range: ${t.hue2}`);
    assert.ok(
      (EVENT_CARD_WASH_ANGLES as readonly number[]).includes(t.angle),
      `angle off the ladder: ${t.angle}`,
    );
    const cropY = Number(t.objectPosition.split(' ')[1]!.replace('%', ''));
    assert.ok(
      (EVENT_CARD_CROP_STOPS as readonly number[]).includes(cropY),
      `crop off the ladder: ${cropY}`,
    );
    assert.ok(
      (EVENT_CARD_ZOOM_STOPS as readonly number[]).includes(t.zoom),
      `zoom off the ladder: ${t.zoom}`,
    );
    // The transform must fold mirror + zoom and never LOSE either. A zoom
    // below 1 would letterbox the band; a positive scaleX would silently drop
    // the mirror.
    if (t.photoTransform === 'none') {
      assert.equal(t.mirrored, false);
      assert.equal(t.zoom, 1);
    } else {
      const [sx, sy] = /^scale\((-?[\d.]+), ([\d.]+)\)$/
        .exec(t.photoTransform)!
        .slice(1)
        .map(Number) as [number, number];
      assert.equal(sy, t.zoom);
      assert.equal(Math.abs(sx), t.zoom);
      assert.equal(sx < 0, t.mirrored);
      assert.ok(sy >= 1, 'zoom below 1 would letterbox the band');
    }
    for (const s of t.stops) {
      assert.ok(s.alpha <= EVENT_CARD_WASH_MAX_ALPHA);
      assert.ok(s.lightness <= EVENT_CARD_WASH_MAX_LIGHTNESS);
    }
  }
});

test('the crop only ever moves the frame UP from the shipped 50% default', () => {
  // The stock photos put their subject at or above centre (wedding couple at
  // ~20% height, birthday/corporate faces at ~38%). Any stop BELOW centre
  // would crop the people out of the card.
  for (const stop of EVENT_CARD_CROP_STOPS) {
    assert.ok(stop <= 50, `crop stop ${stop}% would frame lower than today`);
    assert.ok(stop >= 20, `crop stop ${stop}% frames too high off the subject`);
  }
  // The ladder must actually spread, or the crop is decorative.
  assert.ok(
    Math.max(...EVENT_CARD_CROP_STOPS) - Math.min(...EVENT_CARD_CROP_STOPS) >=
      20,
    'crop ladder too narrow to be visible',
  );
});

// ---------------------------------------------------------------------------
// 2 · Legibility across the FULL hue range
// ---------------------------------------------------------------------------

/** Composite the real stack for one hue/photo/scrim triple. */
function bandColor(
  wash: { rgb: RGB; alpha: number },
  photo: RGB,
  scrimAlpha: number,
): RGB {
  return over(INK, scrimAlpha, over(wash.rgb, wash.alpha, photo));
}

test('WHITE TITLE clears AA (4.5:1) on every hue the hash can produce', () => {
  let worst = Infinity;
  let worstAt = '';
  for (let hue = 0; hue < 360; hue += 1) {
    const t = eventCardTreatment('probe');
    const stops: EventCardWashStop[] = t.stops.map((s, i) => ({
      ...s,
      hue: i === 0 ? hue : (hue + 38) % 360,
    }));
    for (const sample of washSamples(stops)) {
      for (const photo of PHOTO_EXTREMES) {
        const band = bandColor(sample, photo, TITLE_SCRIM_ALPHA);
        const ratio = contrast(WHITE, band);
        if (ratio < worst) {
          worst = ratio;
          worstAt = `hue ${hue} · alpha ${sample.alpha.toFixed(2)} · photo ${photo === WHITE ? 'white' : 'black'}`;
        }
      }
    }
  }
  assert.ok(
    worst >= 4.5,
    `title falls below AA at ${worstAt} — ${worst.toFixed(2)}:1`,
  );
});

test('the wash can only DARKEN — white title contrast never drops below the un-washed card', () => {
  // The proof the lightness cap buys: every wash colour is darker than the
  // brightest pixel a photo can already show, so compositing it can only pull
  // the band down in luminance, never up. If that ever stops being true (say
  // someone raises the lightness cap), this test is the alarm.
  for (const scrim of SCRIM_ALPHAS) {
    const unwashedFloor = Math.min(
      ...PHOTO_EXTREMES.map((photo) => contrast(WHITE, over(INK, scrim, photo))),
    );
    for (let hue = 0; hue < 360; hue += 1) {
      const t = eventCardTreatment('probe');
      const stops: EventCardWashStop[] = t.stops.map((s, i) => ({
        ...s,
        hue: i === 0 ? hue : (hue + 38) % 360,
      }));
      for (const sample of washSamples(stops)) {
        for (const photo of PHOTO_EXTREMES) {
          const ratio = contrast(WHITE, bandColor(sample, photo, scrim));
          assert.ok(
            ratio >= unwashedFloor - 1e-9,
            `hue ${hue} at scrim ${scrim} made the title WORSE: ${ratio.toFixed(2)}:1 < ${unwashedFloor.toFixed(2)}:1`,
          );
        }
      }
    }
  }
});

test('TYPE BADGE — the wash never pushes the gold-on-white pill below its own un-washed floor', () => {
  // The badge is a `bg-white/85` pill with `--sn-gold-700` text. Over a dark
  // photo the pill darkens and gold-on-it already sits near 3.5:1 on main —
  // a PRE-EXISTING condition of the shipped card, not something the wash
  // introduces. So the assertion here is non-regression, not an absolute
  // floor: the treatment may not make it any worse than it already gets.
  const unwashedFloor = Math.min(
    ...PHOTO_EXTREMES.map((photo) =>
      contrast(
        GOLD_700,
        over(WHITE, BADGE_PILL_ALPHA, over(INK, BADGE_SCRIM_ALPHA, photo)),
      ),
    ),
  );
  let worst = Infinity;
  let worstAt = '';
  for (let hue = 0; hue < 360; hue += 1) {
    const t = eventCardTreatment('probe');
    const stops: EventCardWashStop[] = t.stops.map((s, i) => ({
      ...s,
      hue: i === 0 ? hue : (hue + 38) % 360,
    }));
    for (const sample of washSamples(stops)) {
      for (const photo of PHOTO_EXTREMES) {
        const pill = over(
          WHITE,
          BADGE_PILL_ALPHA,
          bandColor(sample, photo, BADGE_SCRIM_ALPHA),
        );
        const ratio = contrast(GOLD_700, pill);
        if (ratio < worst) {
          worst = ratio;
          worstAt = `hue ${hue} · photo ${photo === WHITE ? 'white' : 'black'}`;
        }
      }
    }
  }
  assert.ok(
    worst >= unwashedFloor - 1e-9,
    `badge regressed at ${worstAt}: ${worst.toFixed(2)}:1 < un-washed floor ${unwashedFloor.toFixed(2)}:1`,
  );
});

test("MONOGRAM's white ring stays visible — the band under it never goes near-white", () => {
  // The monogram overhangs the band's bottom-right on a `border-2
  // border-white/80` ring. It needs the band behind it to stay clearly darker
  // than the ring; the bottom scrim (0.90) plus the wash guarantee that.
  for (let hue = 0; hue < 360; hue += 1) {
    const t = eventCardTreatment('probe');
    const stops: EventCardWashStop[] = t.stops.map((s, i) => ({
      ...s,
      hue: i === 0 ? hue : (hue + 38) % 360,
    }));
    for (const sample of washSamples(stops)) {
      for (const photo of PHOTO_EXTREMES) {
        const band = bandColor(sample, photo, 0.9);
        assert.ok(
          contrast(WHITE, band) >= 4.5,
          `hue ${hue}: white ring only ${contrast(WHITE, band).toFixed(2)}:1 on the band`,
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 3 · The own-hero guard
// ---------------------------------------------------------------------------

test('renderableImageSrc admits https + root-relative, rejects everything else', () => {
  assert.equal(
    renderableImageSrc('https://cdn.example.com/hero.jpg?sig=abc'),
    'https://cdn.example.com/hero.jpg?sig=abc',
  );
  assert.equal(renderableImageSrc('  /event-types/wedding.webp  '), '/event-types/wedding.webp');
  assert.equal(renderableImageSrc('HTTPS://CDN.EXAMPLE.COM/a.png'), 'HTTPS://CDN.EXAMPLE.COM/a.png');

  for (const hostile of [
    null,
    undefined,
    '',
    '   ',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    '//evil.example.com/hero.jpg',
    'http://insecure.example.com/hero.jpg',
    'vbscript:msgbox(1)',
    'r2://event-media/some/key.jpg',
    'https://has space/hero.jpg',
  ]) {
    assert.equal(renderableImageSrc(hostile), null, `let through: ${String(hostile)}`);
  }
});

// ---------------------------------------------------------------------------
// 4 · The hash shared with the event-TYPE gradient
// ---------------------------------------------------------------------------

test('hashToHue is unchanged — every existing type gradient renders identically', () => {
  // Recompute with the pre-extraction arithmetic, verbatim.
  const original = (key: string) => {
    let h = 0;
    for (let i = 0; i < key.length; i += 1)
      h = (h * 31 + key.charCodeAt(i)) % 360;
    return h;
  };
  for (const key of [
    'wedding',
    'debut',
    'birthday',
    'gender_reveal',
    'celebration',
    'travel',
    'corporate',
    'tournament',
    'christening',
    'date',
    'hangout',
    'graduation',
    'reunion',
    'anniversary',
    'gala_night',
    'simple_event',
    '',
  ]) {
    assert.equal(hashToHue(key), original(key), `type hue drifted for "${key}"`);
  }
});

test('stableHash32 is a deterministic unsigned 32-bit value', () => {
  for (const id of WEDDING_IDS) {
    const h = stableHash32(id);
    assert.equal(h, stableHash32(id));
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
  }
  assert.notEqual(stableHash32('a'), stableHash32('b'));
  // Low-bit avalanche: inputs sharing a long prefix must not share low bits.
  // Raw FNV-1a (no fmix32 finalizer) fails this badly, which is what made the
  // four "independent" axes correlate.
  //
  // ⚠ THIS USED TO PIN ONE REAL PROD EVENT ID, and swapping it for a synthetic
  // one would have meant picking a value that happens to pass — fitting the
  // test to its input, which is how an assertion stops meaning anything.
  // Measured across many ids instead, which is the property actually claimed.
  //
  // The arithmetic: four salted hashes land in 64 low-bit buckets, so a good
  // finalizer gives all four distinct about 91% of the time
  // (64·63·62·61 / 64⁴). Raw FNV-1a with no finalizer shares low bits on almost
  // every input, so it lands near zero. A floor of 75% sits wide of both.
  let allDistinct = 0;
  const TRIALS = 200;
  for (let i = 0; i < TRIALS; i++) {
    const base = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const lowBits = new Set(
      [':hue', ':angle', ':crop', ':mirror'].map(
        (salt) => stableHash32(`${base}${salt}`) & 0x3f,
      ),
    );
    if (lowBits.size === 4) allDistinct++;
  }
  assert.ok(
    allDistinct >= TRIALS * 0.75,
    `salted hashes share low bits on ${TRIALS - allDistinct}/${TRIALS} ids — finalizer lost?`,
  );
});
