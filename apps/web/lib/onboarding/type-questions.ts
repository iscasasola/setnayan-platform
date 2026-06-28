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

/**
 * Per-type "signature moment" questions, keyed by `personaPackKey`. 3–4 tailored
 * questions per type (the "Standard" depth, owner 2026-06-28) — a distinct first
 * moment plus shared beats (scale · keepsake · entertainment), each option's
 * `adds` mapping to REAL taxonomy ids applicable to that type. These are the code
 * DEFAULTS; admins override any of it per type at /admin/event-types/[type]/onboarding.
 * Every question is skippable; only answered options shape `interested_categories`.
 */
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
    {
      id: 'who',
      eyebrow: 'The celebrant',
      question: 'Who’s the birthday for?',
      options: [
        { key: 'kids', title: 'A kids’ party', desc: 'Games, fun, and a playful program.', adds: ['arcade_games'] },
        { key: 'milestone', title: 'A milestone (18 / 21)', desc: 'A styled, photo-worthy celebration.', adds: ['photo_video', 'stylist_decorator'] },
        { key: 'adult', title: 'An adult birthday', desc: 'Drinks, music, good company.', adds: ['mobile_bar'] },
        { key: 'golden', title: 'A golden one (50+)', desc: 'Elegant, warm, and full of family.', adds: ['live_band', 'florist'] },
      ],
    },
    {
      id: 'vibe',
      eyebrow: 'The look',
      question: 'What’s the vibe?',
      options: [
        { key: 'themed', title: 'Themed & playful', desc: 'A motif carried through the décor.', adds: ['stylist_decorator'] },
        { key: 'elegant', title: 'Elegant & polished', desc: 'Florals and a refined setup.', adds: ['florist', 'stylist_decorator'] },
        { key: 'chill', title: 'Casual & chill', desc: 'Relaxed, no fuss.', adds: [] },
      ],
    },
    {
      id: 'food',
      eyebrow: 'The food',
      question: 'How do you want to feed everyone?',
      options: [
        { key: 'catered', title: 'Full catering', desc: 'A proper sit-down or buffet meal.', adds: ['catering'] },
        { key: 'carts', title: 'Food carts & stations', desc: 'Grazing stations and street eats.', adds: ['food_cart', 'stations'] },
        { key: 'sweets', title: 'Dessert-forward', desc: 'A dessert table front and center.', adds: ['dessert'] },
        { key: 'drinks', title: 'A drinks bar', desc: 'Cocktails or mocktails on tap.', adds: ['mobile_bar'] },
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
    {
      id: 'court',
      eyebrow: 'The court',
      question: 'Who stands with you?',
      options: [
        { key: 'classic', title: 'Classic 18s', desc: '18 roses, candles, and treasures — hosted.', adds: ['host_mc'] },
        { key: 'cotillion', title: 'A cotillion court', desc: 'A dance court that needs choreography.', adds: ['choreographer'] },
        { key: 'intimate', title: 'A small, close court', desc: 'Just your nearest and dearest.', adds: [] },
      ],
    },
    {
      id: 'look',
      eyebrow: 'The look',
      question: 'How polished is the styling?',
      options: [
        { key: 'glam', title: 'Full glam', desc: 'Hair and makeup for the big reveal.', adds: ['hmua'] },
        { key: 'styled', title: 'Styled & decorated', desc: 'Florals and a designed stage.', adds: ['stylist_decorator', 'florist'] },
        { key: 'simple', title: 'Keep it simple', desc: 'Effortless and natural.', adds: [] },
      ],
    },
    {
      id: 'entertainment',
      eyebrow: 'The party',
      question: 'How do you keep the energy up?',
      options: [
        { key: 'band', title: 'A live band', desc: 'Live music through the night.', adds: ['live_band'] },
        { key: 'dj', title: 'DJ & dance floor', desc: 'Beats and a packed floor.', adds: ['dj', 'dance_floor'] },
        { key: 'performers', title: 'Special performers', desc: 'A featured act or number.', adds: ['performers'] },
        { key: 'none', title: 'Keep it mellow', desc: 'Conversation over commotion.', adds: [] },
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
    {
      id: 'scale',
      eyebrow: 'The guest list',
      question: 'How big is the gathering?',
      options: [
        { key: 'family', title: 'Family only', desc: 'An intimate moment, close circle.', adds: [] },
        { key: 'party', title: 'A full party', desc: 'A hosted celebration with a crowd.', adds: ['host_mc', 'catering'] },
      ],
    },
    {
      id: 'keepsake',
      eyebrow: 'The keepsake',
      question: 'How do you want to remember it?',
      options: [
        { key: 'pv', title: 'Photo & video', desc: 'The moment captured properly.', adds: ['photo_video'] },
        { key: 'editorial', title: 'An editorial feature', desc: 'A story page for your announcement.', adds: ['editorial'] },
        { key: 'none', title: 'Snaps are enough', desc: 'Keep it casual.', adds: [] },
      ],
    },
    {
      id: 'treats',
      eyebrow: 'The treats',
      question: 'Anything sweet or special?',
      options: [
        { key: 'sweets', title: 'Cake & dessert', desc: 'A cake and a little dessert table.', adds: ['cake', 'dessert'] },
        { key: 'drinks', title: 'A mocktail bar', desc: 'Pink-and-blue drinks to match.', adds: ['mocktail'] },
        { key: 'decor', title: 'Balloon styling', desc: 'A styled backdrop and balloons.', adds: ['stylist_decorator'] },
        { key: 'none', title: 'Nothing extra', desc: 'Keep it simple.', adds: [] },
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
    {
      id: 'scale',
      eyebrow: 'The gathering',
      question: 'How big is the celebration?',
      options: [
        { key: 'intimate', title: 'Close family', desc: 'An intimate, gentle gathering.', adds: [] },
        { key: 'full', title: 'A full celebration', desc: 'A hosted meal for everyone.', adds: ['catering', 'host_mc'] },
      ],
    },
    {
      id: 'keepsakes',
      eyebrow: 'The keepsakes',
      question: 'How do you mark the day?',
      options: [
        { key: 'pv', title: 'Photo & video', desc: 'Coverage of the rite and reception.', adds: ['photo_video'] },
        { key: 'souvenirs', title: 'Souvenirs', desc: 'Tokens for ninongs & ninangs.', adds: ['souvenir_giveaways'] },
        { key: 'editorial', title: 'An editorial story', desc: 'A keepsake page for the day.', adds: ['editorial'] },
        { key: 'none', title: 'Nothing extra', desc: 'Keep it simple.', adds: [] },
      ],
    },
    {
      id: 'kids',
      eyebrow: 'The little ones',
      question: 'Anything for the kids?',
      options: [
        { key: 'play', title: 'A play area', desc: 'Games to keep little guests happy.', adds: ['arcade_games'] },
        { key: 'host', title: 'A host & program', desc: 'Someone to run a light program.', adds: ['host_mc'] },
        { key: 'sweets', title: 'A dessert table', desc: 'Treats the kids will love.', adds: ['dessert'] },
        { key: 'none', title: 'Not needed', desc: 'Keep it grown-up.', adds: [] },
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
    {
      id: 'scale',
      eyebrow: 'The headcount',
      question: 'About how many attendees?',
      options: [
        { key: 'small', title: 'Under 50', desc: 'An intimate, focused session.', adds: [] },
        { key: 'mid', title: '50–200', desc: 'A room that needs proper sound.', adds: ['lights_sound'] },
        { key: 'large', title: '200+', desc: 'A big stage with screen support.', adds: ['lights_sound', 'led_wall'] },
      ],
    },
    {
      id: 'production',
      eyebrow: 'The production',
      question: 'How produced should it feel?',
      options: [
        { key: 'av', title: 'Full AV & staging', desc: 'Stage, screens, and sound.', adds: ['lights_sound', 'led_wall'] },
        { key: 'stream', title: 'Livestream / hybrid', desc: 'Beam it to remote attendees.', adds: ['livestream'] },
        { key: 'host', title: 'A host / emcee', desc: 'Someone to run the program.', adds: ['host_mc'] },
        { key: 'none', title: 'Keep it lean', desc: 'No heavy production.', adds: [] },
      ],
    },
    {
      id: 'catering',
      eyebrow: 'The catering',
      question: 'How are you feeding the room?',
      options: [
        { key: 'plated', title: 'Plated meal', desc: 'A served, sit-down meal.', adds: ['catering'] },
        { key: 'stations', title: 'Food stations', desc: 'Grazing and live stations.', adds: ['stations'] },
        { key: 'cocktails', title: 'Cocktails & canapés', desc: 'Standing reception style.', adds: ['mobile_bar'] },
        { key: 'coffee', title: 'A coffee cart', desc: 'Caffeine to power the day.', adds: ['coffee_espresso'] },
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
    {
      id: 'scale',
      eyebrow: 'The scale',
      question: 'How big is the meet?',
      options: [
        { key: 'local', title: 'Local / small', desc: 'A handful of teams.', adds: [] },
        { key: 'regional', title: 'Regional', desc: 'A bigger draw that needs sound.', adds: ['lights_sound'] },
        { key: 'major', title: 'Major', desc: 'Many teams, a real production.', adds: ['lights_sound', 'led_wall'] },
      ],
    },
    {
      id: 'coverage',
      eyebrow: 'The coverage',
      question: 'How do you capture it?',
      options: [
        { key: 'pv', title: 'Photo & video', desc: 'Action shots and a recap.', adds: ['photo_video'] },
        { key: 'stream', title: 'Livestream', desc: 'Broadcast to fans at home.', adds: ['livestream'] },
        { key: 'wall', title: 'Scoreboard / LED wall', desc: 'Live scores on the big screen.', adds: ['led_wall'] },
        { key: 'none', title: 'Not a priority', desc: 'Skip coverage for now.', adds: [] },
      ],
    },
    {
      id: 'onsite',
      eyebrow: 'On-site',
      question: 'Anything for players & crowd?',
      options: [
        { key: 'trucks', title: 'Food trucks', desc: 'Eats parked on-site.', adds: ['food_truck'] },
        { key: 'carts', title: 'Food carts', desc: 'Snacks and refreshments.', adds: ['food_cart'] },
        { key: 'wellness', title: 'Wellness & recovery', desc: 'Massage / fitness support.', adds: ['wellness_fitness'] },
        { key: 'none', title: 'Nothing extra', desc: 'Keep it lean.', adds: [] },
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
    {
      id: 'group',
      eyebrow: 'The group',
      question: 'Who’s travelling?',
      options: [
        { key: 'couple', title: 'Just us', desc: 'A small, easy-to-move party.', adds: [] },
        { key: 'family', title: 'A family group', desc: 'A trip that needs coordinating.', adds: ['coordinator'] },
        { key: 'barkada', title: 'A big group', desc: 'Many people, many moving parts.', adds: ['coordinator', 'guest_shuttle'] },
      ],
    },
    {
      id: 'coverage',
      eyebrow: 'The memories',
      question: 'How do you capture the trip?',
      options: [
        { key: 'pv', title: 'A photo & video team', desc: 'Pro coverage of the journey.', adds: ['photo_video'] },
        { key: 'creator', title: 'A content creator', desc: 'Reels and social-ready clips.', adds: ['digital_services'] },
        { key: 'none', title: 'We’ll shoot our own', desc: 'Phones are enough.', adds: [] },
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
    {
      id: 'scale',
      eyebrow: 'The gathering',
      question: 'How big is it?',
      options: [
        { key: 'intimate', title: 'An intimate dinner', desc: 'A close, seated celebration.', adds: [] },
        { key: 'party', title: 'A big party', desc: 'A hosted celebration for many.', adds: ['host_mc', 'catering'] },
      ],
    },
    {
      id: 'entertainment',
      eyebrow: 'The energy',
      question: 'How do you set the mood?',
      options: [
        { key: 'band', title: 'A live band', desc: 'Live music all night.', adds: ['live_band'] },
        { key: 'dj', title: 'DJ & dancing', desc: 'A floor that stays full.', adds: ['dj', 'dance_floor'] },
        { key: 'performers', title: 'Performers', desc: 'A featured act.', adds: ['performers'] },
        { key: 'none', title: 'Keep it mellow', desc: 'Easy background music.', adds: [] },
      ],
    },
    {
      id: 'keepsake',
      eyebrow: 'The keepsake',
      question: 'How do you remember it?',
      options: [
        { key: 'pv', title: 'Photo & video', desc: 'Proper coverage of the night.', adds: ['photo_video'] },
        { key: 'booth', title: 'A photo booth', desc: 'Instant prints for guests.', adds: ['photo_booth'] },
        { key: 'editorial', title: 'An editorial page', desc: 'A story page for the occasion.', adds: ['editorial'] },
        { key: 'none', title: 'Nothing extra', desc: 'Keep it simple.', adds: [] },
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
  return extraPicksFrom(getTypeQuestions(packKey), answers);
}

/**
 * Same as `extraPicksFromAnswers` but takes the QUESTIONS directly — the DB-driven
 * path: `getOnboardingSpec` resolves the questions (admin override OR the TS
 * default) and the shell passes them straight in. Pure + deterministic.
 */
export function extraPicksFrom(
  questions: readonly TypeQuestion[],
  answers: Record<string, string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
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
