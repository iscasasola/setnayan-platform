/**
 * Love-quote-of-the-day · pressure-aware cycling library keyed on
 * days-to-wedding · split by gender-coded experience of wedding planning.
 *
 * Owner directive 2026-05-22 (verbatim · 4 changes bundled):
 *   1. "pops up for 5 seconds ONCE per day · disappears after · reappears
 *       next day just once."  → client component + localStorage day-tracking.
 *   2. "REWRITE all entries to align with wedding planning PRESSURE +
 *       motivate the host to KEEP PUSHING FORWARD + STAY IN LOVE through
 *       the stress."  → tone rewrite of every entry below.
 *   3. "Visibility scoped to bride · groom · partner1 · partner2."  → handled
 *       in the component; the host's role_subtype gates the popup entirely.
 *   4. "TWO parallel 365-day quote sets · one for the BRIDE · one for the
 *       GROOM. Distinct emotional through-lines per gender experience of
 *       wedding planning."  → two arrays below; partner1/partner2 alternate
 *       by day-parity (deterministic per day, not random).
 *
 * The bride set carries decision-fatigue + dress-fittings + family-expectation
 * pressure-vocabulary. The groom set carries logistical + financial +
 * friend-network pressure-vocabulary. Both lean into the wedding-grind reality
 * but always close on a forward-pushing or stay-in-love note.
 *
 * Lookup contract (per role_subtype):
 *   - bride         → LOVE_QUOTES_BRIDE
 *   - groom         → LOVE_QUOTES_GROOM
 *   - partner1      → alternates by day parity (even → bride · odd → groom)
 *   - partner2      → alternates by day parity (even → bride · odd → groom)
 *   - other roles   → null (no quote · component returns null)
 *
 * Day mapping:
 *   - day  365 → 1 year out (earliest quote)
 *   - day    0 → wedding day (final pre-wedding quote)
 *   - day  < 0 → wraps via modulo (couples are forward-only on event home)
 *   - day > 365 → modulo into the 0–365 range so long engagements get a
 *                  sensible quote instead of an error
 *
 * Voice (per [[feedback_setnayan_no_dev_text_post_launch]] + CLAUDE.md
 *   2026-05-12 "luxurious, Filipino, modern" lock):
 *   - Cormorant-italic-display register
 *   - ~120-character ceiling (single-line on a 5-second popup banner)
 *   - Pressure-aware: name the grind, then offer the forward push
 *   - Filipino-cultural where it lands naturally (pamilya · pamamanhikan ·
 *     ninang · pakanta · barong · gown · sponsors · ber-months) but never
 *     forced — English is the brand-voice default
 *   - Source attributions are mostly Setnayan editorial originals (rewritten
 *     from neutral lines into pressure-aware ones); a handful of public-domain
 *     literary anchors remain at quieter milestone-day positions
 */

export type LoveQuote = {
  /** 0 = wedding day · 1 = day before · 365 = 1 year out */
  day: number;
  text: string;
  source?: string;
};

export type LoveQuoteRole = 'bride' | 'groom' | 'partner1' | 'partner2';

/**
 * BRIDE quotes · ~100 entries · gender-coded around decision-fatigue,
 * dress-fittings, family-expectation, social-media-overwhelm, and the
 * particular weight of being-looked-at during the months of planning.
 *
 * Tone is uplifting through the grind, never minimizing. Lines acknowledge
 * the work then redirect to the love.
 */
export const LOVE_QUOTES_BRIDE: LoveQuote[] = [
  // ── Wedding day & the final week ─────────────────────────────────────
  {
    day: 0,
    text: 'Today is the day. The dress fits, the day arrived, and so did you.',
    source: 'Setnayan editorial',
  },
  {
    day: 1,
    text: "Tomorrow. You've already done the hardest thing — chosen each other.",
    source: 'Setnayan editorial',
  },
  {
    day: 2,
    text: 'Two days. The decisions are made. The doubts can rest. The dress is yours.',
    source: 'Setnayan editorial',
  },
  {
    day: 3,
    text: 'Three days out. Every fitting was worth it. Every late call was worth it. Trust the work.',
    source: 'Setnayan editorial',
  },
  {
    day: 4,
    text: 'Four days. The to-do list shrinks. The love grows. Let it grow louder than the list.',
    source: 'Setnayan editorial',
  },
  {
    day: 5,
    text: 'Five days. The mirror has already seen the bride. Tomorrow the room will too.',
    source: 'Setnayan editorial',
  },
  {
    day: 6,
    text: 'Six days. The phone calls slow this week. The whispers in your own heart get louder.',
    source: 'Setnayan editorial',
  },
  {
    day: 7,
    text: 'One week. Look at him. The wedding is already won.',
    source: 'Setnayan editorial',
  },
  // ── Second week out ─────────────────────────────────────────────────
  {
    day: 8,
    text: 'Eight days. The aunties will text more often this week. Reply when you can. Breathe when you cannot.',
    source: 'Setnayan editorial',
  },
  {
    day: 9,
    text: 'Nine days. Every dress fitting was a rehearsal for standing tall on the day. You are ready.',
    source: 'Setnayan editorial',
  },
  {
    day: 10,
    text: 'Ten days. The hard parts now are the stories you will tell laughing later.',
    source: 'Setnayan editorial',
  },
  {
    day: 11,
    text: 'Eleven days. Sleep matters more than the seating chart this week. Choose your rest.',
    source: 'Setnayan editorial',
  },
  {
    day: 12,
    text: 'Twelve days. The HMUA has already imagined your light. Trust their hands.',
    source: 'Setnayan editorial',
  },
  {
    day: 13,
    text: 'Thirteen days. The list will not finish itself. But love will outlast the list.',
    source: 'Setnayan editorial',
  },
  {
    day: 14,
    text: 'Two weeks. The decision fatigue passes. The decision itself never will.',
    source: 'Setnayan editorial',
  },
  // ── Third week out ──────────────────────────────────────────────────
  {
    day: 15,
    text: 'Fifteen days. Every text from your ninang is love trying to organize itself. Receive it.',
    source: 'Setnayan editorial',
  },
  {
    day: 16,
    text: 'Sixteen days. The dress is hanging quietly. So can you. Tonight.',
    source: 'Setnayan editorial',
  },
  {
    day: 17,
    text: 'Seventeen days. The expectations from family are a kind of love. Tiring, but love.',
    source: 'Setnayan editorial',
  },
  {
    day: 18,
    text: 'Eighteen days. Save one quiet morning this week for just yourself. The bride needs the woman intact.',
    source: 'Setnayan editorial',
  },
  {
    day: 19,
    text: 'Nineteen days. The Instagram comparison will not help. Look at your fiancé instead.',
    source: 'Setnayan editorial',
  },
  {
    day: 20,
    text: 'Twenty days. The hardest day of planning is not the wedding day. Today is harder. You are still here.',
    source: 'Setnayan editorial',
  },
  {
    day: 21,
    text: 'Three weeks. Tatlong linggo na lang — three weeks of being looked at. Then the looking becomes loving.',
    source: 'Setnayan editorial',
  },
  // ── Fourth week out (last full month) ───────────────────────────────
  {
    day: 22,
    text: 'Twenty-two days. The seating chart will not get more perfect. Let it be human.',
    source: 'Setnayan editorial',
  },
  {
    day: 23,
    text: 'Twenty-three days. Every RSVP that lands is one less thing to wonder about. Notice the lightening.',
    source: 'Setnayan editorial',
  },
  {
    day: 24,
    text: 'Twenty-four days. The principal sponsors said yes for a reason. Their yes is your safety net.',
    source: 'Setnayan editorial',
  },
  {
    day: 25,
    text: 'Twenty-five days. The dress sketch became thread became fabric became yours. Magic moves in inches.',
    source: 'Setnayan editorial',
  },
  {
    day: 26,
    text: 'Twenty-six days. The playlist is the soundtrack of who you are right now. Future-you will remember.',
    source: 'Setnayan editorial',
  },
  {
    day: 27,
    text: 'Twenty-seven days. Eat the meal. Sleep the night. The wedding cannot run on an empty bride.',
    source: 'Setnayan editorial',
  },
  {
    day: 28,
    text: 'Twenty-eight days. Four weeks. The shape is visible from across the room. So is your tiredness. Both are normal.',
    source: 'Setnayan editorial',
  },
  {
    day: 29,
    text: 'Twenty-nine days. The last RSVP will come in late. The aunties always do. That is its own kind of love.',
    source: 'Setnayan editorial',
  },
  {
    day: 30,
    text: 'A month. Isang buwan. Every fitting feels endless — until the last one. Keep going.',
    source: 'Setnayan editorial',
  },
  // ── Days 31–60 ──────────────────────────────────────────────────────
  {
    day: 33,
    text: 'Thirty-three days. The maid of honor text thread is a kind of medicine. Use it.',
    source: 'Setnayan editorial',
  },
  {
    day: 35,
    text: 'Five weeks. The dress alterations are this week. Stand still. Let yourself be measured into the bride.',
    source: 'Setnayan editorial',
  },
  {
    day: 38,
    text: 'Thirty-eight days. The cake tasting will make you cry for no reason. That is the reason. Let it.',
    source: 'Setnayan editorial',
  },
  {
    day: 42,
    text: 'Six weeks. The Pre-Cana is behind you. The promises are ahead. The middle is just walking.',
    source: 'Setnayan editorial',
  },
  {
    day: 45,
    text: "Forty-five days. The vendor calls feel heavy. The reason they exist — the wedding — is light. Don't forget.",
    source: 'Setnayan editorial',
  },
  {
    day: 47,
    text: 'Seven weeks minus a day. The processional song plays in your head at red lights. That is love rehearsing.',
    source: 'Setnayan editorial',
  },
  {
    day: 49,
    text: 'Seven weeks. The RSVPs are landing. Some yeses surprise you. Some nos surprise you more. Both teach.',
    source: 'Setnayan editorial',
  },
  {
    day: 52,
    text: "Fifty-two days. The deadline pressure is real. The reason for the deadline — your wedding — is realer.",
    source: 'Setnayan editorial',
  },
  {
    day: 56,
    text: 'Eight weeks. Every dress fitting is a step toward a body you already had. The dress reveals you.',
    source: 'Setnayan editorial',
  },
  {
    day: 60,
    text: 'Two months. Dalawang buwan. The decision fatigue is loudest now. The decision was right. Trust yourself.',
    source: 'Setnayan editorial',
  },
  // ── Days 61–120 ─────────────────────────────────────────────────────
  {
    day: 68,
    text: 'Sixty-eight days. The wedding party group chat finds its rhythm. Lean into the noise — it is love being organized.',
    source: 'Setnayan editorial',
  },
  {
    day: 70,
    text: 'Ten weeks. The mood board has stopped changing. That is the moment a wedding becomes itself.',
    source: 'Setnayan editorial',
  },
  {
    day: 75,
    text: 'Seventy-five days. The dress sketch is now thread and needle. Someone is making your moment by hand.',
    source: 'Setnayan editorial',
  },
  {
    day: 78,
    text: 'Eleven weeks. The vendor calls get shorter. That is trust forming. Let it form.',
    source: 'Setnayan editorial',
  },
  {
    day: 80,
    text: 'Eighty days. Your face will appear on a printed save-the-date this week. Be kind to it when it arrives.',
    source: 'Setnayan editorial',
  },
  {
    day: 85,
    text: 'Eighty-five days. The aunties will offer unsolicited dress advice. Say thank you. Then trust your own eye.',
    source: 'Setnayan editorial',
  },
  {
    day: 88,
    text: 'Eighty-eight days. Lucky numbers find weddings. Yours is already finding them.',
    source: 'Setnayan editorial',
  },
  {
    day: 90,
    text: 'Ninety days. Three months. Long enough to plan. Short enough to feel suddenly real. Both are true.',
    source: 'Setnayan editorial',
  },
  {
    day: 95,
    text: 'Ninety-five days. The dress vendor has your measurements. They are also part of the story now.',
    source: 'Setnayan editorial',
  },
  {
    day: 100,
    text: 'Halfway home. The hard parts now are the stories you will tell laughing later.',
    source: 'Setnayan editorial',
  },
  {
    day: 105,
    text: 'A hundred and five days. The dress is on the calendar twice this month. Show up for both fittings.',
    source: 'Setnayan editorial',
  },
  {
    day: 110,
    text: 'A hundred and ten days. The invitations are at the printer. Trust the small relinquishings.',
    source: 'Setnayan editorial',
  },
  {
    day: 115,
    text: 'A hundred and fifteen days. The HMUA trial is coming. Bring a face that has slept. Trust them with the rest.',
    source: 'Setnayan editorial',
  },
  {
    day: 120,
    text: 'Four months. The marriage license window opens today. Begin its small paperwork softly.',
    source: 'Setnayan editorial',
  },
  // ── Days 121–200 ────────────────────────────────────────────────────
  {
    day: 130,
    text: 'Four months ten days. The dress measurements feel exposing. They are just numbers. You are not.',
    source: 'Setnayan editorial',
  },
  {
    day: 135,
    text: 'A hundred and thirty-five days. The save-the-date design is closer than the wedding still is. Trust the lead time.',
    source: 'Setnayan editorial',
  },
  {
    day: 140,
    text: 'Twenty weeks. The florist knows your palette by heart. They are already imagining your bouquet.',
    source: 'Setnayan editorial',
  },
  {
    day: 145,
    text: 'A hundred and forty-five days. Family weddings are messy with love. Receive the mess. It is not a problem.',
    source: 'Setnayan editorial',
  },
  {
    day: 150,
    text: 'Five months. The cord, the veil, the coins — quietly being prepared by someone who loves you.',
    source: 'Setnayan editorial',
  },
  {
    day: 155,
    text: 'A hundred fifty-five days. The first vendor pulls out. The right vendors stay. Trust the staying.',
    source: 'Setnayan editorial',
  },
  {
    day: 160,
    text: 'Twenty-three weeks. The principal sponsors said yes a long time ago. They are still saying yes.',
    source: 'Setnayan editorial',
  },
  {
    day: 175,
    text: 'Twenty-five weeks. Half a year sounded like a lot until it became this. Halfway is the work peaking.',
    source: 'Setnayan editorial',
  },
  {
    day: 180,
    text: 'Six months. Anim na buwan. The first half is louder than the second. You are over the hill.',
    source: 'Setnayan editorial',
  },
  {
    day: 195,
    text: 'I love you without knowing how, or when, or from where. I love you simply, without problems or pride.',
    source: 'Pablo Neruda · Sonnet XVII',
  },
  {
    day: 200,
    text: '200 days. The decision fatigue passes. The decision itself never will. Keep choosing him.',
    source: 'Setnayan editorial',
  },
  // ── Days 201–300 ────────────────────────────────────────────────────
  {
    day: 215,
    text: 'Pag-ibig at pananampalataya — love and faith, the two pillars of a Filipino home. Both are still standing.',
    source: 'Filipino proverb',
  },
  {
    day: 220,
    text: 'Seven months. The venue feels like a memory you have not made yet. Trust the future remembering.',
    source: 'Setnayan editorial',
  },
  {
    day: 225,
    text: 'Whatever our souls are made of, his and mine are the same.',
    source: 'Emily Brontë',
  },
  {
    day: 235,
    text: 'A hundred and thirty-five days less than a year. The honeymoon is being whispered about now.',
    source: 'Setnayan editorial',
  },
  {
    day: 240,
    text: 'Eight months. The mood board is taking on color. The wedding is taking on shape. Both need patience.',
    source: 'Setnayan editorial',
  },
  {
    day: 245,
    text: 'Walang mahirap kapag may pag-ibig. Nothing is hard where love is. Today is the day to test that.',
    source: 'Filipino proverb',
  },
  {
    day: 255,
    text: 'In all the world, there is no heart for me like yours. In all the world, there is no love for you like mine.',
    source: 'Maya Angelou',
  },
  {
    day: 260,
    text: 'Eight and a half months. The honeymoon destination has been chosen. Both of you said yes again.',
    source: 'Setnayan editorial',
  },
  {
    day: 270,
    text: 'Hindi sukat ang taon, kundi ang tibay ng pag-ibig. It is not the years that count, but the strength of the love.',
    source: 'Filipino proverb',
  },
  {
    day: 275,
    text: 'Nine months minus weeks. The photographer was booked early. So was your faith in them. Trust both.',
    source: 'Setnayan editorial',
  },
  {
    day: 280,
    text: 'Forty weeks. The wedding is now closer than your first date was to your proposal. The math is on your side.',
    source: 'Setnayan editorial',
  },
  {
    day: 290,
    text: 'Tell me whom you love, and I will tell you who you are.',
    source: 'Creole proverb',
  },
  {
    day: 300,
    text: 'Three hundred days. The save-the-date has not gone out yet. The save-the-feeling already has. That is the harder yes.',
    source: 'Setnayan editorial',
  },
  // ── Days 301–365 ────────────────────────────────────────────────────
  {
    day: 310,
    text: 'Ten months and ten days. The mood board is loud right now. Let it be loud — soon it will be quiet.',
    source: 'Setnayan editorial',
  },
  {
    day: 320,
    text: 'Ten months and change. The catering proposal arrived this week. Read it slowly. Eat tonight.',
    source: 'Setnayan editorial',
  },
  {
    day: 325,
    text: 'The minute I heard my first love story, I started looking for you, not knowing how blind that was.',
    source: 'Rumi',
  },
  {
    day: 335,
    text: "Eleven months. The vendors who will say yes are the ones reading this morning's email. Trust the inbox.",
    source: 'Setnayan editorial',
  },
  {
    day: 340,
    text: 'Pamilya na talaga — family, in the truest sense, is what the wedding is in the business of building.',
    source: 'Setnayan editorial',
  },
  {
    day: 345,
    text: "Eleven and a half months. The mood board is the easy part. The rest will follow it. You can't rush a year.",
    source: 'Setnayan editorial',
  },
  {
    day: 355,
    text: 'Almost a year. The first vendor walkthrough is somewhere on the calendar. You are not late. You are early.',
    source: 'Setnayan editorial',
  },
  {
    day: 360,
    text: 'Three hundred sixty days. The save-the-date deadline approaches gently. You are not late. Trust the calendar.',
    source: 'Setnayan editorial',
  },
  {
    day: 365,
    text: 'A year ahead. The planning starts today, but the choosing already happened. The hard part is behind you.',
    source: 'Setnayan editorial',
  },
];

/**
 * GROOM quotes · ~100 entries · gender-coded around logistical pressure,
 * financial weight, friend-network expectations, family-of-bride dynamics,
 * the particular quietness of being-supportive while the bride carries
 * visibility. Lines acknowledge the load then redirect to the love.
 */
export const LOVE_QUOTES_GROOM: LoveQuote[] = [
  // ── Wedding day & the final week ─────────────────────────────────────
  {
    day: 0,
    text: 'Today. The plans, the cost, the noise — all behind. The marriage starts now.',
    source: 'Setnayan editorial',
  },
  {
    day: 1,
    text: 'Tomorrow. You have chosen well. Now stand by your choice.',
    source: 'Setnayan editorial',
  },
  {
    day: 2,
    text: 'Two days. The numbers are final. The plan is locked. Now just show up for her.',
    source: 'Setnayan editorial',
  },
  {
    day: 3,
    text: 'Three days out. Every spreadsheet was worth it. Every late-night call with the venue was worth it.',
    source: 'Setnayan editorial',
  },
  {
    day: 4,
    text: 'Four days. The vendor calls slow this week. Your shoulders will start to feel lighter. Let them.',
    source: 'Setnayan editorial',
  },
  {
    day: 5,
    text: 'Five days. The suit fits. The route is timed. The work was real and is now finished.',
    source: 'Setnayan editorial',
  },
  {
    day: 6,
    text: 'Six days. Your job this week is not the venue. It is being beside her, in the small moments.',
    source: 'Setnayan editorial',
  },
  {
    day: 7,
    text: 'One week. Look at her. The wedding is already won.',
    source: 'Setnayan editorial',
  },
  // ── Second week out ─────────────────────────────────────────────────
  {
    day: 8,
    text: 'Eight days. Your barong is hanging quietly. So is the noise of the past months. Both have done their work.',
    source: 'Setnayan editorial',
  },
  {
    day: 9,
    text: 'Nine days. The principal sponsors will need confirming. One last round of texts. Then rest.',
    source: 'Setnayan editorial',
  },
  {
    day: 10,
    text: 'Ten days. The hard parts now are the stories you will tell your sons one day.',
    source: 'Setnayan editorial',
  },
  {
    day: 11,
    text: 'Eleven days. Sleep beats spreadsheet this week. Choose your rest. The wedding needs you intact.',
    source: 'Setnayan editorial',
  },
  {
    day: 12,
    text: 'Twelve days. The friend who is your best man is more nervous than he says. Check on him.',
    source: 'Setnayan editorial',
  },
  {
    day: 13,
    text: 'Thirteen days. The bridal car is booked, the route is driven, the work is yours and it is done.',
    source: 'Setnayan editorial',
  },
  {
    day: 14,
    text: 'Two weeks. Your job is not to handle everything. It is to show up for her.',
    source: 'Setnayan editorial',
  },
  // ── Third week out ──────────────────────────────────────────────────
  {
    day: 15,
    text: 'Fifteen days. The cord, the veil, the coins — already arranged by someone who loves you both.',
    source: 'Setnayan editorial',
  },
  {
    day: 16,
    text: 'Sixteen days. The finances are settled. Stop checking the spreadsheet at midnight. Sleep.',
    source: 'Setnayan editorial',
  },
  {
    day: 17,
    text: "Seventeen days. Her family's expectations are a kind of love. Heavy, but love. Receive them.",
    source: 'Setnayan editorial',
  },
  {
    day: 18,
    text: 'Eighteen days. The wedding party already knows what to do. Stop briefing them. Trust the team.',
    source: 'Setnayan editorial',
  },
  {
    day: 19,
    text: 'Nineteen days. The barong is in the closet. The promise is in your chest. Both will hold.',
    source: 'Setnayan editorial',
  },
  {
    day: 20,
    text: 'Twenty days. The vendor follow-up is the last thing you owe the wedding. After that, you owe her.',
    source: 'Setnayan editorial',
  },
  {
    day: 21,
    text: 'Three weeks. Tatlong linggo na lang — three weeks of logistics. Then a lifetime of just being there.',
    source: 'Setnayan editorial',
  },
  // ── Fourth week out (last full month) ───────────────────────────────
  {
    day: 22,
    text: 'Twenty-two days. The seating chart will not get more perfect. Sign off and walk away.',
    source: 'Setnayan editorial',
  },
  {
    day: 23,
    text: 'Twenty-three days. Every RSVP that lands is one less number to track. Notice the lightening.',
    source: 'Setnayan editorial',
  },
  {
    day: 24,
    text: 'Twenty-four days. The principal sponsors said yes a long time ago. Their yes is your safety net.',
    source: 'Setnayan editorial',
  },
  {
    day: 25,
    text: 'Twenty-five days. The friends who will stand with you are already practicing. Trust the practice.',
    source: 'Setnayan editorial',
  },
  {
    day: 26,
    text: 'Twenty-six days. The financial pressure peaks somewhere around now. It will not last forever. You will.',
    source: 'Setnayan editorial',
  },
  {
    day: 27,
    text: 'Twenty-seven days. Eat. Sleep. The wedding cannot run on an empty groom either.',
    source: 'Setnayan editorial',
  },
  {
    day: 28,
    text: 'Twenty-eight days. Four weeks. The shape of the day is visible. So is your tiredness. Both are normal.',
    source: 'Setnayan editorial',
  },
  {
    day: 29,
    text: 'Twenty-nine days. The last RSVP will come in late. The tito will text the morning of. Both are love.',
    source: 'Setnayan editorial',
  },
  {
    day: 30,
    text: 'A month. Isang buwan. The hard part is not the day. The hard part is now. Keep going.',
    source: 'Setnayan editorial',
  },
  // ── Days 31–60 ──────────────────────────────────────────────────────
  {
    day: 33,
    text: 'Thirty-three days. The best man text thread is louder than you remember. Lean in. They are with you.',
    source: 'Setnayan editorial',
  },
  {
    day: 35,
    text: 'Five weeks. The suit fitting is this week. Stand still. Let yourself be measured into the groom.',
    source: 'Setnayan editorial',
  },
  {
    day: 38,
    text: 'Thirty-eight days. The cake tasting will make her cry for no reason. Bring tissues. Be the steady one.',
    source: 'Setnayan editorial',
  },
  {
    day: 42,
    text: 'Six weeks. The Pre-Cana is behind you. The vows are ahead. The middle is just walking together.',
    source: 'Setnayan editorial',
  },
  {
    day: 45,
    text: "Forty-five days. The vendor calls feel heavy. The reason for the calls — your wedding — is light. Don't forget.",
    source: 'Setnayan editorial',
  },
  {
    day: 47,
    text: 'Seven weeks minus a day. The processional song plays in your head while driving. That is love rehearsing.',
    source: 'Setnayan editorial',
  },
  {
    day: 49,
    text: 'Seven weeks. The RSVPs are landing. Some friends surprise you. Some nos surprise you more. Both teach.',
    source: 'Setnayan editorial',
  },
  {
    day: 52,
    text: "Fifty-two days. The deadline pressure is real. The reason for the deadline — your marriage — is realer.",
    source: 'Setnayan editorial',
  },
  {
    day: 56,
    text: 'Eight weeks. The financials feel sharper now. Trust the numbers you already ran. They will hold.',
    source: 'Setnayan editorial',
  },
  {
    day: 60,
    text: 'Two months. Dalawang buwan. The logistical pressure is loudest now. Keep your shoulders back. Keep going.',
    source: 'Setnayan editorial',
  },
  // ── Days 61–120 ─────────────────────────────────────────────────────
  {
    day: 68,
    text: "Sixty-eight days. The wedding party group chat finds its rhythm. Let it run without you for a day.",
    source: 'Setnayan editorial',
  },
  {
    day: 70,
    text: 'Ten weeks. The mood board has stopped changing. The plan is now the plan. Stop second-guessing.',
    source: 'Setnayan editorial',
  },
  {
    day: 75,
    text: 'Seventy-five days. The suit is at the tailor. Someone is making your moment by hand. Trust the hand.',
    source: 'Setnayan editorial',
  },
  {
    day: 78,
    text: 'Eleven weeks. The vendor calls get shorter. That is trust forming. Let it form. Stop pushing.',
    source: 'Setnayan editorial',
  },
  {
    day: 80,
    text: 'Eighty days. Her face will appear on a printed save-the-date this week. Be the first to compliment it.',
    source: 'Setnayan editorial',
  },
  {
    day: 85,
    text: 'Eighty-five days. The tito will give unsolicited financial advice. Say thank you. Then trust your own math.',
    source: 'Setnayan editorial',
  },
  {
    day: 88,
    text: 'Eighty-eight days. Lucky numbers find weddings. Yours is already finding them.',
    source: 'Setnayan editorial',
  },
  {
    day: 90,
    text: 'Ninety days. Three months. The number that scares you is also the number working FOR you.',
    source: 'Setnayan editorial',
  },
  {
    day: 95,
    text: 'You were born together, and together you shall be forevermore.',
    source: 'Kahlil Gibran · The Prophet',
  },
  {
    day: 100,
    text: '100 days. The number that scares you is also the number working FOR you. Keep walking.',
    source: 'Setnayan editorial',
  },
  {
    day: 105,
    text: 'A hundred and five days. The suit is on the calendar twice this month. Show up for both fittings.',
    source: 'Setnayan editorial',
  },
  {
    day: 110,
    text: 'A hundred and ten days. The invitations are at the printer. Some things are no longer yours to control.',
    source: 'Setnayan editorial',
  },
  {
    day: 115,
    text: 'A hundred and fifteen days. The principal sponsors need their formal letter this week. One task at a time.',
    source: 'Setnayan editorial',
  },
  {
    day: 120,
    text: 'Four months. The marriage license window opens today. Walk through its paperwork together.',
    source: 'Setnayan editorial',
  },
  // ── Days 121–200 ────────────────────────────────────────────────────
  {
    day: 130,
    text: 'Four months ten days. The financial spreadsheet feels heavier than it is. Close the laptop tonight.',
    source: 'Setnayan editorial',
  },
  {
    day: 135,
    text: 'A hundred and thirty-five days. The save-the-date design is closer than the wedding still is. Trust the lead time.',
    source: 'Setnayan editorial',
  },
  {
    day: 140,
    text: 'Twenty weeks. The florist knows the palette by heart. Your job is to compliment the result, not the process.',
    source: 'Setnayan editorial',
  },
  {
    day: 145,
    text: 'A hundred and forty-five days. Filipino weddings are family weddings. The family is loud because they care.',
    source: 'Setnayan editorial',
  },
  {
    day: 150,
    text: 'Five months. The cord, the veil, the coins — quietly being prepared by people who love both of you.',
    source: 'Setnayan editorial',
  },
  {
    day: 155,
    text: 'A hundred fifty-five days. The first vendor pulls out. The right vendors stay. The pivot is part of the plan.',
    source: 'Setnayan editorial',
  },
  {
    day: 160,
    text: 'Twenty-three weeks. The principal sponsors said yes a long time ago. They are still saying yes. Trust the yes.',
    source: 'Setnayan editorial',
  },
  {
    day: 165,
    text: "Lovers don't finally meet somewhere. They are in each other all along.",
    source: 'Rumi',
  },
  {
    day: 175,
    text: 'Twenty-five weeks. Half a year sounded like a lot until it became this. Halfway is the work peaking.',
    source: 'Setnayan editorial',
  },
  {
    day: 180,
    text: 'Six months. Anim na buwan. The hard part of planning is louder now. The reason — her — is steady. Stay steady.',
    source: 'Setnayan editorial',
  },
  {
    day: 185,
    text: 'Walang humpay na pag-ibig — a love that has no stopping. Yours is well past starting.',
    source: 'Filipino proverb',
  },
  {
    day: 200,
    text: "200 days. Enough time to disagree about cake and still pick it together. Keep choosing together.",
    source: 'Setnayan editorial',
  },
  // ── Days 201–300 ────────────────────────────────────────────────────
  {
    day: 215,
    text: 'Pag-ibig at pananampalataya — love and faith, the two pillars of a Filipino home. Build both.',
    source: 'Filipino proverb',
  },
  {
    day: 220,
    text: 'Seven months. The venue feels like a memory you have not made yet. Trust the future remembering.',
    source: 'Setnayan editorial',
  },
  {
    day: 235,
    text: 'A hundred and thirty-five days less than a year. The honeymoon is being whispered about. Whisper back.',
    source: 'Setnayan editorial',
  },
  {
    day: 240,
    text: 'Eight months. The mood board is taking on color. The plan is taking on shape. Both need your patience.',
    source: 'Setnayan editorial',
  },
  {
    day: 245,
    text: 'Walang mahirap kapag may pag-ibig. Nothing is hard where love is. Today is the day to remember.',
    source: 'Filipino proverb',
  },
  {
    day: 255,
    text: 'In all the world, there is no heart for me like yours. In all the world, there is no love for you like mine.',
    source: 'Maya Angelou',
  },
  {
    day: 260,
    text: 'Eight and a half months. The honeymoon destination was chosen. Both of you said yes again. That is the work.',
    source: 'Setnayan editorial',
  },
  {
    day: 270,
    text: 'Hindi sukat ang taon, kundi ang tibay ng pag-ibig. It is not the years that count, but the strength of the love.',
    source: 'Filipino proverb',
  },
  {
    day: 275,
    text: 'Nine months minus weeks. The photographer was booked early. Your faith in them is part of the booking.',
    source: 'Setnayan editorial',
  },
  {
    day: 280,
    text: 'Forty weeks. The wedding is now closer than your first date was to your proposal. The math is on your side.',
    source: 'Setnayan editorial',
  },
  {
    day: 290,
    text: 'Tell me whom you love, and I will tell you who you are.',
    source: 'Creole proverb',
  },
  {
    day: 300,
    text: 'Three hundred days. The save-the-date has not gone out yet. The save-the-feeling already has. That is the harder yes.',
    source: 'Setnayan editorial',
  },
  // ── Days 301–365 ────────────────────────────────────────────────────
  {
    day: 310,
    text: 'Ten months and ten days. The financial planning is loud right now. Soon it will be quieter than the love.',
    source: 'Setnayan editorial',
  },
  {
    day: 320,
    text: 'Ten months and change. The catering proposal arrived this week. Read it twice. Eat tonight regardless.',
    source: 'Setnayan editorial',
  },
  {
    day: 325,
    text: 'The minute I heard my first love story, I started looking for you, not knowing how blind that was.',
    source: 'Rumi',
  },
  {
    day: 335,
    text: "Eleven months. The vendors who will say yes are the ones reading this morning's email. Trust the inbox.",
    source: 'Setnayan editorial',
  },
  {
    day: 340,
    text: 'Pamilya na talaga — family, in the truest sense, is what the wedding is in the business of building.',
    source: 'Setnayan editorial',
  },
  {
    day: 345,
    text: "Eleven and a half months. The plan is the easy part. The marriage is the rest. You're already practicing.",
    source: 'Setnayan editorial',
  },
  {
    day: 355,
    text: 'Almost a year. The first vendor walkthrough is on the calendar. You are not late. You are leading.',
    source: 'Setnayan editorial',
  },
  {
    day: 360,
    text: 'Three hundred sixty days. The save-the-date deadline approaches gently. You are not behind. You are early.',
    source: 'Setnayan editorial',
  },
  {
    day: 365,
    text: 'A year out. The work begins — so does the worth-it.',
    source: 'Setnayan editorial',
  },
];

/**
 * Sort sets descending by day once at module load so the nearest-below lookup
 * walks the array in one direction. Both arrays already authored descending-ish
 * but we sort defensively in case a future maintainer inserts out of order.
 */
const SORTED_BRIDE = [...LOVE_QUOTES_BRIDE].sort((a, b) => b.day - a.day);
const SORTED_GROOM = [...LOVE_QUOTES_GROOM].sort((a, b) => b.day - a.day);

/**
 * Look up the quote for a given days-to-wedding count and role_subtype.
 *
 * Selection rules (per owner directive 2026-05-22):
 *   - role='bride'    → bride set
 *   - role='groom'    → groom set
 *   - role='partner1' → alternate by day-parity (even → bride · odd → groom)
 *   - role='partner2' → alternate by day-parity (even → bride · odd → groom)
 *   - any other role  → null (component returns null upstream)
 *
 * Day handling:
 *   - daysToWedding < 0  → wraps modulo into the 0–365 range. Couples
 *     post-wedding still get a quote; the negative input wraps via
 *     `((-d % 366) + 366) % 366` mathematics.
 *   - daysToWedding > 365 → modulo into the 0–365 range so 18-month
 *     engagements still get a sensible quote.
 *   - Lookup walks the sorted set descending and returns the first entry
 *     with `entry.day <= wrappedDay`. Always returns a quote since the day-0
 *     entry is the floor.
 */
export function quoteForDay(
  daysToWedding: number,
  roleSubtype: LoveQuoteRole,
): LoveQuote | null {
  // Wrap into the 0–365 range (inclusive both ends · day 366 wraps to 0).
  const wrapped = ((daysToWedding % 366) + 366) % 366;

  // Pick the right set per role
  let set: LoveQuote[];
  if (roleSubtype === 'bride') {
    set = SORTED_BRIDE;
  } else if (roleSubtype === 'groom') {
    set = SORTED_GROOM;
  } else {
    // partner1 / partner2 — alternate by wrapped-day parity. Deterministic
    // per-day-per-event, not random, so the same partner sees the same quote
    // on repeat localStorage misses (e.g., browser data cleared).
    set = wrapped % 2 === 0 ? SORTED_BRIDE : SORTED_GROOM;
  }

  // Walk descending; first entry with day <= wrapped wins.
  for (const entry of set) {
    if (entry.day <= wrapped) return entry;
  }
  // Belt-and-suspenders fallback (set always contains a day-0 entry so this
  // path is structurally unreachable, but TypeScript wants the return).
  return set[set.length - 1] ?? null;
}
