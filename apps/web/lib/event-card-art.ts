/**
 * Event-card ART — what the picture on a home EVENTS card is allowed to be.
 *
 * Two layers, in precedence order:
 *
 *   1. THE EVENT'S OWN HERO. `events.landing_page_hero_image_url` is the
 *      couple's own guest-site hero. When it exists it IS the card's picture —
 *      nothing derived can beat the real photograph. `renderableImageSrc()` is
 *      the guard on it (the column is host-writable straight through PostgREST,
 *      so the value reaching an `<img src>` must be proven to be an image URL,
 *      not a `javascript:` / `data:` string).
 *
 *   2. THE PER-EVENT TREATMENT. With no own hero the card falls back to the
 *      per-TYPE stock photo — and every wedding on the platform is the same
 *      photograph, so two weddings on one home row read as duplicates. (Owner
 *      found exactly this on his phone, 2026-08-01: two cards, one stranger's
 *      wedding, same fence, same sky.) `eventCardTreatment()` derives a stable
 *      colour wash + a stable crop from the `event_id`, so two events of the
 *      same type are distinguishable at a glance while the stock photo still
 *      says what TYPE the event is.
 *
 * ── LEGIBILITY IS THE CONSTRAINT ────────────────────────────────────────────
 * The card sets a white title, a white type-badge pill and the monogram over
 * this band. The treatment is therefore bounded so it can NEVER make any of
 * them harder to read than the un-treated card already can:
 *
 *   • The wash is painted UNDER the card's existing legibility scrim
 *     (`from-ink/90 via-ink/45 to-ink/10`), never over it and never instead
 *     of it — so the scrim's guarantee at the title is untouched.
 *   • Every wash colour is capped at `L = 38%` lightness, which is strictly
 *     darker than the brightest thing the un-washed card can already show (a
 *     blown-out white sky). Since the wash can only ever pull the composite
 *     DOWN in luminance, white text over it is never worse than white text
 *     over the bare photo. `event-card-art.test.ts` proves this numerically
 *     for all 360 hues at four scrim depths, against both a pure-white and a
 *     pure-black photo.
 *   • The crop only ever moves the frame UP (`<= 50%`, the shipped default),
 *     never down — the type photos put their subject at or above centre, so a
 *     subject visible today can never be pushed out of frame by this.
 *
 * ── WHY THE FRAMING CARRIES THIS, NOT THE COLOUR ────────────────────────────
 * The first cut derived a hue and nothing else. Its unit test, run against the
 * three REAL wedding rows in prod, failed immediately: two of the owner's own
 * weddings both hash to hue 132. That is not a bad hash (the distribution over
 * 360 buckets is uniform to ±10%) — it is that a hue is a ~1-in-360 signal at
 * best and perceptually more like 1-in-18, so two events out of a handful
 * sharing a colour cast is ordinary, not unlucky.
 *
 * The deeper point survived the fix: a colour cast does not answer the actual
 * complaint. "Same couple, same fence, same sky" stays true under any tint. So
 * the load-bearing axes here are the ones that change the PICTURE —
 *
 *   • MIRROR   (2) — the couple faces the other way, the gazebo crosses the
 *                    frame. The strongest signal available, and free.
 *   • CROP     (4) — which slice of a 4:5 asset a ~2:1 band shows. Stops are
 *                    8 points apart, ~17px of a 144px band, deliberately
 *                    coarse: a 5-point ladder was measurably too subtle.
 *   • ZOOM     (3) — how much of the scene is in shot at all.
 *
 * — giving 24 distinct FRAMINGS of the one asset. Hue (360) and wash angle (6)
 * then sit on top as the colour grade, which is what keeps the row reading as
 * one family rather than a ransom note. Every axis is re-hashed from its own
 * salt so a collision on one drags nothing along with it.
 */

// ---------------------------------------------------------------------------
// Deterministic hashing
// ---------------------------------------------------------------------------

/**
 * The event-TYPE placeholder hash, kept verbatim — a running `*31` fold taken
 * mod 360. `eventTypePlaceholderGradient()` in create-event/_components/
 * event-types.ts is its only caller and imports it from here rather than
 * carrying its own copy; the arithmetic is unchanged, so every existing type
 * gradient renders byte-identical.
 *
 * It is NOT reused for the per-event treatment below: folding mod 360 on every
 * step throws away all the entropy above the hue, and the treatment needs
 * several fields that do not correlate with each other.
 */
export function hashToHue(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}

/**
 * FNV-1a, 32-bit, followed by the murmur3 `fmix32` finalizer.
 *
 * Deterministic everywhere: no `Math.random`, no clock, no locale, no `Intl`.
 * Server render and client hydration compute the identical value, which is
 * why the treatment can be derived inside the client island without a
 * hydration mismatch.
 *
 * ⚠ THE FINALIZER IS NOT DECORATION — DO NOT DROP IT. Raw FNV-1a avalanches
 * upward only: the last byte XORs into the low 8 bits and the multiply
 * carries influence toward the HIGH bits, never back down. So two inputs
 * sharing a long prefix (`<uuid>:hue` and `<uuid>:crop`) land on strongly
 * related LOW bits — and `% 6` / `% 2` / `% 360` read exactly those. The
 * first cut of this shipped without the finalizer and the independence test
 * measured a 0.330 correlation between the "independent" axes where 0.083 was
 * expected: a hue collision was dragging the crop and the mirror along with
 * it, which is the whole failure this module exists to prevent. fmix32 mixes
 * high bits back down, so every output bit depends on every input bit.
 */
export function stableHash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // murmur3 fmix32 — full avalanche.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// The treatment
// ---------------------------------------------------------------------------

/**
 * Vertical `object-position` stops for the stock photo, as percentages.
 *
 * ⚠ ALL AT OR ABOVE 50% — the shipped default. `object-cover` on 4:5 art in a
 * ~2:1 band crops vertically by a lot (a 880×1100 asset scales to ~356px tall
 * inside a 144px band), so moving the frame is a genuinely different picture.
 * But the stock photos all place their subject at or above centre — the
 * wedding couple sits at ~20% height, the birthday and corporate faces at
 * ~38% — so moving the frame DOWN would crop the people out. Every stop is
 * therefore <= 50%: the treatment can only ever reveal more of the subject
 * than the card shows today, never less.
 *
 * FOUR stops, not six: at six the ladder stepped 5 points, ~10px of a 144px
 * band, which is not a difference anyone notices. Coarse beats granular here.
 */
export const EVENT_CARD_CROP_STOPS = [26, 34, 42, 50] as const;

/**
 * Zoom stops for the stock photo. Changes how much of the scene is in shot,
 * which reads as a different frame far more strongly than a nudge of the crop
 * does. Capped at 1.3: the assets are 880px wide and a card band is ~285px,
 * so even the tightest stop resamples well under 1:1 — no softening.
 */
export const EVENT_CARD_ZOOM_STOPS = [1, 1.15, 1.3] as const;

/** Wash gradient angles, in CSS degrees. Six directions, one per hash slice. */
export const EVENT_CARD_WASH_ANGLES = [120, 155, 190, 215, 250, 300] as const;

/** Hue offset between the wash's near stop and its far stop. */
export const EVENT_CARD_WASH_HUE_SPREAD = 38;

/** One stop of the wash gradient, as numbers so tests can composite it. */
export type EventCardWashStop = {
  /** 0–359. */
  hue: number;
  /** HSL saturation, percent. */
  saturation: number;
  /**
   * HSL lightness, percent. ⚠ Capped at 38 — see the legibility note at the
   * top of this file. Raising it invalidates the "the wash can only darken"
   * proof that the contrast test rests on.
   */
  lightness: number;
  /** 0–1. */
  alpha: number;
  /** Gradient position, percent. */
  position: number;
};

export type EventCardTreatment = {
  /** Near-stop hue, 0–359. */
  hue: number;
  /** Far-stop hue, 0–359. */
  hue2: number;
  /** CSS gradient angle, degrees. */
  angle: number;
  /** CSS `object-position` for the stock photo — a different crop of it. */
  objectPosition: string;
  /**
   * Flip the stock photo horizontally. The strongest differentiator of the
   * four and the cheapest: a mirrored photograph reads as a DIFFERENT
   * photograph (the couple faces the other way, the gazebo moves across the
   * frame) at zero contrast cost.
   *
   * ⚠ Applies ONLY to the type stock art, never to the couple's own hero —
   * nobody's own wedding photo gets flipped. The stock set carries no text
   * or signage, which is the one thing a mirror would betray.
   */
  mirrored: boolean;
  /** Zoom factor applied to the stock photo — one of EVENT_CARD_ZOOM_STOPS. */
  zoom: number;
  /**
   * Ready-to-use CSS `transform` folding the mirror and the zoom together, for
   * the WRAPPER around the stock photo. It has to be a wrapper, not the image:
   * the image already carries `group-hover:scale-[1.04]`, and a Tailwind scale
   * utility overwrites `--tw-scale-x`, so a mirror applied there would flip
   * back on hover. Composing two elements' transforms cannot collide.
   * `'none'` when the event draws the identity framing.
   */
  photoTransform: string;
  /** The wash stops, as numbers. */
  stops: EventCardWashStop[];
  /** Ready-to-use CSS `background` for the wash layer. */
  wash: string;
};

/**
 * The wash's fixed shape. Only the HUE and the ANGLE vary per event — the
 * saturation / lightness / alpha ladder is constant so every card in the grid
 * reads as one family (a colour grade), not a bag of random tints.
 *
 * Saturation is deliberately mid (46/40, not the 58+ that would make the hue
 * obvious): at full 360-hue freedom a high saturation puts acid green and hot
 * magenta on a wedding photo. Muted hues stay on-brand at every angle of the
 * wheel, which is what lets the hue range stay full — and a full range is what
 * keeps two events from colliding.
 */
const WASH_SHAPE = {
  near: { saturation: 46, lightness: 38, alpha: 0.4, position: 0 },
  mid: { saturation: 40, lightness: 24, alpha: 0.2, position: 58 },
  far: { saturation: 40, lightness: 24, alpha: 0, position: 100 },
} as const;

/** The largest alpha any wash stop may carry. */
export const EVENT_CARD_WASH_MAX_ALPHA = WASH_SHAPE.near.alpha;

/** The largest lightness any wash stop may carry (the legibility cap). */
export const EVENT_CARD_WASH_MAX_LIGHTNESS = WASH_SHAPE.near.lightness;

function stopCss(s: EventCardWashStop): string {
  // Explicit `/ 0` rather than the `transparent` keyword for the final stop:
  // `transparent` is rgba(0,0,0,0) and older interpolation muddies the fade
  // toward black. Same hue at zero alpha fades cleanly.
  return `hsl(${s.hue} ${s.saturation}% ${s.lightness}% / ${s.alpha}) ${s.position}%`;
}

/**
 * The stable per-event treatment. Pure: same `eventId` → same treatment, for
 * ever, on any runtime.
 *
 * Each axis is re-hashed from its OWN salt rather than cut from bit slices of
 * one hash, so no two axes can correlate — the reason a hue collision (which
 * will happen; 360 buckets) does not drag the framing along with it.
 * 360 hues × 6 angles × 4 crops × 2 mirrors × 3 zooms = 51,840 combinations,
 * of which 24 are distinct FRAMINGS of the photo.
 */
export function eventCardTreatment(eventId: string): EventCardTreatment {
  const hue = stableHash32(`${eventId}:hue`) % 360;
  const hue2 = (hue + EVENT_CARD_WASH_HUE_SPREAD) % 360;
  const angle =
    EVENT_CARD_WASH_ANGLES[
      stableHash32(`${eventId}:angle`) % EVENT_CARD_WASH_ANGLES.length
    ]!;
  const cropY =
    EVENT_CARD_CROP_STOPS[
      stableHash32(`${eventId}:crop`) % EVENT_CARD_CROP_STOPS.length
    ]!;
  const mirrored = stableHash32(`${eventId}:mirror`) % 2 === 1;
  const zoom =
    EVENT_CARD_ZOOM_STOPS[
      stableHash32(`${eventId}:zoom`) % EVENT_CARD_ZOOM_STOPS.length
    ]!;

  const stops: EventCardWashStop[] = [
    { hue, ...WASH_SHAPE.near },
    { hue: hue2, ...WASH_SHAPE.mid },
    { hue: hue2, ...WASH_SHAPE.far },
  ];

  const sx = mirrored ? -zoom : zoom;
  const photoTransform =
    !mirrored && zoom === 1 ? 'none' : `scale(${sx}, ${zoom})`;

  return {
    hue,
    hue2,
    angle,
    // Horizontal stays centred: 4:5 art inside a wide band is scaled to fill
    // the WIDTH, so there is no horizontal overflow to move through.
    objectPosition: `50% ${cropY}%`,
    mirrored,
    zoom,
    photoTransform,
    stops,
    wash: `linear-gradient(${angle}deg, ${stops.map(stopCss).join(', ')})`,
  };
}

/**
 * A stable fingerprint of the FRAMING alone — crop, mirror, zoom. Two cards
 * sharing this show the same slice of the same photograph and are only a
 * colour cast apart, which is precisely what the owner reported. This is the
 * axis the tests hold to the higher bar.
 */
export function eventCardFramingKey(t: EventCardTreatment): string {
  return `${t.objectPosition}|${t.mirrored ? 'm' : 'n'}|${t.zoom}`;
}

/** A stable fingerprint of everything the treatment changes. */
export function eventCardArtKey(t: EventCardTreatment): string {
  return `${t.hue}|${t.angle}|${eventCardFramingKey(t)}`;
}

// ---------------------------------------------------------------------------
// The own-hero guard
// ---------------------------------------------------------------------------

/**
 * Narrow a resolved hero URL to something that may become an `<img src>`.
 *
 * `events.landing_page_hero_image_url` is host-writable through PostgREST, and
 * `displayUrlForStoredAsset()` passes any value that is not a recognised
 * `r2://bucket/key` ref straight through as a "legacy URL". So the value
 * arriving here is attacker-controllable in principle. Only `https:` absolute
 * URLs and same-origin root-relative paths are allowed through; everything
 * else (`javascript:`, `data:`, `//host`, plain `http:` — which the browser
 * would block as mixed content anyway) resolves to null and the card falls
 * back to the type scene.
 */
export function renderableImageSrc(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  // Root-relative, but never protocol-relative `//evil.example`.
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (!/^https:\/\/\S+$/i.test(trimmed)) return null;
  return trimmed;
}
