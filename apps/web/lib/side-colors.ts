// ---------------------------------------------------------------------------
// Side-of-wedding colour language — the ONE canonical map (2026-07-16).
//
// The Atelier/glass reskin (owner-locked 2026-07-12) retinted the Guests
// roster RowAvatar to the design-system side identity — bride → GOLD family
// (`--sn-gold-*` = Tailwind `warn`), groom → INFO-SLATE (`--sn-info` =
// Tailwind `info`), both → a LIGHTER gold blend (`--sn-gold-300` = `warn-300`).
// But that retint never propagated: the facet dots, card rings, breadcrumb
// chips, the guest-detail tint, the groups sidebar, the mind-map, and a dozen
// other side cues were still rendering bride in ROSE (`danger`) + groom in
// BLUE (`sky`) + both in PURPLE (`violet`). Two contradictory palettes for the
// same three sides on the same screens.
//
// This module is the single source consumed by BOTH the Guests tree and the
// seating chart. Every side cue is derived from three anchors:
//
//     bride  →  gold-500  (warn-500)  — the couple's deep gold
//     groom  →  info-600  (info)      — the slate contrast
//     both   →  gold-300  (warn-300)  — a lighter gold (leans to the couple)
//
// bride vs both share the gold family (as the reskin intended — "both" is the
// couple's blended gold, not a third hue); they read apart by SHADE (bride
// deeper, both lighter), exactly like the seat-map dots. groom is the clear
// slate contrast. All text tones clear the guest-legibility contrast floor
// (warn-900 / info-900 on the pale tints).
//
// Recipe shapes are named per the surfaces that consume them. Raw hex is only
// for the inline-SVG seat map (SIDE_HEX); everything else is Tailwind classes.
// ---------------------------------------------------------------------------

export type Side = 'bride' | 'groom' | 'both';

// Solid hex (inline SVG chairs + avatar chips on the seat map — can't take
// Tailwind classes). Mirrors the warn/info anchors above.
export const SIDE_HEX: Record<Side, string> = {
  bride: '#A9834B', // --sn-gold-500 / warn-500
  groom: '#4E6C82', // --sn-info      / info-600
  both: '#CBA766', // --sn-gold-300  / warn-300
};

// Avatar treatment (Guests roster RowAvatar) — a side-identity gradient with a
// small solid dot. This is the shipped reference recipe every other shape is
// tuned against; white initials read on all three grounds.
export const SIDE_AVATAR: Record<Side, { bg: string; dot: string }> = {
  bride: { bg: 'linear-gradient(135deg,#c8a877,#8a6b39)', dot: 'var(--sn-gold-500)' },
  groom: { bg: 'linear-gradient(135deg,#7e93a5,#4e6c82)', dot: 'var(--sn-info)' },
  both: { bg: 'linear-gradient(135deg,#c8a877,#7e93a5)', dot: 'var(--sn-gold-300)' },
};

// Solid dot swatch — facet dots, breadcrumb chip dots, inline-pill leading dot.
// Matches SIDE_AVATAR.dot: gold-500 / info / gold-300.
export const SIDE_DOT: Record<Side, string> = {
  bride: 'bg-warn-500',
  groom: 'bg-info-600',
  both: 'bg-warn-300',
};

// Filled swatch for a picker option (chip-editors Side chooser) — a touch
// deeper than the facet dot so it reads as a control.
export const SIDE_SWATCH: Record<Side, string> = {
  bride: 'bg-warn-500',
  groom: 'bg-info-500',
  both: 'bg-warn-300',
};

// Card-frame border only (no fill) — the roster card ring. bride deeper so it
// stays apart from the both-gold.
export const SIDE_RING: Record<Side, string> = {
  bride: 'border-warn-300',
  groom: 'border-info-200',
  both: 'border-warn-200',
};

// Heavier control-border accent (a form control that carries its side colour on
// the border, e.g. the quick-add Side picker).
export const SIDE_CONTROL_BORDER: Record<Side, string> = {
  bride: 'border-warn-400',
  groom: 'border-info-400',
  both: 'border-warn-300',
};

// Soft tinted chip (bg-50 weight + text + ring) — the guest-detail Side / group
// badges. bride deeper (100/900), both lighter (50/800), groom slate.
export const SIDE_CHIP_SOFT: Record<Side, string> = {
  bride: 'bg-warn-100 text-warn-900 ring-1 ring-warn-300',
  groom: 'bg-info-50 text-info-900 ring-1 ring-info-200',
  both: 'bg-warn-50 text-warn-800 ring-1 ring-warn-200',
};

// Present tinted chip (bg-100 weight + text + ring) — the roster card SidePill.
export const SIDE_CHIP: Record<Side, string> = {
  bride: 'bg-warn-200 text-warn-900 ring-1 ring-warn-300',
  groom: 'bg-info-100 text-info-900 ring-1 ring-info-200',
  both: 'bg-warn-100 text-warn-800 ring-1 ring-warn-200',
};

// Filled tint, no ring (the big-initials fallback in the roster card photo).
export const SIDE_TINT_FILL: Record<Side, string> = {
  bride: 'bg-warn-200 text-warn-900',
  groom: 'bg-info-100 text-info-900',
  both: 'bg-warn-100 text-warn-900',
};

// Text + left-border accent (the guest mind-map nodes).
export const SIDE_ACCENT: Record<Side, { text: string; border: string }> = {
  bride: { text: 'text-warn-700', border: 'border-l-warn-500' },
  groom: { text: 'text-info-600', border: 'border-l-info-400' },
  both: { text: 'text-warn-600', border: 'border-l-warn-300' },
};

// Full-row tint set (the groups sidebar — a filterable list row that deepens
// when active, with matching icon + count tones).
export const SIDE_ROW_TINT: Record<
  Side,
  { idle: string; active: string; icon: string; count: string }
> = {
  bride: {
    idle: 'bg-warn-100 text-warn-900 hover:bg-warn-200',
    active: 'bg-warn-200 font-medium text-warn-900',
    icon: 'text-warn-600',
    count: 'text-warn-600/70',
  },
  groom: {
    idle: 'bg-info-50 text-info-900 hover:bg-info-100',
    active: 'bg-info-100 font-medium text-info-800',
    icon: 'text-info-600',
    count: 'text-info-600/70',
  },
  both: {
    idle: 'bg-warn-50 text-warn-900 hover:bg-warn-100',
    active: 'bg-warn-100 font-medium text-warn-800',
    icon: 'text-warn-400',
    count: 'text-warn-400/70',
  },
};
