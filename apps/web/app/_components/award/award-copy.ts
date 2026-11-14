/**
 * 📜 THE APPROVED SEAL WORDS — `AWARD_TXT` from the owner-approved prototype
 * `Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v48.html`, ported VERBATIM so no caller retypes
 * them. Every seal: its eyebrow, title, body and the "How it is earned" lines with their met flag (`true` = a line the
 * shop has to meet and did; `false` = how the seal works, not a test the shop passes).
 *
 * The year is a parameter, never typed. The prototype's record numbers (`r`: "4.99 rating", "236 events this year"…)
 * are demo data and are NOT here: the caller passes the shop's real record to `SealPlaque`.
 *
 * Pure data — no fetch, no server.
 */
export type SealKind = 'no1' | 'medal' | 'heart' | 'crest' | 'verified' | 'partner';

export type SealCopy = {
  /** The small line above the title ("Setnayan · 2026"). */
  eyebrow: string;
  title: string;
  body: string;
  /** "How it is earned": [line, met]. */
  how: ReadonlyArray<readonly [string, boolean]>;
};

export const SEAL_KINDS: readonly SealKind[] = ['no1', 'medal', 'heart', 'crest', 'verified', 'partner'];

/** The approved words for every seal, for the given award year. */
export function AWARD_COPY(year: number | string): Record<SealKind, SealCopy> {
  return {
    no1: {
      title: 'No. 1 Supplier of the Year',
      eyebrow: `Setnayan · ${year}`,
      body: 'Congratulations! Of every supplier on Setnayan, you stood first this year. Every family you served, every date you kept and every review they left brought you here. There is only one No. 1, and this year it is you. Thank you for setting the standard for everyone.',
      how: [
        ['First among the Top 10: the highest review score of the year', true],
        ['At least 10 events completed through Setnayan this year, none cancelled by the shop', true],
        ['One shop a year; it cannot be bought or voted for', false],
      ],
    },
    medal: {
      title: 'Top 10 Supplier',
      eyebrow: `Setnayan · ${year}`,
      body: 'Congratulations! You are one of the ten best-rated suppliers on Setnayan this year. This medal cannot be bought or voted for. You earned it one event at a time, through couples who booked, paid and came back to tell us their day went beautifully. Thank you for being excellent, every weekend of the year.',
      how: [
        ['Loved: among the ten highest review scores of the year (rating and number of reviews together)', true],
        ['Reliable: at least 10 events completed through Setnayan this year, none cancelled by the shop', true],
        ['Only reviews from bookings completed through Setnayan count', false],
      ],
    },
    heart: {
      title: "Clients' Choice",
      eyebrow: `Setnayan · ${year}`,
      body: 'Congratulations! The couples you served chose you. Every review behind this heart comes from a family who trusted you with a day they will live only once, and left glad they did. No campaign can earn it; only kept promises can.',
      how: [
        ['Top 5% of all suppliers by review-weighted score', false],
        ['Held through the year, not one good month', true],
      ],
    },
    crest: {
      title: 'Most In-Demand',
      eyebrow: `Setnayan · ${year}`,
      body: 'Congratulations! Couples asked for you first. Your calendar filled faster than almost anyone’s on Setnayan, and you delivered every date you promised. Winning demand once is easy; you kept it all year.',
      how: [
        ['Top 10% of all suppliers by completed bookings', false],
        ['Cancelled or refunded bookings do not count', true],
      ],
    },
    verified: {
      title: 'Setnayan Verified',
      eyebrow: 'Setnayan',
      body: 'Congratulations, your shop is Setnayan Verified. Our team has checked that you are who you say you are: your owner, your business papers and your work. It tells every couple that a real business stands behind your name.',
      how: [
        ['Owner identity and business documents checked by the Setnayan team', false],
        ['Kept for good, while the shop stays in good standing', true],
      ],
    },
    partner: {
      title: 'Verified Partner',
      eyebrow: 'Setnayan · for life',
      body: 'Congratulations, you are a Setnayan Verified Partner, for life. You earned it on Setnayan itself: real events delivered through the platform, rated near-perfect by the couples who booked, without once letting a client down. It replaces your Setnayan Verified seal and stays with you for good.',
      how: [
        ['Setnayan Verified first', false],
        ['10 or more events completed on Setnayan', true],
        ['Rated 4.7 stars or higher', true],
        ['No cancellations by the shop', true],
        ['Kept for life: it replaces Setnayan Verified', false],
      ],
    },
  };
}

/** One seal's words shaped for `<SealPlaque {...sealPlaqueCopy('medal', 2026)} />` (the plaque lists the lines only). */
export function sealPlaqueCopy(kind: SealKind, year: number | string): { eyebrow: string; title: string; body: string; how: string[] } {
  const c = AWARD_COPY(year)[kind];
  return { eyebrow: c.eyebrow, title: c.title, body: c.body, how: c.how.map(([line]) => line) };
}
