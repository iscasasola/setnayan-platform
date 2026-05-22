/**
 * Iteration · Principal + Secondary Sponsor coordination
 * Per CLAUDE.md 2026-05-22 row "Principal Sponsor list builder".
 *
 * Filipino-cultural V1 surface — type definitions, tier metadata, default
 * pair counts, invitation-template builder, and guest auto-link helpers.
 *
 * Schema basis: supabase/migrations/20260604040000_event_sponsors_table.sql
 *
 * Architectural notes:
 *   - Principal sponsors are pair-grouped via pair_index (one row per
 *     individual; pair_index couples the ninong/ninang within a pair).
 *   - Secondary sponsors (cord/veil/coin/candle) have 2 fixed slots per tier
 *     and are NOT pair-grouped via pair_index — each slot is an independent
 *     invitation (one may accept while the other declines without breaking
 *     the pair).
 *   - guest_role enum (per 20260513010000_iteration_0001_guests.sql) uses
 *     ONE 'principal_sponsor' value with side distinguishing ninong vs ninang;
 *     the four secondary tiers each have their own enum value.
 */

export type SponsorTier = 'principal' | 'cord' | 'veil' | 'coin' | 'candle';

export type SponsorSide = 'groom' | 'bride' | 'neutral';

export type SponsorInvitationStatus =
  | 'pending'
  | 'invited'
  | 'accepted'
  | 'declined';

export const SPONSOR_TIERS: SponsorTier[] = [
  'principal',
  'cord',
  'veil',
  'coin',
  'candle',
];

export const SPONSOR_SIDES: SponsorSide[] = ['groom', 'bride', 'neutral'];

export const SPONSOR_TIER_LABEL: Record<SponsorTier, string> = {
  principal: 'Principal sponsor',
  cord: 'Cord sponsor',
  veil: 'Veil sponsor',
  coin: 'Coin sponsor',
  candle: 'Candle sponsor',
};

/**
 * Plain-language hint shown under each tier section header. Brand voice
 * per [[feedback_setnayan_no_dev_text_post_launch]] — explains the cultural
 * role without engineering jargon.
 */
export const SPONSOR_TIER_HINT: Record<SponsorTier, string> = {
  principal:
    "Your ninong and ninang — the witnesses who'll stand with you and guide your marriage.",
  cord:
    'They place the yugal (cord of unity) on your shoulders as a symbol of two becoming one.',
  veil:
    "They drape the veil to bless the bride and groom's new home.",
  coin:
    'They present the arrhae (13 coins) — a promise of shared providence.',
  candle:
    'They light the candles symbolizing the light Christ brings to your union.',
};

export const SPONSOR_SIDE_LABEL: Record<SponsorSide, string> = {
  groom: "Groom's side",
  bride: "Bride's side",
  neutral: 'Neutral',
};

/**
 * Honorific used in the invitation template. Principal sponsors get
 * "ninong" or "ninang" by side; secondaries get the role label.
 */
export function sponsorRoleHonorific(tier: SponsorTier, side: SponsorSide): string {
  if (tier === 'principal') {
    if (side === 'groom') return 'ninong';
    if (side === 'bride') return 'ninang';
    return 'principal sponsor';
  }
  if (tier === 'cord') return 'cord sponsor';
  if (tier === 'veil') return 'veil sponsor';
  if (tier === 'coin') return 'coin sponsor (arrhae)';
  return 'candle sponsor';
}

/**
 * Default target — 4 pairs of principal sponsors per Filipino convention.
 * Allowed range: 2–12 pairs. The picker stores the target in localStorage
 * client-side (not in the events table) so we keep the schema minimal.
 */
export const PRINCIPAL_PAIR_DEFAULT = 4;
export const PRINCIPAL_PAIR_MIN = 2;
export const PRINCIPAL_PAIR_MAX = 12;

/**
 * Secondary sponsors are always 4 tiers × 2 slots = 8 individuals.
 */
export const SECONDARY_SLOTS_PER_TIER = 2;
export const SECONDARY_TIERS: ReadonlyArray<Exclude<SponsorTier, 'principal'>> = [
  'cord',
  'veil',
  'coin',
  'candle',
];

/**
 * Map a sponsor tier + side to the canonical guest_role enum value used
 * when auto-creating a guests row on invitation acceptance.
 *
 * Per migration 20260513010000_iteration_0001_guests.sql:
 *   - 'principal_sponsor' is ONE enum value; side distinguishes ninong/ninang.
 *   - Each secondary tier has its own enum value.
 */
export function sponsorGuestRole(
  tier: SponsorTier,
):
  | 'principal_sponsor'
  | 'cord_sponsor'
  | 'veil_sponsor'
  | 'coin_sponsor'
  | 'candle_sponsor' {
  switch (tier) {
    case 'principal':
      return 'principal_sponsor';
    case 'cord':
      return 'cord_sponsor';
    case 'veil':
      return 'veil_sponsor';
    case 'coin':
      return 'coin_sponsor';
    case 'candle':
      return 'candle_sponsor';
  }
}

/**
 * Map our sponsor side (groom/bride/neutral) to the guest_side enum used
 * on the guests row. Neutral collapses to 'both' which is the established
 * value for sponsors not tied to one family.
 */
export function sponsorGuestSide(side: SponsorSide): 'bride' | 'groom' | 'both' {
  if (side === 'bride') return 'bride';
  if (side === 'groom') return 'groom';
  return 'both';
}

/**
 * Build the invitation template a host can preview, edit, and copy to
 * clipboard before sending via Messenger / Viber / email / paper.
 *
 * Variables are pre-filled from event + sponsor data. Host can edit the
 * resulting string freely in the modal before copying.
 *
 * V1 ships clipboard-copy only. V1.x adds Resend email send (per 0028
 * email template pattern).
 */
export type InvitationContext = {
  sponsorFullName: string;
  sponsorTier: SponsorTier;
  sponsorSide: SponsorSide;
  coupleNames: string;
  weddingDate: string | null;
  ceremonyVenue: string | null;
};

export function buildInvitationMessage(ctx: InvitationContext): string {
  const honorific = sponsorRoleHonorific(ctx.sponsorTier, ctx.sponsorSide);

  // Address line uses just the first name when the full name has a space;
  // falls back to the full string otherwise. "Tito Marcel" reads warmer
  // than "Tito Marcel Reyes-Santos".
  const firstName = ctx.sponsorFullName.split(/\s+/)[0] ?? ctx.sponsorFullName;
  const greeting = `Dear ${firstName},`;

  const dateLine = ctx.weddingDate ? formatWeddingDate(ctx.weddingDate) : null;
  const venueLine = ctx.ceremonyVenue?.trim() || null;

  const occasion = ctx.coupleNames.includes('&')
    ? ctx.coupleNames
    : ctx.coupleNames || 'we';

  // Tier-specific paragraph — each tier carries a slightly different
  // weight in Filipino weddings, and the language honors that.
  const tierLine =
    ctx.sponsorTier === 'principal'
      ? `We would be honored to ask you to be our ${honorific} — to stand with us, sign our marriage contract, and walk alongside our marriage as a guide and witness in the years that follow.`
      : ctx.sponsorTier === 'cord'
        ? `We would be honored to ask you to be one of our cord sponsors — to place the yugal on our shoulders as a sign of unity at our wedding.`
        : ctx.sponsorTier === 'veil'
          ? `We would be honored to ask you to be one of our veil sponsors — to drape the veil over us during the ceremony and bless our new life together.`
          : ctx.sponsorTier === 'coin'
            ? `We would be honored to ask you to be one of our coin sponsors — to present the arrhae as a promise of shared providence between us.`
            : `We would be honored to ask you to be one of our candle sponsors — to light the candles during our ceremony as a symbol of the light we carry into marriage.`;

  const whenWhere = [dateLine, venueLine].filter(Boolean).join(' at ');
  const whenLine = whenWhere
    ? `${occasion === 'we' ? 'We' : occasion} are getting married on ${whenWhere}. We thought of you immediately.`
    : `${occasion === 'we' ? 'We' : occasion} are getting married soon, and we thought of you immediately.`;

  const closing = `Would you grace us with your yes?`;
  const sign = `With love and gratitude,\n${ctx.coupleNames}`;

  return [greeting, '', whenLine, '', tierLine, '', closing, '', sign].join('\n');
}

/**
 * Format the wedding date in PH-locale style for the invitation template.
 * Returns null for empty / invalid input so the caller can elide the
 * date sentence cleanly.
 */
function formatWeddingDate(raw: string): string | null {
  // raw is ISO YYYY-MM-DD per events.event_date
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const year = Number(yyyy);
  const month = Number(mm) - 1;
  const day = Number(dd);
  const d = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Server-side validation helper — coerces the raw form value to a tier
 * or throws. Used by add/edit server actions.
 */
export function parseSponsorTier(raw: unknown): SponsorTier {
  if (typeof raw !== 'string') throw new Error('sponsor_tier missing');
  if ((SPONSOR_TIERS as string[]).includes(raw)) return raw as SponsorTier;
  throw new Error(`Invalid sponsor_tier: ${raw}`);
}

export function parseSponsorSide(raw: unknown): SponsorSide {
  if (typeof raw !== 'string') throw new Error('side missing');
  if ((SPONSOR_SIDES as string[]).includes(raw)) return raw as SponsorSide;
  throw new Error(`Invalid side: ${raw}`);
}
