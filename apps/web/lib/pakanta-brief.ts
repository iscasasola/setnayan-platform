// ============================================================================
// Pakanta song brief — deterministic composer (love story → songwriter brief)
// ============================================================================
//
// Turns the couple's ONBOARDING love story (events.love_story, collected once
// in the wedding onboarding "told-back love stage") + their Pakanta music
// preferences (pakanta_intake_drafts.responses) into a ready-to-use brief the
// Setnayan music team drops into Suno to write the custom song.
//
// Mirrors the wedding-website composer (app/[slug]/_components/editorial/
// compose.ts) on purpose: v1 = TEMPLATE composition, NO LLM call. It weaves the
// structured fields into a clean brief and NEVER invents facts — every line is
// gated on a field being present; absent fields simply render less.
//
// WHY this exists (owner directive 2026-06-13): the retired wizard's separate
// 8-question Pakanta intake re-asked the couple their love story. The onboarding
// interview already captures it (how they met, the spark, the almost, the
// proposal, milestones, tone). So the song is generated FROM that one interview
// — the couple never re-tells their story; the Pakanta intake only tops up the
// music-specific bits (pet names, favourite singers, music type).
//
// love_story covers the STORY (questions 1-3 of the old intake). responses
// covers the MUSIC half (pet names, favourite singers, music type) + any extra
// wish. Either source may be empty; the brief degrades gracefully.
// ============================================================================

export type StoryTone = 'warm' | 'playful' | 'formal' | null;

/** events.love_story JSONB — every field optional / loosely typed (it is raw
 *  JSON; numbers may arrive where strings are expected). */
export type LoveStoryBlob =
  | {
      how_we_met?: unknown;
      met_year?: unknown;
      together_since?: unknown;
      spark?: unknown;
      spark_why?: unknown;
      spark_anchor?: unknown;
      obstacle?: unknown;
      obstacle_kept?: unknown;
      proposal?: unknown;
      proposal_setting?: unknown;
      proposal_year?: unknown;
      milestones?: unknown;
      anchors?: unknown;
    }
  | null
  | undefined;

/** pakanta_intake_drafts.responses — the Pakanta-specific top-up. */
export type PakantaResponses =
  | {
      how_you_met?: string;
      engagement_story?: string;
      memorable_story?: string;
      pet_names?: string;
      story_to_add?: string;
      groom_favorite_singer?: string;
      bride_favorite_singer?: string;
      music_type?: string;
    }
  | null
  | undefined;

export type PakantaBriefInput = {
  /** events.display_name — the couple, e.g. "Claire & Ice". */
  coupleNames: string;
  /** events.love_story (the onboarding interview). */
  loveStory: LoveStoryBlob;
  /** events.story_tone (warm / playful / formal). */
  storyTone: StoryTone;
  /** pakanta_intake_drafts.responses (optional music-preference top-up). */
  responses?: PakantaResponses;
};

export type PakantaBrief = {
  coupleNames: string;
  /** What they call each other — from the Pakanta top-up, else the love-story in-joke. */
  petNames: string | null;
  /** Woven narrative paragraphs for the songwriter (gated on present fields). */
  storyParagraphs: string[];
  /** Structured facts a lyricist anchors on (year met, proposal setting, the song/place/food anchors). */
  keyMoments: Array<{ label: string; value: string }>;
  musicalDirection: {
    /** Mood phrase derived from story_tone. */
    moodFromTone: string | null;
    /** Soft suggestion mapped to one of the 6 owned catalogue feels. */
    suggestedFeel: string | null;
    /** Favourite singers the couple named (reference artists, not to be copied). */
    favoriteSingers: string[];
    /** Free-text music type the couple asked for. */
    musicType: string | null;
  };
  /** responses.story_to_add — anything extra they want in the song. */
  extraWishes: string | null;
  /** False when the onboarding love story is empty AND no responses exist. */
  hasMaterial: boolean;
  /** A single copy-paste block for the music team / Suno prompt. */
  copyBlock: string;
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Coerce any JSON value to a trimmed string; '' when absent. Numbers (met_year
 *  etc. can arrive as JSON numbers) are stringified rather than throwing. */
function clean(s: unknown): string {
  if (s === null || s === undefined) return '';
  if (typeof s === 'number') return String(s);
  if (typeof s !== 'string') return '';
  return s.trim();
}

/** First non-empty cleaned value. */
function firstOf(...vals: unknown[]): string {
  for (const v of vals) {
    const c = clean(v);
    if (c) return c;
  }
  return '';
}

/** story_tone → a mood phrase for the songwriter. */
const TONE_MOOD: Record<'warm' | 'playful' | 'formal', string> = {
  warm: 'tender and heartfelt — intimate, sincere, a little nostalgic',
  playful: 'bright and playful — light, fun, full of inside-joke joy',
  formal: 'timeless and elegant — composed, romantic, ceremonial',
};

/** story_tone → a soft catalogue-feel suggestion (one of the 6 owned feels).
 *  The couple's named singers + music type always override this; it is only a
 *  starting point when they leave the music half blank. */
const TONE_FEEL: Record<'warm' | 'playful' | 'formal', string> = {
  warm: 'Sunday Morning Vibes',
  playful: 'Taylor-Swift-Feel',
  formal: 'Bridgerton-Feel',
};

// ---------------------------------------------------------------------------
// composer
// ---------------------------------------------------------------------------

export function composePakantaBrief(input: PakantaBriefInput): PakantaBrief {
  const story = input.loveStory ?? {};
  const r = input.responses ?? {};
  const names = clean(input.coupleNames) || 'The couple';

  // --- pet names: Pakanta top-up first, else the love-story in-joke anchor ---
  const anchors =
    story.anchors && typeof story.anchors === 'object'
      ? (story.anchors as Record<string, unknown>)
      : {};
  const petNames = firstOf(r.pet_names, anchors.injoke) || null;

  // --- narrative paragraphs (love story leads; responses fill gaps) ---
  const paragraphs: string[] = [];

  // 1. How they met. Prefer the onboarding spark; fall back to the Pakanta
  //    "how you met" answer, then the legacy free-text.
  const howMet = firstOf(story.spark, story.how_we_met, r.how_you_met);
  const sparkWhy = clean(story.spark_why);
  const metYear = clean(story.met_year);
  if (howMet) {
    let p = `How they met: ${howMet}`;
    if (sparkWhy) p += ` What made it stick: ${sparkWhy}`;
    if (metYear) p += ` (${metYear}).`;
    paragraphs.push(p.trim());
  }

  // 2. The "almost" / obstacle — the tension that makes the love earned.
  const obstacle = clean(story.obstacle);
  const obstacleKept = clean(story.obstacle_kept);
  if (obstacle) {
    let p = `What they came through: ${obstacle}`;
    if (obstacleKept) p += ` What kept them together: ${obstacleKept}`;
    paragraphs.push(p.trim());
  }

  // 3. The proposal. love-story proposal first, else the Pakanta engagement
  //    answer.
  const proposal = firstOf(story.proposal, r.engagement_story);
  const proposalSetting = clean(story.proposal_setting);
  const proposalYear = clean(story.proposal_year);
  if (proposal) {
    let p = `The proposal: ${proposal}`;
    if (proposalSetting) p += ` (${proposalSetting})`;
    if (proposalYear) p += ` · ${proposalYear}`;
    paragraphs.push(p.trim());
  }

  // 4. A memorable moment the couple wanted in the song (Pakanta-specific).
  const memorable = clean(r.memorable_story);
  if (memorable) paragraphs.push(`A moment they treasure: ${memorable}`);

  // --- key moments / anchors (structured facts a lyricist can reach for) ---
  const keyMoments: Array<{ label: string; value: string }> = [];
  const togetherSince = clean(story.together_since);
  if (togetherSince) keyMoments.push({ label: 'Together since', value: togetherSince });
  if (metYear) keyMoments.push({ label: 'The year they met', value: metYear });
  const anchorSong = clean(anchors.song);
  if (anchorSong) keyMoments.push({ label: 'Their song', value: anchorSong });
  const anchorPlace = clean(anchors.place);
  if (anchorPlace) keyMoments.push({ label: 'Their place', value: anchorPlace });
  const anchorFood = clean(anchors.food);
  if (anchorFood) keyMoments.push({ label: 'Their food', value: anchorFood });

  // Milestones[] from the onboarding timeline.
  if (Array.isArray(story.milestones)) {
    for (const m of story.milestones.slice(0, 6)) {
      if (m && typeof m === 'object') {
        const title = clean((m as Record<string, unknown>).title);
        const year = clean((m as Record<string, unknown>).year);
        if (title) {
          keyMoments.push({ label: year ? `Milestone (${year})` : 'Milestone', value: title });
        }
      }
    }
  }

  // --- musical direction ---
  const tone = input.storyTone;
  const moodFromTone = tone ? TONE_MOOD[tone] : null;
  const favoriteSingers = [clean(r.groom_favorite_singer), clean(r.bride_favorite_singer)].filter(
    (s) => s.length > 0,
  );
  const musicType = clean(r.music_type) || null;
  // The couple's own music preferences override the tone-based suggestion.
  const suggestedFeel = musicType || favoriteSingers.length > 0 ? null : tone ? TONE_FEEL[tone] : null;

  const extraWishes = clean(r.story_to_add) || null;

  const hasMaterial = paragraphs.length > 0 || keyMoments.length > 0 || favoriteSingers.length > 0;

  // --- single copy-paste block for the music team / Suno ---
  const lines: string[] = [];
  lines.push(`PAKANTA SONG BRIEF — ${names}`);
  lines.push('');
  if (petNames) lines.push(`They call each other: ${petNames}`);
  if (paragraphs.length > 0) {
    lines.push('');
    lines.push('THEIR STORY (from the couple’s onboarding interview):');
    for (const p of paragraphs) lines.push(`• ${p}`);
  }
  if (keyMoments.length > 0) {
    lines.push('');
    lines.push('ANCHORS:');
    for (const k of keyMoments) lines.push(`• ${k.label}: ${k.value}`);
  }
  lines.push('');
  lines.push('MUSIC:');
  if (moodFromTone) lines.push(`• Mood: ${moodFromTone}`);
  if (favoriteSingers.length > 0)
    lines.push(`• Reference artists (style only, do not copy): ${favoriteSingers.join(', ')}`);
  if (musicType) lines.push(`• Music type the couple asked for: ${musicType}`);
  if (!favoriteSingers.length && !musicType && suggestedFeel)
    lines.push(`• Suggested catalogue feel (couple left music blank): ${suggestedFeel}`);
  if (extraWishes) {
    lines.push('');
    lines.push(`COUPLE’S EXTRA WISH: ${extraWishes}`);
  }
  if (!hasMaterial) {
    lines.push('');
    lines.push(
      '⚠ No story material yet — the couple has not completed the love-story onboarding or a Pakanta intake.',
    );
  }

  return {
    coupleNames: names,
    petNames,
    storyParagraphs: paragraphs,
    keyMoments,
    musicalDirection: { moodFromTone, suggestedFeel, favoriteSingers, musicType },
    extraWishes,
    hasMaterial,
    copyBlock: lines.join('\n'),
  };
}
