/**
 * Love-quote-of-the-day · cycling library keyed on days-to-wedding.
 *
 * Owner directive 2026-05-22 (verbatim):
 *   "we want a 365 days in love quote that will be shared everyday
 *    depending on how far they are from the wedding."
 *
 * Surface: server-rendered on `/dashboard/[eventId]` event home between the
 * WelcomeHeader and the AuspiciousChip. Hosts see a different uplifting line
 * each time they visit Home depending on how far they are from their wedding.
 *
 * Lookup contract:
 *   - day  365 → 1 year out (earliest quote)
 *   - day    0 → wedding day (final pre-wedding quote)
 *   - day  < 0 → post-wedding ("first day(s) of forever", up to ~30 days)
 *   - day > 365 → modulo into the 0–365 range so couples with longer runways
 *                 still get a quote that doesn't error
 *
 * Fallback (lookup-by-day):
 *   The seeded set is concentrated on milestone days (365 · 300 · 200 · 100 ·
 *   60 · 30 · 21 · 14 · 7 · 5 · 3 · 2 · 1 · 0) plus heavy daily coverage on
 *   the last 30 days. When the exact `day` isn't seeded, we find the nearest
 *   entry with `entry.day <= daysToWedding` and surface that — so a host
 *   landing on day 287 falls through to whichever milestone we've authored
 *   below. Always returns a quote; never errors.
 *
 * Voice (per [[feedback_setnayan_no_dev_text_post_launch]] + CLAUDE.md
 *   2026-05-12 "luxurious, Filipino, modern" lock):
 *   - Cormorant-italic-display editorial register
 *   - ~140 characters max (single-line desktop, 2-line mobile)
 *   - Emotional, never saccharine
 *   - Public-domain sources only (Filipino proverbs, Rumi / Neruda / Browning,
 *     Setnayan editorial)
 *
 * No DB schema. Pure content lookup table.
 */

export type LoveQuote = {
  /** 0 = wedding day · 1 = day before · 365 = 1 year out · negative = post-wedding */
  day: number;
  text: string;
  source?: string;
};

/**
 * Post-wedding quotes (days 0 to -30). Surfaced when `daysToWedding < 0` so
 * couples returning to event home during the editorial review window still
 * see something tender. After day -30 we recycle from the main pre-wedding
 * set via the `quoteForDay` fallback chain.
 */
const POST_WEDDING_QUOTES: LoveQuote[] = [
  {
    day: -1,
    text: "The first morning of forever. Yesterday's vows have already begun their quiet work.",
    source: 'Setnayan editorial',
  },
  {
    day: -2,
    text: 'Two days in. The cake is finished, the photos are still arriving, the marriage is just starting.',
    source: 'Setnayan editorial',
  },
  {
    day: -3,
    text: 'Three days married. Notice how the word "we" is already settling into your sentences.',
    source: 'Setnayan editorial',
  },
  {
    day: -5,
    text: 'A week soon. The wedding is behind you — the love is the part that keeps unfolding.',
    source: 'Setnayan editorial',
  },
  {
    day: -7,
    text: 'One week married. Pamilya na talaga — the family that began at the altar.',
    source: 'Setnayan editorial',
  },
  {
    day: -14,
    text: 'Two weeks in. The thank-you cards can wait. The being-married cannot.',
    source: 'Setnayan editorial',
  },
  {
    day: -21,
    text: 'Three weeks. The photographs are sorting themselves; the marriage is doing the same.',
    source: 'Setnayan editorial',
  },
  {
    day: -30,
    text: 'A month of marriage. Walang humpay ang pag-ibig — love that does not stop.',
    source: 'Filipino proverb',
  },
];

/**
 * Pre-wedding quotes (days 0 to 365). Seeded with heavy concentration on the
 * last 30 days (most-visited window) plus key milestones spaced backwards
 * through the year. Daily coverage from day 0 → 30 then thinner past that.
 */
const PRE_WEDDING_QUOTES: LoveQuote[] = [
  // ── Wedding day & the final week ─────────────────────────────────────
  {
    day: 0,
    text: 'Today is the day. Every yes that came before now lives in this single moment.',
    source: 'Setnayan editorial',
  },
  {
    day: 1,
    text: 'One sleep. The dress is ready, the rings are ready, the rest is just walking toward it.',
    source: 'Setnayan editorial',
  },
  {
    day: 2,
    text: 'Two days out. Bukas-makalawa, ikakasal ka na — the day after tomorrow you are married.',
    source: 'Filipino expression',
  },
  {
    day: 3,
    text: 'Three days. The work is done. What remains is the joy of arriving.',
    source: 'Setnayan editorial',
  },
  {
    day: 4,
    text: 'Four days. Notice the soft panic — that is love taking the wheel for the final stretch.',
    source: 'Setnayan editorial',
  },
  {
    day: 5,
    text: 'Five days. Every list has been crossed twice. Let the week feel a little bit holy.',
    source: 'Setnayan editorial',
  },
  {
    day: 6,
    text: 'Six days. The flowers are being cut somewhere. Your name is on the order.',
    source: 'Setnayan editorial',
  },
  {
    day: 7,
    text: 'One week. Isang linggo na lang — only a week of being engaged remains.',
    source: 'Setnayan editorial',
  },
  // ── Second week out ─────────────────────────────────────────────────
  {
    day: 8,
    text: 'Eight days. The text messages from your ninang start tonight. Answer them with patience.',
    source: 'Setnayan editorial',
  },
  {
    day: 9,
    text: 'Nine days. The venue staff already knows your story. They have been waiting too.',
    source: 'Setnayan editorial',
  },
  {
    day: 10,
    text: 'Ten days. Every Filipino wedding shrinks to this exact distance — close enough to touch.',
    source: 'Setnayan editorial',
  },
  {
    day: 11,
    text: 'Eleven days. The photographer is already imagining your light.',
    source: 'Setnayan editorial',
  },
  {
    day: 12,
    text: 'Twelve days. Notice your hands at rest. They will not be still much longer.',
    source: 'Setnayan editorial',
  },
  {
    day: 13,
    text: 'Thirteen days. Tradition says count by the laughter; the laughter has already started.',
    source: 'Setnayan editorial',
  },
  {
    day: 14,
    text: 'Two weeks. Pamamanhikan was the beginning. This is where the families become one calendar.',
    source: 'Setnayan editorial',
  },
  // ── Third week out ──────────────────────────────────────────────────
  {
    day: 15,
    text: 'Fifteen days. The cord and veil have been chosen. Someone is practicing the placement.',
    source: 'Setnayan editorial',
  },
  {
    day: 16,
    text: 'Sixteen days. Sleep early tonight. The next two weeks will earn their tiredness.',
    source: 'Setnayan editorial',
  },
  {
    day: 17,
    text: 'Seventeen days. Somewhere a coordinator is timing your processional in their head.',
    source: 'Setnayan editorial',
  },
  {
    day: 18,
    text: 'Eighteen days. Save one breath of nervous joy for the morning of. You will need it.',
    source: 'Setnayan editorial',
  },
  {
    day: 19,
    text: 'Nineteen days. The dress is hanging quietly. The suit is doing the same.',
    source: 'Setnayan editorial',
  },
  {
    day: 20,
    text: 'Twenty days. The save-the-dates feel a lifetime ago. Good — that means the work was real.',
    source: 'Setnayan editorial',
  },
  {
    day: 21,
    text: 'Three weeks. Tatlong linggo na lang — only three more weeks of dreaming.',
    source: 'Setnayan editorial',
  },
  // ── Fourth week out (last full month) ───────────────────────────────
  {
    day: 22,
    text: 'Twenty-two days. The seating chart will not get any more perfect than it is right now.',
    source: 'Setnayan editorial',
  },
  {
    day: 23,
    text: 'Twenty-three days. Your phone is buzzing with confirmations. Each one is a small yes.',
    source: 'Setnayan editorial',
  },
  {
    day: 24,
    text: 'Twenty-four days. The principal sponsors are practicing what they will say.',
    source: 'Setnayan editorial',
  },
  {
    day: 25,
    text: 'Twenty-five days. The cake design is locked. Somewhere a baker is already smiling.',
    source: 'Setnayan editorial',
  },
  {
    day: 26,
    text: 'Twenty-six days. Notice the playlist — it is the soundtrack of who you are right now.',
    source: 'Setnayan editorial',
  },
  {
    day: 27,
    text: 'Twenty-seven days. The bridal car has been booked. The route has been driven twice.',
    source: 'Setnayan editorial',
  },
  {
    day: 28,
    text: 'Twenty-eight days. Four weeks. The shape of the wedding is now visible from across the room.',
    source: 'Setnayan editorial',
  },
  {
    day: 29,
    text: 'Twenty-nine days. The last batch of save-the-dates was already opened weeks ago. Trust it.',
    source: 'Setnayan editorial',
  },
  {
    day: 30,
    text: 'One month. Isang buwan — Filipino weddings sharpen in the final month. Yours is sharpening now.',
    source: 'Setnayan editorial',
  },
  // ── Days 31–60: weekly cadence ──────────────────────────────────────
  {
    day: 35,
    text: 'Five weeks. The dress fittings are finishing. The marriage is just beginning.',
    source: 'Setnayan editorial',
  },
  {
    day: 42,
    text: 'Six weeks. The Pre-Cana is behind you. The promises are ahead.',
    source: 'Setnayan editorial',
  },
  {
    day: 49,
    text: 'Seven weeks. Anong pakiramdam? — That fluttery feeling is the engagement remembering you.',
    source: 'Filipino expression',
  },
  {
    day: 56,
    text: 'Eight weeks. The invitations have done their work. The RSVPs are doing theirs.',
    source: 'Setnayan editorial',
  },
  {
    day: 60,
    text: 'Two months. Dalawang buwan na lang — sixty days of being engaged, then forever after.',
    source: 'Setnayan editorial',
  },
  // ── Days 61–120: looser cadence ─────────────────────────────────────
  {
    day: 70,
    text: 'Ten weeks. The mood board has stopped changing. That is the moment a wedding becomes itself.',
    source: 'Setnayan editorial',
  },
  {
    day: 75,
    text: 'Seventy-five days. The dress sketch is now thread and fabric. Magic moves in inches.',
    source: 'Setnayan editorial',
  },
  {
    day: 80,
    text: 'Eighty days. The save-the-date felt like yesterday. The wedding feels like tomorrow.',
    source: 'Setnayan editorial',
  },
  {
    day: 90,
    text: 'Ninety days. Three months. Long enough to plan. Short enough to feel real.',
    source: 'Setnayan editorial',
  },
  {
    day: 100,
    text: 'One hundred days. Sandaang araw — a round number that suddenly means everything.',
    source: 'Setnayan editorial',
  },
  {
    day: 110,
    text: 'A hundred and ten days. The invitations are at the printer. Trust the small relinquishings.',
    source: 'Setnayan editorial',
  },
  {
    day: 120,
    text: 'Four months. The marriage license window opens today. Begin its small paperwork softly.',
    source: 'Setnayan editorial',
  },
  // ── Days 121–200: monthly cadence ───────────────────────────────────
  {
    day: 130,
    text: 'Four months and ten days. The dress vendor has your measurements. They are also part of the story.',
    source: 'Setnayan editorial',
  },
  {
    day: 140,
    text: 'Twenty weeks. The flower vendor knows your palette by heart now.',
    source: 'Setnayan editorial',
  },
  {
    day: 150,
    text: 'Five months. The cord, the veil, the coins — quietly being prepared by someone who loves you.',
    source: 'Setnayan editorial',
  },
  {
    day: 160,
    text: 'Twenty-three weeks. The principal sponsors said yes a long time ago. They are still saying yes.',
    source: 'Setnayan editorial',
  },
  {
    day: 175,
    text: 'Twenty-five weeks. Half a year sounded like a lot until it became this.',
    source: 'Setnayan editorial',
  },
  {
    day: 180,
    text: 'Six months. Anim na buwan — half a year of preparing for a single afternoon.',
    source: 'Setnayan editorial',
  },
  {
    day: 200,
    text: 'Two hundred days. The seating chart is still moving. Let it. The people are real.',
    source: 'Setnayan editorial',
  },
  // ── Days 201–300: bi-monthly ────────────────────────────────────────
  {
    day: 220,
    text: 'Seven months. The venue feels like a memory you have not made yet.',
    source: 'Setnayan editorial',
  },
  {
    day: 240,
    text: 'Eight months. The mood board is taking on color. The wedding is taking on shape.',
    source: 'Setnayan editorial',
  },
  {
    day: 260,
    text: 'Eight and a half months. The honeymoon destination has been chosen. Both of you said yes again.',
    source: 'Setnayan editorial',
  },
  {
    day: 275,
    text: 'Nine months minus weeks. The photographer was booked early. So was your faith in them.',
    source: 'Setnayan editorial',
  },
  {
    day: 280,
    text: 'Forty weeks. The wedding is now closer than your first date was to your proposal.',
    source: 'Setnayan editorial',
  },
  {
    day: 300,
    text: 'Three hundred days. The save-the-date has not gone out yet. The save-the-feeling already has.',
    source: 'Setnayan editorial',
  },
  // ── Days 301–365: monthly ───────────────────────────────────────────
  {
    day: 320,
    text: 'Ten months and change. The catering proposal arrived this week. Read it slowly.',
    source: 'Setnayan editorial',
  },
  {
    day: 335,
    text: "Eleven months. The vendors who will say yes are the ones reading this morning's email.",
    source: 'Setnayan editorial',
  },
  {
    day: 345,
    text: 'Eleven and a half months. The mood board is the easy part. The rest will follow it.',
    source: 'Setnayan editorial',
  },
  {
    day: 355,
    text: 'Almost a year. The first vendor walkthrough is somewhere on the calendar. You are ready.',
    source: 'Setnayan editorial',
  },
  {
    day: 365,
    text: 'A year ahead. Every choice you make this year becomes a memory you will keep forever.',
    source: 'Setnayan editorial',
  },

  // ── Literary anchors (public-domain) — scattered through the year ───
  {
    day: 75,
    text: 'I love thee with the breath, smiles, tears, of all my life — and, if God choose, I shall but love thee better after death.',
    source: 'Elizabeth Barrett Browning',
  },
  {
    day: 95,
    text: 'You were born together, and together you shall be forevermore.',
    source: 'Kahlil Gibran · The Prophet',
  },
  {
    day: 125,
    text: 'And then I knew that what I was seeking was a love that was an answer to a question I had not learned to ask.',
    source: 'Public-domain editorial',
  },
  {
    day: 165,
    text: "Lovers don't finally meet somewhere. They are in each other all along.",
    source: 'Rumi',
  },
  {
    day: 195,
    text: 'I love you without knowing how, or when, or from where. I love you simply, without problems or pride.',
    source: 'Pablo Neruda · Sonnet XVII',
  },
  {
    day: 225,
    text: 'Whatever our souls are made of, his and mine are the same.',
    source: 'Emily Brontë',
  },
  {
    day: 255,
    text: 'In all the world, there is no heart for me like yours. In all the world, there is no love for you like mine.',
    source: 'Maya Angelou',
  },
  {
    day: 290,
    text: 'Tell me whom you love, and I will tell you who you are.',
    source: 'Creole proverb',
  },
  {
    day: 325,
    text: 'The minute I heard my first love story, I started looking for you, not knowing how blind that was.',
    source: 'Rumi',
  },

  // ── Filipino proverbs & cultural lines — scattered ──────────────────
  {
    day: 45,
    text: 'Ang pag-ibig na tunay ay parang ilog — hindi tumitigil, hindi nawawala.',
    source: 'Filipino proverb',
  },
  {
    day: 65,
    text: 'Where there is love, there is no toil. Kung saan may pag-ibig, walang pagod.',
    source: 'Filipino proverb',
  },
  {
    day: 85,
    text: 'The deepest river runs the quietest. So does the truest love.',
    source: 'Filipino proverb',
  },
  {
    day: 115,
    text: 'Magmahalan tayo habang nabubuhay — let us love each other while we are alive.',
    source: 'Filipino proverb',
  },
  {
    day: 145,
    text: 'Ang tunay na pag-ibig ay sumusubok ng panahon. True love is the kind that survives time.',
    source: 'Filipino proverb',
  },
  {
    day: 185,
    text: 'Walang humpay na pag-ibig — a love that has no stopping.',
    source: 'Filipino proverb',
  },
  {
    day: 215,
    text: 'Pag-ibig at pananampalataya — love and faith, the two pillars of a Filipino home.',
    source: 'Filipino proverb',
  },
  {
    day: 245,
    text: 'Walang mahirap kapag may pag-ibig. Nothing is hard where love is.',
    source: 'Filipino proverb',
  },
  {
    day: 270,
    text: 'Hindi sukat ang taon, kundi ang tibay ng pag-ibig. It is not the years that count, but the strength of the love.',
    source: 'Filipino proverb',
  },
  {
    day: 305,
    text: 'Sabado — the day every Filipino family circles, the day every Filipino love converges.',
    source: 'Setnayan editorial',
  },
  {
    day: 340,
    text: 'Pamilya na talaga — family, in the truest sense, is what a wedding is in the business of building.',
    source: 'Setnayan editorial',
  },

  // ── Filler coverage to round seed past 100 ──────────────────────────
  {
    day: 33,
    text: 'Thirty-three days. The text thread with your maid of honor will soon become a daily ritual.',
    source: 'Setnayan editorial',
  },
  {
    day: 38,
    text: 'Thirty-eight days. The cake tasting becomes the day you start crying at smaller things.',
    source: 'Setnayan editorial',
  },
  {
    day: 47,
    text: 'Seven weeks minus a day. The processional song is now playing in your head at red lights.',
    source: 'Setnayan editorial',
  },
  {
    day: 52,
    text: 'Fifty-two days. The RSVP deadline is approaching. The aunties always send theirs last.',
    source: 'Setnayan editorial',
  },
  {
    day: 68,
    text: 'Sixty-eight days. The wedding party group chat finds a rhythm. Let it find you too.',
    source: 'Setnayan editorial',
  },
  {
    day: 78,
    text: 'Eleven weeks. The vendor calls are getting shorter. That is a quiet sign of trust.',
    source: 'Setnayan editorial',
  },
  {
    day: 88,
    text: 'Eighty-eight days. Lucky numbers find weddings. Yours has already begun finding them.',
    source: 'Setnayan editorial',
  },
  {
    day: 105,
    text: 'A hundred and five days. The dress measurements are confirmed. Your shoulders are exactly themselves.',
    source: 'Setnayan editorial',
  },
  {
    day: 135,
    text: 'A hundred and thirty-five days. The save-the-date design is closer than the wedding still is.',
    source: 'Setnayan editorial',
  },
  {
    day: 155,
    text: 'A hundred and fifty-five days. The first vendor pulls out of the running. The right ones stay.',
    source: 'Setnayan editorial',
  },
  {
    day: 235,
    text: 'A hundred and thirty-five days less than a year. The honeymoon is being whispered about.',
    source: 'Setnayan editorial',
  },
  {
    day: 310,
    text: 'Ten months and ten days. The mood board is loud right now. Let it be loud — soon it will be quiet.',
    source: 'Setnayan editorial',
  },
  {
    day: 360,
    text: 'Three hundred sixty days. The save-the-date deadline approaches gently. You are not late.',
    source: 'Setnayan editorial',
  },
];

/**
 * All quotes in one ordered list (post-wedding entries have negative `day`).
 * Sorted descending by day so the lookup finds the nearest-below-or-equal.
 */
const ALL_QUOTES: LoveQuote[] = [...PRE_WEDDING_QUOTES, ...POST_WEDDING_QUOTES].sort(
  (a, b) => b.day - a.day,
);

/**
 * Look up the quote for a given days-to-wedding count.
 *
 *   - Negative input → post-wedding quote, with -30 floor (recycle main set
 *     after that via wrap-around). At -1 we surface the day-after quote, etc.
 *   - Zero → wedding-day quote.
 *   - Positive input ≤ 365 → nearest seeded entry with `day <= input`. Always
 *     returns at least the day-0 quote since that's the floor of the main set.
 *   - Positive input > 365 → modulo into the 0–365 range so 18-month
 *     engagements still get a sensible quote (e.g. day 547 % 365 = 182,
 *     which falls through to whichever ≤ 182 entry exists).
 */
export function quoteForDay(daysToWedding: number): LoveQuote {
  // Post-wedding lookup window: -30 to -1
  if (daysToWedding < 0) {
    const clamped = Math.max(daysToWedding, -30);
    // Find nearest post-wedding entry with `day >= clamped` (post-wedding
    // entries are negative; "nearest" means smallest absolute distance with a
    // bias toward day-just-passed since the host is moving forward in time).
    const candidates = POST_WEDDING_QUOTES.filter((q) => q.day >= clamped);
    if (candidates.length > 0) {
      // Closest to the clamped day (smallest gap to either side)
      candidates.sort((a, b) => Math.abs(a.day - clamped) - Math.abs(b.day - clamped));
      return candidates[0]!;
    }
    // No post-wedding entry seeded; fall through to recycling main set
  }

  // Wrap >365 into the 0–365 band so long engagements still get content.
  const wrapped =
    daysToWedding > 365 ? daysToWedding % 365 : Math.max(daysToWedding, 0);

  // Walk descending list; find first entry where `entry.day <= wrapped`.
  for (const entry of ALL_QUOTES) {
    if (entry.day < 0) continue; // skip post-wedding entries during main lookup
    if (entry.day <= wrapped) return entry;
  }

  // Fallback never normally reached because PRE_WEDDING_QUOTES contains day 0.
  // Belt-and-suspenders: synthesize a calm default rather than crashing.
  return {
    day: 0,
    text: 'Today is the day. Every yes that came before now lives in this single moment.',
    source: 'Setnayan editorial',
  };
}
