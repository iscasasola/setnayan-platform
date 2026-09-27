/**
 * lib/hero-design.ts — THE HERO'S FOUR DESIGNS, a starting point each.
 *
 * Owner, 2026-09-26 (DECISION_LOG "A HERO DESIGN IS A STARTING POINT; EVERY
 * PART OF IT IS TAP-TO-EDIT"): *"the hero when we pick that can click on the
 * elements and edit it on the editor"* · *"designs are the initial design, they
 * can always improve it."* And the same day, "HERO TEMPLATES: DESIGN 5 … IS
 * DROPPED": the set is 1 The Card (live, the default) · 2 The Marquee · 3 The
 * Crest · 4 The Letter. Approved prototype:
 * `prototypes/hero_scene_templates_2026-09-25.html` — *"same content,
 * different arrangement"*.
 *
 * A design lays out the SAME parts (eyebrow · mark · names · joiner · line ·
 * date · time, and the Happening-now pill); it never adds a part or a word.
 * Every part stays the tap-to-edit element it already is (`lib/element-style.ts`
 * — font · colour · size · In/During/Out per part), so a couple's edits ride
 * with them across designs: `elements` is a sibling key, untouched by a pick.
 *
 * ── WHERE IT LIVES ─────────────────────────────────────────────────────────
 * `invitation_widgets.config_json.canvas.design` on the hero row — the same
 * canvas `elements` lives on. No table, no column, no migration. Drafted like
 * every other canvas key (`hubDraftAction` intent=save, the whole canvas).
 *
 * 🔓 NOT A PRO LOOK KEY (an open controller question, deliberately answered in
 * the free direction until ruled): the 2026-09-25 Pro list names fonts,
 * colours, media backgrounds and motion — never the arrangement of the free
 * card's own parts. A scene's `template` is free the same way. To make it Pro,
 * add `'design'` to `HUB_CANVAS_LOOK_KEYS` (`lib/hub-look-pro.ts`); nothing
 * else changes.
 *
 * Absent = `card`, which is the absence rule every canvas key follows ("Auto is
 * an absence", `lib/hub-canvas.ts`): storing `card` would freeze today's
 * default into the couple's page.
 *
 * Pure. No I/O.
 */

export const HERO_DESIGNS = ['card', 'marquee', 'crest', 'letter'] as const;
export type HeroDesignId = (typeof HERO_DESIGNS)[number];

export const HERO_DESIGN_DEFAULT: HeroDesignId = 'card';

/** "Design 1 · The Card" — the number the owner uses, and the name. */
export const HERO_DESIGN_LABEL: Record<HeroDesignId, { n: 1 | 2 | 3 | 4; name: string; suits: string }> = {
  card: {
    n: 1,
    name: 'The Card',
    suits: 'Church weddings and print — the invitation is a card, and this reads like one.',
  },
  marquee: {
    n: 2,
    name: 'The Marquee',
    suits: 'Your names are the art — big, centred, with a small mark above.',
  },
  crest: {
    n: 3,
    name: 'The Crest',
    suits: 'For a logo you love — the mark is the event, your names sit under it like a seal.',
  },
  letter: {
    n: 4,
    name: 'The Letter',
    suits: 'Ranged left and low, like a magazine cover — the mark sits in the corner.',
  },
};

export function heroDesignLabel(id: HeroDesignId): string {
  const d = HERO_DESIGN_LABEL[id];
  return `Design ${d.n} · ${d.name}`;
}

export function isHeroDesignId(v: unknown): v is HeroDesignId {
  return typeof v === 'string' && (HERO_DESIGNS as readonly string[]).includes(v);
}

/**
 * A stored design, or null (= the default). Only a member of the closed set
 * survives, and `card` — the default — is stored as an absence, never as a
 * value (the direction rule every canvas key follows).
 */
export function sanitizeHeroDesign(raw: unknown): Exclude<HeroDesignId, 'card'> | null {
  if (!isHeroDesignId(raw) || raw === 'card') return null;
  return raw;
}

/** The design a canvas wears: its `design`, else the default. */
export function heroDesignOf(canvas: { design?: HeroDesignId } | null | undefined): HeroDesignId {
  return canvas?.design ?? HERO_DESIGN_DEFAULT;
}

/**
 * The canvas with this design picked — every other key (the couple's per-part
 * `elements`, the background, the motion) rides along untouched, which is what
 * lets an edit survive a change of design where the part exists in both.
 */
export function withHeroDesign<T extends { design?: HeroDesignId }>(canvas: T, design: HeroDesignId): T {
  const next = { ...canvas };
  if (design === HERO_DESIGN_DEFAULT) delete next.design;
  else next.design = design;
  return next;
}

/**
 * ⚠ THE LETTER PUTS THE NAMES LOW. The navigator tile and the event cover are
 * cut from the TOP of the hero (`lib/maker-tile-preview.ts`, `overflow:hidden`),
 * so a top crop of The Letter shows the mark in a corner and no names — the
 * finding recorded with the design set ("its cover needs its own crop, anchor
 * on the names"). Where the names sit tells the crop which edge to keep.
 */
export function heroDesignCropAnchor(design: HeroDesignId): 'top' | 'bottom' {
  return design === 'letter' ? 'bottom' : 'top';
}

/** The hero root's `data-hero-design` — stamped only off the default, so the shipped card's markup is untouched. */
export const HERO_DESIGN_ATTR = 'data-hero-design';
