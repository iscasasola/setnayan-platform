/**
 * Iteration 0053 Phase 3 — the GENERIC (non-wedding) experience-quiz content pack.
 * Same 5 axes + the SAME option keys as the wedding `EXP_AXES`, but event-neutral
 * copy (the wedding set says "wedding"/"Filipino heritage"). Because the option
 * KEYS are identical, the deterministic `resolvePersona` / `derivePlanFromPersona`
 * resolver works UNCHANGED. PR3 may register richer per-type packs; this is the
 * shared default ('generic').
 */
import {
  EXP_AXES,
  EXP_PERSONA_BY_KEY,
  type ExpAxis,
  type ExpAxisId,
} from '@/app/onboarding/wedding/_data/experience-personas';

/** Event-neutral axis copy. Option keys MUST match EXP_AXES (locked by the test). */
export const GENERIC_EXP_AXES: ExpAxis[] = [
  {
    id: 'for_whom',
    eyebrow: 'Your experience',
    question: 'What would make the day unforgettable?',
    options: [
      { key: 'couple', title: 'Our private memory', desc: 'A day we’ll relive forever — the film, the photos, the keepsakes.' },
      { key: 'guests', title: 'Our guests’ experience', desc: 'Everyone leaves saying it was the best celebration they’ve been to.' },
      { key: 'both', title: 'Both, equally', desc: 'A day we treasure and our guests never forget.' },
    ],
  },
  {
    id: 'feel',
    eyebrow: 'The scale',
    question: 'How big does it feel?',
    options: [
      { key: 'intimate', title: 'Intimate & personal', desc: 'Closest family and dearest friends — warm and unhurried.' },
      { key: 'midsize', title: 'Mid-size & warm', desc: 'A full room of the people you love, still personal.' },
      { key: 'grand', title: 'Grand & full-house', desc: 'A big celebration — the more the merrier.' },
    ],
  },
  {
    id: 'energy',
    eyebrow: 'The energy',
    question: 'What’s the energy of the day?',
    options: [
      { key: 'calm', title: 'Calm & relaxed', desc: 'Soft, sentimental, unhurried moments.' },
      { key: 'lively', title: 'Joyful & lively', desc: 'Music, dancing, and a packed floor.' },
      { key: 'refined', title: 'Elegant & refined', desc: 'Polished, timeless, and beautifully composed.' },
    ],
  },
  {
    id: 'roots',
    eyebrow: 'The style',
    question: 'Where does your celebration lean?',
    options: [
      { key: 'tradition', title: 'Rooted in tradition', desc: 'Tradition, family, and heritage at the heart.' },
      { key: 'modern', title: 'Modern & fresh', desc: 'Clean, current, and design-forward.' },
      { key: 'blend', title: 'A blend of both', desc: 'Honoring tradition with a modern touch.' },
    ],
  },
  {
    id: 'effort',
    eyebrow: 'The plan',
    question: 'How much do you want to do?',
    options: [
      { key: 'simple', title: 'Keep it simple', desc: 'The essentials, beautifully done.' },
      { key: 'balanced', title: 'A balanced plan', desc: 'The essentials plus a few special touches.' },
      { key: 'allout', title: 'Go all out', desc: 'Every detail, every wow moment.' },
    ],
  },
];

export type GenericPersonaReveal = {
  /** Editorial title — the hero line on the reveal. */
  name: string;
  /** Event-neutral one-liner under the title. */
  tagline: string;
  /** Palette FEELS key (→ events.mood_feel_key). */
  feel: string;
};

/**
 * Event-neutral reveal copy per persona key. Names are mostly agnostic already;
 * the taglines are reworded off "wedding". `feel` mirrors the wedding persona so
 * the palette is consistent.
 */
export const GENERIC_PERSONA_REVEAL: Record<string, GenericPersonaReveal> = {
  keepsake: {
    name: 'The Keepsake',
    tagline: 'A day built to be relived — your film, your photos, your forever keepsakes.',
    feel: EXP_PERSONA_BY_KEY.keepsake?.feel ?? 'modern',
  },
  big_celebration: {
    name: 'The Grand Celebration',
    tagline: 'The celebration everyone talks about — a packed floor, every guest part of the night.',
    feel: EXP_PERSONA_BY_KEY.big_celebration?.feel ?? 'glam',
  },
  best_of_both: {
    name: 'The Best of Both',
    tagline: 'A day you’ll treasure and your guests will never forget — beautifully balanced.',
    feel: EXP_PERSONA_BY_KEY.best_of_both?.feel ?? 'timeless',
  },
  intimate_romance: {
    name: 'Intimate & Personal',
    tagline: 'Small, soft, and deeply personal — every detail close to the heart.',
    feel: EXP_PERSONA_BY_KEY.intimate_romance?.feel ?? 'boho',
  },
  modern_statement: {
    name: 'The Modern Statement',
    tagline: 'Clean, current, and design-forward — an event that looks like no one else’s.',
    feel: EXP_PERSONA_BY_KEY.modern_statement?.feel ?? 'modern',
  },
  rooted_tradition: {
    name: 'Rooted in Tradition',
    tagline: 'Tradition, family, and heritage at the heart — and far-away loved ones brought close.',
    feel: EXP_PERSONA_BY_KEY.rooted_tradition?.feel ?? 'filipiniana',
  },
};

/** The axis ids in order — handy for the shell's screen sequence. */
export const GENERIC_AXIS_IDS: ExpAxisId[] = GENERIC_EXP_AXES.map((a) => a.id);
