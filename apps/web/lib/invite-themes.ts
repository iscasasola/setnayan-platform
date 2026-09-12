/**
 * lib/invite-themes.ts — the invite link's five themes (owner 2026-09-10).
 *
 * *"we want to have 5 different invite themes. we want elegant, classy,
 * sophisticated, rugged, and generic"* · *"Generic is the Free (nothing to
 * edit). The other 4 will be the Event Hub Pro service"* · *"color themes can be
 * adjusted and background will use the reveal background photo. So our
 * cinematic reveal is also integrated as one whole concept design."*
 *
 * Design: "Five Invite Doors" (claude.ai artifact 938658cb…, DECISION_LOG
 * 2026-09-10). Each theme is a SKIN on the one door — `DoorShell` still owns the
 * card, its 3px edge and its single action; a theme owns only what sits behind
 * and around the card.
 *
 * 🔑 THE FOUR PRO THEMES ARE NOT A NEW SKU. They ride `COUPLE_WEBSITE_PRO`,
 * titled "Event Hub Pro" in the live catalog — the umbrella that already carries
 * the Cinematic Reveal, Background color and Button color (lib/website-pro-items.ts).
 * No price is written here; the gate is ownership, read by the caller.
 *
 * 🔒 NOTHING HERE REPAINTS A LIVE INVITE. `events.invite_theme` is NULL until a
 * couple saves a choice, and NULL renders as House. The onboarding feel only
 * PRE-SELECTS the picker (`suggestedInviteTheme`); it never becomes the theme
 * on its own.
 */

export const INVITE_THEME_IDS = ['house', 'capiz', 'velvet', 'galeriya', 'abaca'] as const;
export type InviteThemeId = (typeof INVITE_THEME_IDS)[number];

export type InviteTheme = {
  id: InviteThemeId;
  /** What a couple sees on the picker. */
  name: string;
  /** The owner's word for it. */
  word: 'Generic' | 'Elegant' | 'Classy' | 'Sophisticated' | 'Rugged';
  tier: 'free' | 'pro';
  /**
   * The onboarding feels (`events.mood_feel_key`, lib/match-criteria.ts
   * FEEL_OPTIONS) this theme is SUGGESTED for. Every feel belongs to exactly
   * one theme — the test holds that, so no couple is suggested nothing.
   */
  feels: readonly string[];
  /**
   * The theme's default opening, one of the five SHIPPED reveal mechanics (or
   * none). A couple's own `std_reveal_template` always wins over this.
   */
  opening: 'none' | 'veil-sheer' | 'four-flap';
  /**
   * Whether its skin has shipped. An unready theme is never offered and never
   * rendered — a saved choice for one falls back to House, so shipping a skin
   * later needs no data change.
   */
  ready: boolean;
  /** One line for the picker, in the couple's terms. */
  blurb: string;
};

export const INVITE_THEMES: Record<InviteThemeId, InviteTheme> = {
  house: {
    id: 'house',
    name: 'House',
    word: 'Generic',
    tier: 'free',
    feels: ['others'],
    opening: 'none',
    ready: true,
    blurb: 'Setnayan’s own door — clear, calm, nothing to set up.',
  },
  capiz: {
    id: 'capiz',
    name: 'Capiz',
    word: 'Elegant',
    tier: 'pro',
    feels: ['timeless', 'filipiniana'],
    opening: 'veil-sheer',
    ready: true,
    blurb: 'Your photo, seen through a capiz window, with your mark as the seal.',
  },
  velvet: {
    id: 'velvet',
    name: 'Velvet',
    word: 'Classy',
    tier: 'pro',
    feels: ['glam', 'royalty'],
    opening: 'four-flap',
    ready: true,
    blurb: 'An engraved card resting on velvet in your colour.',
  },
  galeriya: {
    id: 'galeriya',
    name: 'Galeriya',
    word: 'Sophisticated',
    tier: 'pro',
    feels: ['modern'],
    opening: 'veil-sheer',
    ready: false,
    blurb: 'Your photo hung as the work, your names as its label.',
  },
  abaca: {
    id: 'abaca',
    name: 'Abaca',
    word: 'Rugged',
    tier: 'pro',
    feels: ['rustic', 'boho'],
    opening: 'four-flap',
    ready: false,
    blurb: 'Your photo printed on kraft, a stamped date, the steps as tags on twine.',
  },
};

export function isInviteThemeId(value: unknown): value is InviteThemeId {
  return typeof value === 'string' && (INVITE_THEME_IDS as readonly string[]).includes(value);
}

/**
 * 🔒 WEDDINGS ONLY, FOR NOW (owner Q7 = A, 2026-09-11 · DECISION_LOG "the seven
 * invite-theme questions"): *"the event types that carry the Save-the-Date film,
 * the same fence the reveal uses. Every other celebration gets House."*
 *
 * The caller measures it — `resolveWeddingOnlyParts(profile).save_the_date_film`
 * — and hands the answer in, for the same reason `ownsPro` is a boolean and not
 * an event id: a gate that can only ever answer one way is indistinguishable, in
 * the render, from a gate that works.
 *
 * ⛔ IT IS NOT A SECOND OPINION ABOUT THE REVEAL. `lib/invite-reveal.ts` asks
 * whether a reveal may PLAY NOW (a calendar question, on the venue's clock);
 * this asks only whether this KIND of celebration has a Save-the-Date film at
 * all. Same profile answer, two different questions — do not collapse them, and
 * do not restate `cinematicRevealPlays` here.
 *
 * NOT optional. A default of `true` would let a birthday through on the day
 * somebody forgets to pass it, and that failure renders as a working page.
 */
type WeddingFence = {
  /** `resolveWeddingOnlyParts(profile).save_the_date_film`. */
  mayShowStdFilm: boolean;
};

/** Free themes are for everyone; a Pro theme needs the unlock AND the fence. */
function themeIsAvailable(
  theme: InviteTheme,
  input: { ownsPro: boolean } & WeddingFence,
): boolean {
  if (!theme.ready) return false;
  if (theme.tier === 'free') return true;
  return input.ownsPro && input.mayShowStdFilm;
}

/**
 * The theme a guest actually sees. House unless the couple SAVED a theme that
 * has shipped — and, for a Pro theme, the event holds Event Hub Pro right now
 * AND its type may carry the Save-the-Date film. A lapse (of either) falls back
 * to House and the choice is restored when it returns, with no write in between.
 */
export function resolveInviteTheme(
  input: { saved: unknown; ownsPro: boolean } & WeddingFence,
): InviteThemeId {
  if (!isInviteThemeId(input.saved)) return 'house';
  const theme = INVITE_THEMES[input.saved];
  return themeIsAvailable(theme, input) ? theme.id : 'house';
}

/**
 * The picker's PRE-SELECTION — never written on its own. The couple's saved
 * choice if there is one; otherwise the shipped theme their onboarding feel
 * points at, if they can use it; otherwise House. The couple already told us
 * their feel once, so they are not asked about style twice.
 */
export function suggestedInviteTheme(
  input: { saved: unknown; moodFeelKey: unknown; ownsPro: boolean } & WeddingFence,
): InviteThemeId {
  // ⚠ THE SAVED VALUE GOES THROUGH THE FENCE TOO. It used to be returned
  // straight, which was right while the only fence was ownership (the picker
  // disabled what you could not have, so nothing unavailable could be saved).
  // Q7 adds a fence the couple can cross AFTER saving, by changing the kind of
  // celebration they are holding — and a radio pre-selected on a theme their
  // guests are not being shown is the picker telling them the opposite of the
  // door.
  if (isInviteThemeId(input.saved) && themeIsAvailable(INVITE_THEMES[input.saved], input)) {
    return input.saved;
  }
  if (isInviteThemeId(input.saved)) return 'house';
  const feel = typeof input.moodFeelKey === 'string' ? input.moodFeelKey : null;
  if (!feel) return 'house';
  const match = INVITE_THEME_IDS.map((id) => INVITE_THEMES[id]).find(
    (t) => t.feels.includes(feel) && themeIsAvailable(t, input),
  );
  return match?.id ?? 'house';
}

/**
 * The themes a couple can pick right now, in the order the owner named them.
 *
 * Pro themes are LISTED-BUT-DISABLED for a couple who simply has not bought the
 * unlock — *"never hidden, so a couple knows what they would get"* (the picker's
 * own note). They are absent entirely where the event TYPE cannot have them
 * (Q7 = A): offering a birthday a theme no purchase can ever turn on is not an
 * upsell, it is a dead radio button.
 */
export function pickableInviteThemes(input: WeddingFence): InviteTheme[] {
  return INVITE_THEME_IDS.map((id) => INVITE_THEMES[id]).filter(
    (t) => t.ready && (t.tier === 'free' || input.mayShowStdFilm),
  );
}
