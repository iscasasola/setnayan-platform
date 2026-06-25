/**
 * Iteration 0053 Phase 3 (follow-up) — per-type "signature moment" questions for
 * the generic (non-wedding) onboarding flow.
 *
 * The persona quiz (experience-personas) is event-AGNOSTIC; the persona packs
 * (persona-packs.ts) make the PLAN type-appropriate. This adds ONE type-specific
 * question per event type — the thing that actually distinguishes a debut from a
 * gender reveal from a corporate event — and makes it PURPOSEFUL: each chosen
 * option contributes the relevant vendor categories (`adds`) to the starter plan,
 * so the answer shapes `interested_categories` rather than being dead data.
 *
 * Pure data + a pure resolver (no I/O), keyed by `personaPackKey` (= the event-type
 * key for every seeded non-wedding profile). `adds` are `service_categories.id`
 * slugs — the same id space as the packs; the shell intersects them against the
 * type's real taxonomy tiles, so an inapplicable slug is harmlessly dropped. A
 * type with no entry simply renders no extra screen (the flow is unchanged).
 *
 * Wedding never routes through the generic flow, so this is non-wedding only.
 */

export type TypeQuestionOption = {
  key: string;
  title: string;
  desc: string;
  /** Vendor category ids this choice adds to the starter plan (taxonomy slugs). */
  adds: readonly string[];
};

export type TypeQuestion = {
  /** Stable id — becomes the answer key + the `tq_<id>` screen id in the shell. */
  id: string;
  eyebrow: string;
  question: string;
  options: readonly TypeQuestionOption[];
};

/** One signature-moment question per event type, keyed by `personaPackKey`. */
export const PER_TYPE_QUESTIONS: Record<string, readonly TypeQuestion[]> = {
  birthday: [
    {
      id: 'highlight',
      eyebrow: 'The fun',
      question: 'Any special touch?',
      options: [
        { key: 'booth', title: 'Photo booth', desc: 'Props, prints, instant memories.', adds: ['photo_booth'] },
        { key: 'games', title: 'Games corner', desc: 'Arcade and lawn games for all ages.', adds: ['arcade_games'] },
        { key: 'bar', title: 'Mobile bar', desc: 'Cocktails or mocktails on tap.', adds: ['mobile_bar'] },
        { key: 'dessert', title: 'Dessert spread', desc: 'A sweets table beyond the cake.', adds: ['dessert'] },
        { key: 'none', title: 'Just the essentials', desc: 'Keep it simple for now.', adds: [] },
      ],
    },
  ],
  debut: [
    {
      id: 'centerpiece',
      eyebrow: 'The moment',
      question: 'Your debut’s centerpiece?',
      options: [
        { key: 'cotillion', title: 'Cotillion dance', desc: 'A choreographed waltz with your court.', adds: ['choreographer'] },
        { key: 'production', title: 'Production number', desc: 'A staged performance to remember.', adds: ['performers', 'choreographer'] },
        { key: 'roses', title: '18 roses & candles', desc: 'The classic ceremonial tributes, hosted.', adds: ['host_mc'] },
        { key: 'simple', title: 'Keep it elegant', desc: 'A graceful program, nothing elaborate.', adds: [] },
      ],
    },
  ],
  gender_reveal: [
    {
      id: 'reveal_method',
      eyebrow: 'The reveal',
      question: 'How will you reveal?',
      options: [
        { key: 'smoke', title: 'Smoke or pyro', desc: 'Coloured smoke or a confetti cannon.', adds: ['fireworks'] },
        { key: 'cake', title: 'Cake cut', desc: 'The colour hidden inside the cake.', adds: ['cake'] },
        { key: 'decor', title: 'Balloon & confetti', desc: 'A styled pop-and-drop reveal.', adds: ['stylist_decorator'] },
        { key: 'film', title: 'On camera', desc: 'Filmed for the keepsake video.', adds: ['photo_video'] },
      ],
    },
  ],
  christening: [
    {
      id: 'after',
      eyebrow: 'After the rite',
      question: 'What follows the ceremony?',
      options: [
        { key: 'garden', title: 'Garden reception', desc: 'A styled outdoor celebration.', adds: ['stylist_decorator', 'catering'] },
        { key: 'lunch', title: 'Intimate lunch', desc: 'A warm meal with close family.', adds: ['catering'] },
        { key: 'party', title: 'Full party', desc: 'A hosted program with live music.', adds: ['host_mc', 'live_band'] },
        { key: 'none', title: 'Just the blessing', desc: 'Keep it to the ceremony.', adds: [] },
      ],
    },
  ],
  corporate: [
    {
      id: 'format',
      eyebrow: 'The format',
      question: 'What kind of corporate event?',
      options: [
        { key: 'awards', title: 'Awards night', desc: 'Recognition, trophies, a hosted program.', adds: ['trophies_awards', 'host_mc'] },
        { key: 'conference', title: 'Conference', desc: 'Talks, AV, optional livestream.', adds: ['lights_sound', 'livestream'] },
        { key: 'launch', title: 'Product launch', desc: 'A staged reveal with big-screen moments.', adds: ['led_wall', 'livestream'] },
        { key: 'celebration', title: 'Team celebration', desc: 'Food, fun, and entertainment.', adds: ['catering', 'performers'] },
      ],
    },
  ],
  tournament: [
    {
      id: 'priority',
      eyebrow: 'The priority',
      question: 'What matters most?',
      options: [
        { key: 'awards', title: 'Awards & medals', desc: 'Trophies and a closing ceremony.', adds: ['trophies_awards'] },
        { key: 'stream', title: 'Livestream coverage', desc: 'Broadcast the games online.', adds: ['livestream'] },
        { key: 'food', title: 'Food for players', desc: 'Catering or food trucks on-site.', adds: ['catering', 'food_truck'] },
        { key: 'hype', title: 'Hype & emcee', desc: 'A host and sound to drive the energy.', adds: ['host_mc', 'lights_sound'] },
      ],
    },
  ],
  travel: [
    {
      id: 'style',
      eyebrow: 'The trip',
      question: 'What do you need most?',
      options: [
        { key: 'documented', title: 'Documented', desc: 'A photo/video team along the way.', adds: ['photo_video', 'editorial'] },
        { key: 'logistics', title: 'Group logistics', desc: 'Transfers and a coordinator.', adds: ['guest_shuttle', 'coordinator'] },
        { key: 'keepsake', title: 'A keepsake site', desc: 'A shared page for the journey.', adds: ['digital_services'] },
      ],
    },
  ],
  celebration: [
    {
      id: 'touch',
      eyebrow: 'The fun',
      question: 'Any special touch?',
      options: [
        { key: 'booth', title: 'Photo booth', desc: 'Props, prints, instant memories.', adds: ['photo_booth'] },
        { key: 'music', title: 'Live music', desc: 'A band to set the mood.', adds: ['live_band'] },
        { key: 'bar', title: 'Mobile bar', desc: 'Cocktails or mocktails on tap.', adds: ['mobile_bar'] },
        { key: 'dessert', title: 'Dessert spread', desc: 'A sweets table to remember.', adds: ['dessert'] },
        { key: 'none', title: 'Just the essentials', desc: 'Keep it simple for now.', adds: [] },
      ],
    },
  ],
};

/** The per-type questions for a pack key (empty when the type has none). */
export function getTypeQuestions(packKey: string | null | undefined): readonly TypeQuestion[] {
  return (packKey && PER_TYPE_QUESTIONS[packKey]) || [];
}

/**
 * The vendor categories the answered type-questions contribute to the plan, in
 * order, deduped. Unanswered questions, an unknown option, or an `adds: []`
 * ("just the essentials") choice contribute nothing. Pure + deterministic.
 */
export function extraPicksFromAnswers(
  packKey: string | null | undefined,
  answers: Record<string, string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const q of getTypeQuestions(packKey)) {
    const chosen = answers[q.id];
    if (!chosen) continue;
    const opt = q.options.find((o) => o.key === chosen);
    if (!opt) continue;
    for (const id of opt.adds) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
