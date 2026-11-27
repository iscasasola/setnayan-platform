/**
 * 📰 JOURNAL EDITS MADE AFTER THE IMPORT WAS APPLIED.
 *
 * `supabase/migrations/20271355899662_the_journal_moves_into_articles.sql` copied the Journal source into
 * `creator_chapters` and is applied in production, so it is never edited again. A later correction is made twice,
 * in the same commit: in the source (`lib/blog-batches/*`) and as a NEW migration that UPDATEs that one post.
 * Each correction is listed here, so `lib/journal-move.test.ts` can undo it before comparing the import file with
 * what the source generates, and can prove that its migration carries exactly this text.
 */
export type JournalEditAfterImport = {
  slug: string;
  /** Which column the edit changes, as the post renders it (links written out as setnayan.com/…). Default body. */
  field?: 'title' | 'body';
  /** The text the import wrote. */
  from: string;
  /** The text the source and the post say now. */
  to: string;
  /** The migration that made the same edit in production. */
  migration: string;
};

export const JOURNAL_EDITS_AFTER_IMPORT: readonly JournalEditAfterImport[] = [
  {
    // Owner 2026-11-20/21: no free first booking for a client Setnayan brings (#8061).
    slug: 'what-zero-commission-means-for-couples',
    from: 'unless the supplier is the first to bring the event: a supplier’s first booking from Setnayan is on us, a supplier who is the first',
    to: 'unless the supplier is the first to bring the event: a supplier who is the first',
    migration: '20271356969132_the_zero_commission_post_drops_the_first_booking_promise.sql',
  },
  {
    // Owner 2026-11-19 PROMOTION PAGES (4): no number of months on any public page (#8086).
    slug: 'what-zero-commission-means-for-couples',
    from: 'books it free, and a couple a supplier brings onto Setnayan books them free for a year. Every other booking',
    to: 'books it free, and a couple new to Setnayan through a supplier books them free. Every other booking',
    migration: '20271356623783_the_new_client_free_window_is_a_setting.sql',
  },
  // Owner 27 Nov 2026, content finalization (rows L · A · B, P6): only "Hosts pay 0% commission.", no free
  // promises, all three paid plans, no "celebration", no speed claims, CTAs that land where they say. GENERATED
  // by a paragraph diff of the source before and after; each `from` is whole paragraphs of the post as it stood.
  {
    slug: "aglipayan-wedding-overview",
    from: "Because the Iglesia Filipina Independiente shares much of its liturgical heritage with the Catholic and Anglican traditions, an Aglipayan wedding will be recognisable to most Filipino guests. It is a solemn church ceremony, officiated by a priest, with the rhythm and dignity of a liturgical celebration. Couples often see the same beloved Filipino sacramental symbols woven in, which means guests of many backgrounds tend to feel immediately at home in the pews.",
    to: "Because the Iglesia Filipina Independiente shares much of its liturgical heritage with the Catholic and Anglican traditions, an Aglipayan wedding will be recognisable to most Filipino guests. It is a solemn church ceremony, officiated by a priest, with the rhythm and dignity of a liturgical rite. Couples often see the same beloved Filipino sacramental symbols woven in, which means guests of many backgrounds tend to feel immediately at home in the pews.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "aglipayan-wedding-overview",
    from: "Curious about the veil, cord and coins? Here is what each one means.\nsetnayan.com/features",
    to: "Curious about the veil, cord and coins? Here is what each one means.\nsetnayan.com/articles/cord-veil-coins-wedding-meaning",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "average-wedding-cost-philippines-2026",
    from: "\"What is the average cost of a wedding in the Philippines?\" is the question every newly engaged couple types into their phone at midnight. The honest answer is that there is no single average — a quiet civil wedding for thirty guests and a grand church celebration for three hundred are both Filipino weddings, and they sit worlds apart on cost. What is far more useful than an average is understanding what drives the number, so you can place your own wedding on the scale with eyes open.",
    to: "\"What is the average cost of a wedding in the Philippines?\" is the question every newly engaged couple types into their phone at midnight. The honest answer is that there is no single average — a quiet civil wedding for thirty guests and a grand church wedding for three hundred are both Filipino weddings, and they sit worlds apart on cost. What is far more useful than an average is understanding what drives the number, so you can place your own wedding on the scale with eyes open.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "average-wedding-cost-philippines-2026",
    from: "An average blends a backyard celebration and a five-star ballroom into one figure that describes neither. Your cost depends far more on the choices in front of you than on any national number. The same wedding can double in price by moving from a province to Metro Manila, from a weekday to a Saturday in December, or from eighty guests to two hundred.",
    to: "An average blends a backyard party and a five-star ballroom into one figure that describes neither. Your cost depends far more on the choices in front of you than on any national number. The same wedding can double in price by moving from a province to Metro Manila, from a weekday to a Saturday in December, or from eighty guests to two hundred.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "average-wedding-cost-philippines-2026",
    from: "See the full percentage breakdown of where a Filipino wedding budget really goes.\nsetnayan.com/features",
    to: "See the full percentage breakdown of where a Filipino wedding budget really goes.\nsetnayan.com/articles/wedding-budget-breakdown-philippines",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "avp-save-the-date-video-guide",
    from: "This is your announcement, dressed up. Often built from prenup footage or a short, fun shoot done just for the purpose, it is a brief and highly shareable clip — typically under a minute — that lands in your guests inboxes, group chats, and feeds carrying only the essentials: who is getting married, and when. Its whole job is to lock the date into people heads early and set the tone, so guests immediately sense whether to expect something formal and grand, relaxed and beachy, or light and playful. Because it travels online, it should look good on a phone screen and make sense even when watched on mute, which is how most people will first see it.",
    to: "This is your announcement, dressed up. Often built from prenup footage or a short, fun shoot done just for the purpose, it is a brief and highly shareable clip — typically under a minute — that lands in your guests' inboxes, group chats, and feeds carrying only the essentials: who is getting married, and when. Its whole job is to lock the date into people's heads early and set the tone, so guests immediately sense whether to expect something formal and grand, relaxed and beachy, or light and playful. Because it travels online, it should look good on a phone screen and make sense even when watched on mute, which is how most people will first see it.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "avp-save-the-date-video-guide",
    from: "Plan both with intent. The save-the-date is marketing for your wedding; the AVP is storytelling at it. Give your supplier a clear brief for each, respect your guests attention with tight edits, and these two small films will do an outsized amount of work in setting the mood of your day.",
    to: "Plan both with intent. The save-the-date is marketing for your wedding; the AVP is storytelling at it. Give your supplier a clear brief for each, respect your guests' attention with tight edits, and these two small films will do an outsized amount of work in setting the mood of your day.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "ber-months-wedding-season-book-early",
    from: "Ask any Filipino wedding supplier and they will tell you the same thing without hesitation: once the ber-months arrive, the calendar fills fast. From September to December the whole country shifts into celebration mode, and weddings — especially the coveted December dates — get snapped up in a hurry. If you have your eye on this stretch of the year, the single most important word in your plan is \"early\". Here is why the rush happens like clockwork, and how to stay comfortably ahead of it instead of chasing whatever is left.",
    to: "Ask any Filipino wedding supplier and they will tell you the same thing without hesitation: once the ber-months arrive, the calendar fills fast. From September to December the whole country shifts into party mode, and weddings — especially the coveted December dates — get snapped up in a hurry. If you have your eye on this stretch of the year, the single most important word in your plan is \"early\". Here is why the rush happens like clockwork, and how to stay comfortably ahead of it instead of chasing whatever is left.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "born-again-christian-wedding-philippines",
    from: "Outside the ceremony, planning looks much like any Filipino wedding: a venue, a caterer, photo and video, and a guest list. And as with every marriage in the country, the civil requirement — the marriage licence — still applies, so handle it early. If you are weighing a church ceremony against a purely civil one, our civil-versus-church explainer lays out the differences plainly, which can be a helpful conversation to have with your partner before you commit. Many born-again couples also build a simple programme that includes worship, so guests of every background can follow along and feel part of the celebration.",
    to: "Outside the ceremony, planning looks much like any Filipino wedding: a venue, a caterer, photo and video, and a guest list. And as with every marriage in the country, the civil requirement — the marriage licence — still applies, so handle it early. If you are weighing a church ceremony against a purely civil one, our civil-versus-church explainer lays out the differences plainly, which can be a helpful conversation to have with your partner before you commit. Many born-again couples also build a simple programme that includes worship, so guests of every background can follow along and feel part of the day.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "born-again-christian-wedding-philippines",
    from: "Weighing church versus civil? Here is a clear, side-by-side comparison.\nsetnayan.com/features",
    to: "Weighing church versus civil? Here is a clear, side-by-side comparison.\nsetnayan.com/articles/civil-vs-church-wedding-philippines",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "bridal-car-and-motorcade-wedding",
    from: "The bridal car is really a small stage on wheels. It carries the bride to the ceremony and the newlyweds away from it, and in between it becomes the backdrop for some of the day's loveliest photographs — the quiet ride to the church when the nerves are real, the just-married drive afterward with the window rolled down, the confetti catching the light. In many Filipino weddings a motorcade then forms behind it: a convoy of family and guests, sometimes with ribboned cars and a friendly chorus of horns, escorting the couple between venues in a moving, public celebration that lets the whole neighbourhood in on the news. The meaning is simple, generous joy, spilled out onto the road for everyone to share — a wedding refusing to stay politely indoors.\n\n“A motorcade turns the drive between venues into part of the celebration — joy, ribboned and rolling, for the whole street to see.”",
    to: "The bridal car is really a small stage on wheels. It carries the bride to the ceremony and the newlyweds away from it, and in between it becomes the backdrop for some of the day's loveliest photographs — the quiet ride to the church when the nerves are real, the just-married drive afterward with the window rolled down, the confetti catching the light. In many Filipino weddings a motorcade then forms behind it: a convoy of family and guests, sometimes with ribboned cars and a friendly chorus of horns, escorting the couple between venues in a moving, public parade that lets the whole neighbourhood in on the news. The meaning is simple, generous joy, spilled out onto the road for everyone to share — a wedding refusing to stay politely indoors.\n\n“A motorcade turns the drive between venues into part of the wedding — joy, ribboned and rolling, for the whole street to see.”",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "bridal-car-and-motorcade-wedding",
    from: "Find trusted Filipino suppliers — bridal cars, stylists, coordinators — by city and category.\nsetnayan.com/?browse=1",
    to: "Find verified Filipino suppliers — bridal cars, stylists, coordinators — by city and category.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "brownout-power-contingency-wedding",
    from: "It rarely makes the worry list until very late in the planning, but in the Philippines a brownout can quietly undo a beautiful day in seconds. Storms in the wet months, grid strain during peak demand, and rural venues with shaky supply all raise the odds that the power blinks out at exactly the wrong moment. And so much of a modern wedding leans on electricity: the lights, the sound system, the band, the projector for your same-day edit, even the caterer's warming equipment. A little foresight keeps the celebration glowing even when the grid does not.",
    to: "It rarely makes the worry list until very late in the planning, but in the Philippines a brownout can quietly undo a beautiful day in seconds. Storms in the wet months, grid strain during peak demand, and rural venues with shaky supply all raise the odds that the power blinks out at exactly the wrong moment. And so much of a modern wedding leans on electricity: the lights, the sound system, the band, the projector for your same-day edit, even the caterer's warming equipment. A little foresight keeps the reception glowing even when the grid does not.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "buffet-vs-plated-vs-family-style-wedding",
    from: "The buffet is the most common reception format in the Philippines, and it earns its place. It usually offers the widest variety of dishes per peso, lets guests choose what and how much they eat, and tends to be the most budget-friendly of the three. It also suits the warmth of a Filipino celebration — people get up, move around, and bump into family between trips to the line. The trade-offs are real, though. Buffets need space for the stations and enough staff to keep them stocked, or the line crawls. With a large guest list and a single station, you can end up with a long queue and a cold first table; the fix is usually more stations or a second serving line, so ask your caterer how they handle a crowd your size.",
    to: "The buffet is the most common reception format in the Philippines, and it earns its place. It usually offers the widest variety of dishes per peso, lets guests choose what and how much they eat, and tends to be the most budget-friendly of the three. It also suits the warmth of a Filipino reception — people get up, move around, and bump into family between trips to the line. The trade-offs are real, though. Buffets need space for the stations and enough staff to keep them stocked, or the line crawls. With a large guest list and a single station, you can end up with a long queue and a cold first table; the fix is usually more stations or a second serving line, so ask your caterer how they handle a crowd your size.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "choosing-your-ceremony-by-faith-philippines",
    from: "A Muslim (nikah) wedding follows Islamic rites and, in parts of Mindanao, the Code of Muslim Personal Laws, with its own solemnising officers and customs. A civil wedding — officiated by a judge or mayor — is the simplest and fastest path, ideal for couples who want to be married now and celebrate later, or who prefer a small, private moment. And many Filipino couples are mixed-faith: the gentlest approach is usually to honour both, whether through one ceremony that blends traditions or two distinct celebrations. None of these is a lesser choice; each is simply a different shape for the same promise.",
    to: "A Muslim (nikah) wedding follows Islamic rites and, in parts of Mindanao, the Code of Muslim Personal Laws, with its own solemnising officers and customs. A civil wedding — officiated by a judge or mayor — is the simplest and fastest path, ideal for couples who want to be married now and celebrate later, or who prefer a small, private moment. And many Filipino couples are mixed-faith: the gentlest approach is usually to honour both, whether through one ceremony that blends traditions or two distinct ceremonies. None of these is a lesser choice; each is simply a different shape for the same promise.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "christmas-themed-wedding-ideas-philippines",
    from: "If you are marrying in December, you do not have to fight the season — you can let it carry your whole celebration. A Christmas wedding in the Philippines has a head start most couples would pay for: the lights are already up, the mood is already warm, and everyone already feels a little more sentimental than usual. By December the country has been in the Christmas spirit for weeks, the cool amihan breeze has finally arrived, and your guests turn up already glowing with the holidays. The trick is to borrow the season gently, so your wedding feels festive and personal rather than like a department-store display. Choose a few touches you genuinely love and do them well; the season fills in the rest. Here are ideas that lean into the holidays the Filipino way.",
    to: "If you are marrying in December, you do not have to fight the season — you can let it carry your whole wedding. A Christmas wedding in the Philippines has a head start most couples would pay for: the lights are already up, the mood is already warm, and everyone already feels a little more sentimental than usual. By December the country has been in the Christmas spirit for weeks, the cool amihan breeze has finally arrived, and your guests turn up already glowing with the holidays. The trick is to borrow the season gently, so your wedding feels festive and personal rather than like a department-store display. Choose a few touches you genuinely love and do them well; the season fills in the rest. Here are ideas that lean into the holidays the Filipino way.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "civil-vs-church-wedding-philippines",
    from: "Every Filipino couple faces this early question: civil or church? Both result in a legally married couple — the difference is in the ceremony, the requirements, the timeline, and the feel of the day. Here is a clear comparison to help you decide, whether you want a quiet signing or a full liturgical celebration.",
    to: "Every Filipino couple faces this early question: civil or church? Both result in a legally married couple — the difference is in the ceremony, the requirements, the timeline, and the feel of the day. Here is a clear comparison to help you decide, whether you want a quiet signing or a full church ceremony.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "cord-veil-coins-wedding-meaning",
    from: "Want the full cast — sponsors, bearers, ninong, and ninang — and what each one does? Read the entourage guide.\nsetnayan.com/features",
    to: "Want the full cast — sponsors, bearers, ninong, and ninang — and what each one does? Read the entourage guide.\nsetnayan.com/articles/filipino-wedding-entourage-guide-ninong-ninang-sponsors",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "despedida-de-soltera-explained",
    from: "It is easy to mistake despedida de soltera for a bachelorette party, but the feel is genuinely different. Where a bachelorette is often a friends-led night out built around fun, the despedida is typically a family-centred dinner — warmer, more sentimental, and usually organised by the bride's parents or relatives rather than her barkada. The focus is gratitude and blessing: a chance to honour the bride, gather the family she grew up in, and mark the transition with grace rather than wild celebration. Some brides have both, on different nights, and there is nothing contradictory in that — one for the heart, one for the laughs.",
    to: "It is easy to mistake despedida de soltera for a bachelorette party, but the feel is genuinely different. Where a bachelorette is often a friends-led night out built around fun, the despedida is typically a family-centred dinner — warmer, more sentimental, and usually organised by the bride's parents or relatives rather than her barkada. The focus is gratitude and blessing: a chance to honour the bride, gather the family she grew up in, and mark the transition with grace rather than a wild party. Some brides have both, on different nights, and there is nothing contradictory in that — one for the heart, one for the laughs.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "destination-wedding-philippines-guide",
    from: "With more than seven thousand islands, the Philippines is one of the world’s great destination-wedding settings. A vow exchanged with Boracay’s white sand underfoot, Palawan’s lagoons behind you, Tagaytay’s ridge in the cool air, or a heritage church in Bohol — the country offers a backdrop for every kind of couple. A destination wedding takes more coordination than a hometown one, but with the right approach the logistics never overshadow the celebration. Here is how to plan one with a clear head and a generous heart.",
    to: "With more than seven thousand islands, the Philippines is one of the world’s great destination-wedding settings. A vow exchanged with Boracay’s white sand underfoot, Palawan’s lagoons behind you, Tagaytay’s ridge in the cool air, or a heritage church in Bohol — the country offers a backdrop for every kind of couple. A destination wedding takes more coordination than a hometown one, but with the right approach the logistics never overshadow the wedding. Here is how to plan one with a clear head and a generous heart.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "destination-wedding-philippines-guide",
    from: "“A destination wedding is really two events to plan — the celebration itself, and the journey that gets everyone there. Respect both.”",
    to: "“A destination wedding is really two events to plan — the wedding itself, and the journey that gets everyone there. Respect both.”",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "destination-wedding-philippines-guide",
    from: "Get a feel for supplier costs before you commit to an island.\nsetnayan.com/features",
    to: "Get a feel for supplier costs before you commit to an island.\nsetnayan.com/articles/how-much-do-wedding-suppliers-cost-philippines",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "digital-invitations-online-rsvp-wedding",
    from: "The appeal goes well beyond saved postage. A digital invitation reaches every guest the instant you send it, updates itself when a detail changes, and — most valuable of all — gathers every reply into one tidy, living list instead of scattering them across a dozen chat threads. The guest taps \"yes\" or \"no\", and your headcount updates on its own, no manual tallying required.",
    to: "The appeal goes well beyond saved postage. A digital invitation reaches every guest at one link, updates itself when a detail changes, and — most valuable of all — gathers every reply into one tidy, living list instead of scattering them across a dozen chat threads. The guest taps \"yes\" or \"no\", and your headcount updates on its own, no manual tallying required.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "engaged-over-christmas-first-steps",
    from: "A holiday engagement is one of the great Filipino joys — and it comes with a quiet undercurrent worth knowing about: thousands of other couples just said yes too, swept up in the same season of parols, reunions, and Noche Buena. As January arrives, the rush for dates, venues, and suppliers begins in earnest, and the best of them go fast. The reassuring part is that you do not need to plan the whole wedding this week, or even this month. You only need to take a handful of calm, early steps that protect your options while the celebration is still warm in the air — small moves now that spare you a scramble later. Here they are, in the order that keeps everything else simple.",
    to: "A holiday engagement is one of the great Filipino joys — and it comes with a quiet undercurrent worth knowing about: thousands of other couples just said yes too, swept up in the same season of parols, reunions, and Noche Buena. As January arrives, the rush for dates, venues, and suppliers begins in earnest, and the best of them go fast. The reassuring part is that you do not need to plan the whole wedding this week, or even this month. You only need to take a handful of calm, early steps that protect your options while the joy is still warm in the air — small moves now that spare you a scramble later. Here they are, in the order that keeps everything else simple.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "engaged-over-christmas-first-steps",
    from: "Before any spreadsheet or supplier search, simply savour it. Share the news with both families in the way that suits your culture — a visit, a call, a gathering over the holidays. In many Filipino families this is also where the real conversation about a celebration genuinely begins, so let the people who matter most share the moment first. Then, when you are ready, settle two figures: roughly how many guests, and roughly how much you can comfortably spend. Neither needs to be exact yet. A sensible range for each is more than enough to keep you from falling for a venue you cannot fill or a budget you cannot sustain, and almost everything downstream flows from those two numbers.",
    to: "Before any spreadsheet or supplier search, simply savour it. Share the news with both families in the way that suits your culture — a visit, a call, a gathering over the holidays. In many Filipino families this is also where the real conversation about a wedding genuinely begins, so let the people who matter most share the moment first. Then, when you are ready, settle two figures: roughly how many guests, and roughly how much you can comfortably spend. Neither needs to be exact yet. A sensible range for each is more than enough to keep you from falling for a venue you cannot fill or a budget you cannot sustain, and almost everything downstream flows from those two numbers.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "filipino-wedding-entourage-guide-ninong-ninang-sponsors",
    from: "Setnayan's guest list includes more than 30 Filipino ceremony roles — sponsors, bearers, ninong, ninang, and more — so everyone is placed and counted.\nsetnayan.com/signup",
    to: "Setnayan's guest list knows the Filipino entourage — sponsors, bearers, ninong and ninang — so everyone is placed and counted.\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "filipino-wedding-gift-etiquette-cash",
    from: "A Filipino wedding is also the start of a household, and many couples are genuinely helped by money toward the honeymoon, the first home, or even the wedding's own remaining costs. Cash lets the couple direct the help exactly where they need it most, with no risk of a duplicate appliance or a vase that never gets used. It is given discreetly — usually in an envelope, often handed to a designated family member or dropped into a gift box near the entrance — and it is no less heartfelt than a wrapped present chosen with care. The money dance, where guests pin bills to the dancing couple, is simply this same generous instinct turned into a celebration.",
    to: "A Filipino wedding is also the start of a household, and many couples are genuinely helped by money toward the honeymoon, the first home, or even the wedding's own remaining costs. Cash lets the couple direct the help exactly where they need it most, with no risk of a duplicate appliance or a vase that never gets used. It is given discreetly — usually in an envelope, often handed to a designated family member or dropped into a gift box near the entrance — and it is no less heartfelt than a wrapped present chosen with care. The money dance, where guests pin bills to the dancing couple, is simply this same generous instinct turned into a joyful ritual.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "filipino-wedding-superstitions-pamahiin",
    from: "Curious about the rites and reception customs too? Read our overview of Filipino wedding traditions.\nsetnayan.com/features",
    to: "Curious about the rites and reception customs too? Read our overview of Filipino wedding traditions.\nsetnayan.com/articles/filipino-wedding-traditions-explained",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "food-carts-late-night-snacks-wedding",
    from: "A reception has a natural lull after the main meal. A food cart fills it with energy and a reason to get up. It also signals abundance and care — the sense that the celebration is not over yet. Practically, carts are interactive: guests choose, watch, and chat while their order is made, which keeps the floor lively when the formal program ends.",
    to: "A reception has a natural lull after the main meal. A food cart fills it with energy and a reason to get up. It also signals abundance and care — the sense that the party is not over yet. Practically, carts are interactive: guests choose, watch, and chat while their order is made, which keeps the floor lively when the formal program ends.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "food-carts-late-night-snacks-wedding",
    from: "• Ice cream or sorbetes — the dirty-ice-cream cart is pure nostalgia and works for every age, especially in warm weather.\n• Cotton candy, popcorn, or churros — playful, photogenic, and a hit with younger guests and the entourage kids.\n• Lechon, isaw, or grilled-skewer stations — hearty late-night savoury bites for a hungrier, livelier crowd.\n• Coffee, milk tea, or fresh-buko carts — perfect for an afternoon wedding or a long evening that needs a second wind.\n• Taho, fishball, or kwek-kwek — street-food carts that lean into a fun, unpretentious celebration.",
    to: "• Ice cream or sorbetes — the dirty-ice-cream cart is pure nostalgia and works for every age, especially in warm weather.\n• Cotton candy, popcorn, or churros — playful, photogenic, and a hit with younger guests and the entourage kids.\n• Lechon, isaw, or grilled-skewer stations — hearty late-night savoury bites for a hungrier, livelier crowd.\n• Coffee, milk tea, or fresh-buko carts — perfect for an afternoon wedding or a long evening that needs a second wind.\n• Taho, fishball, or kwek-kwek — street-food carts that lean into a fun, unpretentious reception.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "food-carts-late-night-snacks-wedding",
    from: "Browse food-cart and snack suppliers, compare packages, and book with zero commission.\nsetnayan.com/?browse=1",
    to: "Browse food-cart and snack suppliers, and compare packages side by side.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "free-event-hub-how-it-helps",
    from: "• Guests RSVP online, and your headcount updates automatically.\n• All your wedding details live at one link you can share anywhere.\n• Update something once and every guest sees the change instantly.\n• A reliable final count means cleaner numbers for catering and seating.",
    to: "• Guests RSVP online, and your headcount updates automatically.\n• All your wedding details live at one link you can share anywhere.\n• Update something once and every guest sees the change.\n• A reliable final count means cleaner numbers for catering and seating.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "free-event-hub-how-it-helps",
    from: "A good Event Hub meets your guests where they are. The tech-comfortable cousin RSVPs in seconds on their phone; the relative who is less online still gets a simple page they can read without an account or an app. Because the Event Hub and its RSVP are free and built in, there is no reason to skip it. You get a real, working Event Hub and a real RSVP system as the default; Event Pro adds optional extras on top, and you never need it to collect RSVPs. And because it lives next to the rest of your planning, the headcount it gathers is the same number your guest list, your budget, and your seating chart all draw from — no copying figures between apps, no version that is quietly out of date.",
    to: "A good Event Hub meets your guests where they are. The tech-comfortable cousin RSVPs on their phone; the relative who is less online still gets a simple page they can read without an account or an app. Because the Event Hub and its RSVP are free and built in, there is no reason to skip it. You get a real, working Event Hub and a real RSVP system as the default. Paid plans add optional extras on top; RSVPs are free. And because it lives next to the rest of your planning, the headcount it gathers is the same number your guest list, your budget, and your seating chart all draw from — no copying figures between apps, no version that is quietly out of date.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "free-event-hub-how-it-helps",
    from: "Create your free Event Hub and turn on RSVPs in minutes.\nsetnayan.com/signup",
    to: "Create your free Event Hub and turn on RSVPs.\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "garden-vs-ballroom-vs-beach-wedding",
    from: "A hotel or events-place ballroom is the most controlled, predictable choice. The air-conditioning is reliable, the rain is irrelevant, and the in-house team often handles catering, tables and coordination as a package, which takes a real load off the couple. It suits larger guest counts and formal celebrations. The trade-off is that you are working within a fixed space and house rules, sometimes with a required in-house caterer, and a fully styled ballroom can carry a higher all-in cost than its sticker price suggests.",
    to: "A hotel or events-place ballroom is the most controlled, predictable choice. The air-conditioning is reliable, the rain is irrelevant, and the in-house team often handles catering, tables and coordination as a package, which takes a real load off the couple. It suits larger guest counts and formal weddings. The trade-off is that you are working within a fixed space and house rules, sometimes with a required in-house caterer, and a fully styled ballroom can carry a higher all-in cost than its sticker price suggests.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "garden-vs-ballroom-vs-beach-wedding",
    from: "Weigh four things together: your guest count, your season and weather risk, your budget, and the feeling you want. A large formal wedding in the rainy months leans ballroom; an intimate, natural celebration in fair weather suits a garden; a couple chasing a sunset-and-sand dream — and willing to manage the logistics — heads to the beach. Once you have settled the type, choosing the actual venue gets far easier, because you are comparing like with like. Our venue-selection guide walks through the exact questions to ask each one before you sign. And whatever type you land on, a free planning workspace helps you compare venues and suppliers side by side at 0% commission — you deal with suppliers directly — so you can see the real trade-offs before you commit. Visit a shortlist in person if you can, at the time of day your wedding will happen, and you will know very quickly which kind of venue feels like yours.\n\nCompare real venues and suppliers side by side, commission-free.\nsetnayan.com/?browse=1",
    to: "Weigh four things together: your guest count, your season and weather risk, your budget, and the feeling you want. A large formal wedding in the rainy months leans ballroom; an intimate, natural wedding in fair weather suits a garden; a couple chasing a sunset-and-sand dream — and willing to manage the logistics — heads to the beach. Once you have settled the type, choosing the actual venue gets far easier, because you are comparing like with like. Our venue-selection guide walks through the exact questions to ask each one before you sign. And whatever type you land on, a free planning workspace helps you compare venues and suppliers side by side. Hosts pay 0% commission. You deal with suppliers directly, so you can see the real trade-offs before you commit. Visit a shortlist in person if you can, at the time of day your wedding will happen, and you will know very quickly which kind of venue feels like yours.\n\nCompare real venues and suppliers side by side.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "holiday-proposal-ideas-philippines",
    from: "So enjoy the proposal fully and let the to-do list wait. Whenever you do decide you are both ready to begin, a free planning workspace is there the moment you want it — so the celebration of the engagement can come first, exactly as it should, and the planning can start on your own gentle timeline rather than the season's. Whatever shape your proposal takes — a roomful of relatives or a quiet two of you under the parol — let it sound like the two of you and no one else. The holidays only set the stage; the moment itself is entirely yours to write.",
    to: "So enjoy the proposal fully and let the to-do list wait. Whenever you do decide you are both ready to begin, a free planning workspace is there the moment you want it — so celebrating the engagement can come first, exactly as it should, and the planning can start on your own gentle timeline rather than the season's. Whatever shape your proposal takes — a roomful of relatives or a quiet two of you under the parol — let it sound like the two of you and no one else. The holidays only set the stage; the moment itself is entirely yours to write.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-much-do-wedding-suppliers-cost-philippines",
    from: "There is no single answer to \"how much does a wedding supplier cost\" in the Philippines — rates swing widely by city, season, experience, and how much of the work is included. The ranges below are realistic 2026 starting points to help you build a first budget. Treat them as a compass, not a quote: always ask each supplier for an inclusions list in writing, because the same headline price can mean very different things.",
    to: "There is no single answer to \"how much does a wedding supplier cost\" in the Philippines — rates swing widely by city, season, experience, and how much of the work is included. Treat any quote as a compass, not a final price: always ask each supplier for an inclusions list in writing, because the same headline price can mean very different things.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-much-do-wedding-suppliers-cost-philippines",
    from: "Typical starting ranges (2026)",
    to: "Price by category",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-much-do-wedding-suppliers-cost-philippines",
    from: "When you are ready to shortlist, browsing verified suppliers side by side — with the styles and cities they actually serve — makes the ranges above concrete for your specific date and place.",
    to: "When you are ready to shortlist, browsing verified suppliers side by side — with the styles and cities they actually serve — makes the prices concrete for your specific date and place.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-ask-someone-to-be-ninong-ninang",
    from: "Curious what each sponsor and bearer actually does on the day? Our full entourage guide breaks it all down.\nsetnayan.com/features",
    to: "Curious what each sponsor and bearer actually does on the day? Our full entourage guide breaks it all down.\nsetnayan.com/articles/filipino-wedding-entourage-guide-ninong-ninang-sponsors",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-budget-a-philippine-wedding-step-by-step",
    from: "A budget is only real if you can see it. From the day you pay your first deposit, record every payment against your total so the number on the screen always matches the money in the bank. This is also where booking through a marketplace that takes zero commission on supplier bookings quietly protects you: the price you agree with a supplier is the price you pay, with no hidden platform cut eating into the total you worked so carefully to set. When something has to give later, you trim from the areas you already agreed matter least — calmly, not in a panic three months out.",
    to: "A budget is only real if you can see it. From the day you pay your first deposit, record every payment against your total so the number on the screen always matches the money in the bank. This is also where one plain rule protects you. Hosts pay 0% commission. The price you agree with a supplier is the price you pay them. When something has to give later, you trim from the areas you already agreed matter least — calmly, not in a panic three months out.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-choose-a-wedding-caterer-philippines",
    from: "Compare caterers side by side, by city and budget, with zero commission on anything you book.\nsetnayan.com/?browse=1",
    to: "Compare caterers side by side, by city and budget.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-choose-a-wedding-photographer-philippines",
    from: "Compare real portfolios, inclusions, and availability in one place, with no commission added to what you pay your supplier.\nsetnayan.com/?browse=1",
    to: "Compare real portfolios, inclusions, and availability in one place.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-choose-a-wedding-venue-philippines",
    from: "Browse 100+ real Philippine wedding venues by city, with capacity and day-rate details.\nsetnayan.com/?browse=1",
    to: "Browse Philippine wedding venues by city.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-save-money-on-your-wedding-philippines",
    field: 'title',
    from: "30 honest ways to save money on a Filipino wedding",
    to: "23 honest ways to save money on a Filipino wedding",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-save-money-on-your-wedding-philippines",
    from: "Saving money on a wedding sounds like a compromise, and the worry underneath it is real: \"Will it look cheap? Will people notice?\" The truth is that the smartest savings are invisible. Guests remember warmth, good food, and a day that flowed — not the line items you trimmed to get there. Here are thirty honest ways to spend less, grouped so you can pick the ones that fit your wedding.",
    to: "Saving money on a wedding sounds like a compromise, and the worry underneath it is real: \"Will it look cheap? Will people notice?\" The truth is that the smartest savings are invisible. Guests remember warmth, good food, and a day that flowed — not the line items you trimmed to get there. Here are twenty-three honest ways to spend less, grouped so you can pick the ones that fit your wedding.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-save-money-on-your-wedding-philippines",
    from: "• Send digital invitations and a free Event Hub instead of printing for every guest.\n• Print only a few keepsake invitations for sponsors and close family.\n• Make favours edible or useful — homemade treats beat trinkets that get left behind.\n• Build your own playlist for cocktails and dinner; save the live band for the key moments.\n• Borrow décor, signage, and props from recently married friends, and DIY the genuinely simple touches.\n• Buy your own alcohol where the venue allows, and limit the bar to beer, wine, and one signature drink.\n• Set your total first, track every deposit, and keep a 10–15% buffer so nothing forces a panic purchase.\n• Book through a marketplace that charges 0% commission, so the price you agree is the price you pay.\n• Negotiate gently and always in writing, avoid debt, and put any savings toward the honeymoon — not new add-ons.\n\nYou will not use all thirty — no one does. Pick the handful that suit your wedding, and the savings stack up without a single guest ever feeling the difference. The most powerful ones are at the top of this list: the guest count and the date move more money than every small swap combined, so start there before you fuss over favours. And remember that the goal is never the cheapest wedding — it is the wedding that fits your life, paid for without stress. A saving you make on a detail no one will notice is a saving you can pour into the food everyone will remember, the photos you will keep forever, or simply the peace of starting married life with money still in the bank.\n\nTrack every choice and every peso saved in one free budget — with 0% commission on every booking.\nsetnayan.com/signup",
    to: "• Send digital invitations and a free Event Hub instead of printing for every guest.\n• Print only a few keepsake invitations for sponsors and close family.\n• Make favours edible or useful — homemade treats beat trinkets that get left behind.\n• Build your own playlist for cocktails and dinner; save the live band for the key moments.\n• Borrow décor, signage, and props from recently married friends, and DIY the genuinely simple touches.\n• Buy your own alcohol where the venue allows, and limit the bar to beer, wine, and one signature drink.\n• Set your total first, track every deposit, and keep a 10–15% buffer so nothing forces a panic purchase.\n• Hosts pay 0% commission. The price you agree is the price you pay.\n• Negotiate gently and always in writing, avoid debt, and put any savings toward the honeymoon — not new add-ons.\n\nYou will not use all twenty-three — no one does. Pick the handful that suit your wedding, and the savings stack up without a single guest ever feeling the difference. The most powerful ones are at the top of this list: the guest count and the date move more money than every small swap combined, so start there before you fuss over favours. And remember that the goal is never the cheapest wedding — it is the wedding that fits your life, paid for without stress. A saving you make on a detail no one will notice is a saving you can pour into the food everyone will remember, the photos you will keep forever, or simply the peace of starting married life with money still in the bank.\n\nTrack every choice and every peso saved in one free budget. Hosts pay 0% commission.\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-set-a-wedding-budget-philippines",
    from: "A budget is also a values exercise. Before you book anything, agree on the two or three things that matter most — perhaps the food, the photos, or a venue you have always dreamed of — and protect their share of the total. Everything else can flex. When something has to give, you trim from the areas you already agreed are less important, rather than arguing about it in a stressful week three months out. This single conversation prevents most of the money tension couples feel, because every later choice is measured against a decision you already made together, calmly, at the start. And when you book through a marketplace that takes zero commission on supplier bookings, the price you agree with a supplier is the price you pay — no hidden platform cut quietly eating into the total you worked so hard to set.",
    to: "A budget is also a values exercise. Before you book anything, agree on the two or three things that matter most — perhaps the food, the photos, or a venue you have always dreamed of — and protect their share of the total. Everything else can flex. When something has to give, you trim from the areas you already agreed are less important, rather than arguing about it in a stressful week three months out. This single conversation prevents most of the money tension couples feel, because every later choice is measured against a decision you already made together, calmly, at the start. Hosts pay 0% commission. The price you agree with a supplier is the price you pay.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "how-to-trim-your-wedding-guest-list",
    from: "Some shortcuts cause more hurt than they save. Do not invite someone to the church but pointedly leave them off the reception, unless your families clearly understand these as two separate gatherings — otherwise it reads as a deliberate slight. Do not announce on social media that the wedding is \"intimate\" and then be seen inviting half the office. And above all, never promise an invitation you are not certain you can keep. An un-invite stings far more than a never-invite ever could. Trimming is uncomfortable, but a wedding you can genuinely afford and enjoy is worth a few awkward conversations. The people who love you will understand a smaller celebration; the ones who would hold it against you were almost certainly tier three to begin with.",
    to: "Some shortcuts cause more hurt than they save. Do not invite someone to the church but pointedly leave them off the reception, unless your families clearly understand these as two separate gatherings — otherwise it reads as a deliberate slight. Do not announce on social media that the wedding is \"intimate\" and then be seen inviting half the office. And above all, never promise an invitation you are not certain you can keep. An un-invite stings far more than a never-invite ever could. Trimming is uncomfortable, but a wedding you can genuinely afford and enjoy is worth a few awkward conversations. The people who love you will understand a smaller wedding; the ones who would hold it against you were almost certainly tier three to begin with.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "iglesia-ni-cristo-wedding-overview",
    from: "Unlike a venue you book on the open market, the ceremony takes place in the Iglesia ni Cristo chapel and is led by a minister of the church. The form, the words and the conduct of the wedding follow the church’s established practice. Couples who are members are guided through the process directly by their local congregation, and that guidance — not any outside source, and certainly not a wedding blog — is the authority on what is required and how the day unfolds. The respectful thing to do is to let the church lead and to plan everything else around it.",
    to: "Unlike a venue you book on the open market, the ceremony takes place in the Iglesia ni Cristo chapel and is led by a minister of the church. The form, the words and the conduct of the wedding follow the church’s established practice. Couples who are members are guided through the process directly by their local congregation, and that guidance — not any outside source, and certainly not an article online — is the authority on what is required and how the day unfolds. The respectful thing to do is to let the church lead and to plan everything else around it.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "iglesia-ni-cristo-wedding-overview",
    from: "Because the ceremony itself is arranged within the church, a couple’s outside planning energy goes mostly into the reception and the surrounding logistics, plus the civil legal requirements that apply to every Philippine marriage. The reception — the venue, the caterer, the photographer, the guest list — is yours to plan in the usual way, and it is where most of your supplier decisions will be made. Treat it as you would any celebration: set a budget, build a guest list, and choose suppliers you trust.\n\n• The ceremony and its requirements are set by your congregation — speak with your minister early.\n• Plan the reception, suppliers and guest list as you would for any celebration.\n• The civil legal requirements (the marriage licence) still apply — see our guide to those.\n• Confirm anything you are unsure of directly with the church, not from outside sources.",
    to: "Because the ceremony itself is arranged within the church, a couple’s outside planning energy goes mostly into the reception and the surrounding logistics, plus the civil legal requirements that apply to every Philippine marriage. The reception — the venue, the caterer, the photographer, the guest list — is yours to plan in the usual way, and it is where most of your supplier decisions will be made. Treat it as you would any event: set a budget, build a guest list, and choose suppliers you trust.\n\n• The ceremony and its requirements are set by your congregation — speak with your minister early.\n• Plan the reception, suppliers and guest list as you would for any event.\n• The civil legal requirements (the marriage licence) still apply — see our guide to those.\n• Confirm anything you are unsure of directly with the church, not from outside sources.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "iglesia-ni-cristo-wedding-overview",
    from: "Handle the civil paperwork on time — here is exactly what a marriage licence requires.\nsetnayan.com/features",
    to: "Handle the civil paperwork on time — here is exactly what a marriage licence requires.\nsetnayan.com/articles/marriage-license-requirements-philippines",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "ilocano-wedding-traditions",
    from: "Ilocano weddings carry the temperament of the North: practical, deeply rooted in family, and quietly generous. The region is known for valuing thrift and hard work, and you can feel it in how a wedding is planned — every peso considered, every relative involved, nothing wasted. But do not mistake thrift for restraint. An Ilocano celebration is full of heart, and the customs around it have endured for generations. Here is a respectful overview; as always, the exact practices vary by family and town, so let your elders guide the details that matter most to you.",
    to: "Ilocano weddings carry the temperament of the North: practical, deeply rooted in family, and quietly generous. The region is known for valuing thrift and hard work, and you can feel it in how a wedding is planned — every peso considered, every relative involved, nothing wasted. But do not mistake thrift for restraint. An Ilocano wedding is full of heart, and the customs around it have endured for generations. Here is a respectful overview; as always, the exact practices vary by family and town, so let your elders guide the details that matter most to you.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "ilocano-wedding-traditions",
    from: "As across much of the Philippines, the two families meet formally before the wedding to ask for the bride’s hand and agree on the plans. In Ilocano households this gathering is taken seriously: it is where responsibilities are divided, the date is set, and the sponsors are named. Respect for elders runs through everything, and their counsel often shapes the biggest decisions — from the choice of date to the size of the celebration. A couple who brings the elders along early tends to have a much smoother road to the altar. There is a quiet practicality at work too: by settling money and roles around a table, with food shared and elders present, an Ilocano family avoids the awkward late conversations that strain so many weddings. What looks like ceremony is also good planning — the kind that keeps a celebration affordable and a family at peace.",
    to: "As across much of the Philippines, the two families meet formally before the wedding to ask for the bride’s hand and agree on the plans. In Ilocano households this gathering is taken seriously: it is where responsibilities are divided, the date is set, and the sponsors are named. Respect for elders runs through everything, and their counsel often shapes the biggest decisions — from the choice of date to the size of the wedding. A couple who brings the elders along early tends to have a much smoother road to the altar. There is a quiet practicality at work too: by settling money and roles around a table, with food shared and elders present, an Ilocano family avoids the awkward late conversations that strain so many weddings. What looks like ceremony is also good planning — the kind that keeps a wedding affordable and a family at peace.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "ilocano-wedding-traditions",
    from: "Perhaps the most well-known Ilocano wedding custom is the bitor: a gift-giving or money-pinning tradition where guests, family and friends contribute to help the newlyweds begin married life. In some celebrations it takes the form of the familiar money dance, with bills pinned to the couple as they dance; in others it is a more formal offering received and recorded by a relative. Whatever the form, the spirit is the same — the community pools its resources so the couple does not start out alone, and the gesture is remembered for years.",
    to: "Perhaps the most well-known Ilocano wedding custom is the bitor: a gift-giving or money-pinning tradition where guests, family and friends contribute to help the newlyweds begin married life. At some weddings it takes the form of the familiar money dance, with bills pinned to the couple as they dance; in others it is a more formal offering received and recorded by a relative. Whatever the form, the spirit is the same — the community pools its resources so the couple does not start out alone, and the gesture is remembered for years.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "ilocano-wedding-traditions",
    from: "The thrift the region is known for is a planning asset, not a limit. Careful budgeting and a clear timeline let an Ilocano couple host a celebration that feels abundant without overspending — choosing where to be generous (the food, the people) and where to keep things simple (the extras that few guests will remember). Many of the tools that help you plan this way are free, which keeps the spirit of the bitor alive in the planning itself.",
    to: "The thrift the region is known for is a planning asset, not a limit. Careful budgeting and a clear timeline let an Ilocano couple host a wedding that feels abundant without overspending — choosing where to be generous (the food, the people) and where to keep things simple (the extras that few guests will remember). Many of the tools that help you plan this way are free, which keeps the spirit of the bitor alive in the planning itself.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "ilocano-wedding-traditions",
    from: "Plan your Northern celebration with a free, deadline-aware checklist.\nsetnayan.com/features",
    to: "Plan your Northern wedding with a free, deadline-aware checklist.\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "intimate-wedding-vs-big-wedding-cost",
    from: "An intimate wedding does more than cut the bill. It lets you spend more per guest — a nicer venue, better food, a longer celebration — while spending less overall, and it buys you real time with everyone there instead of a blur of handshakes. A big wedding, on the other hand, honours the Filipino reality that family and community are wide and beloved, and leaving people out carries its own quiet cost in relationships. Neither is wrong; the right choice is the one you can fund comfortably and will be glad of for years.",
    to: "An intimate wedding does more than cut the bill. It lets you spend more per guest — a nicer venue, better food, a longer reception — while spending less overall, and it buys you real time with everyone there instead of a blur of handshakes. A big wedding, on the other hand, honours the Filipino reality that family and community are wide and beloved, and leaving people out carries its own quiet cost in relationships. Neither is wrong; the right choice is the one you can fund comfortably and will be glad of for years.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "marriage-license-requirements-philippines",
    from: "Setnayan tracks the statutory deadlines for your date — licence window included — so nothing lapses.\nsetnayan.com/features",
    to: "Setnayan's checklist dates every task from your wedding date, so each deadline shows up in time.\nsetnayan.com/features",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "mobile-bar-wedding-philippines",
    from: "Find and compare mobile bar suppliers near your venue, with no booking commission.\nsetnayan.com/?browse=1",
    to: "Find and compare mobile bar suppliers near your venue.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "money-dance-filipino-wedding",
    from: "• The host or emcee announces the money dance and invites guests to line up, usually after dinner when the room is relaxed.\n• Helpers — often close friends or members of the entourage — stand by with pins, tape, or ribbon to attach the bills neatly.\n• Guests dance briefly with the bride or groom, pin their gift, and step aside so the next person can take a turn.\n• A trusted person quietly collects and safekeeps the cash as the dance winds down, so nothing goes astray in the celebration.",
    to: "• The host or emcee announces the money dance and invites guests to line up, usually after dinner when the room is relaxed.\n• Helpers — often close friends or members of the entourage — stand by with pins, tape, or ribbon to attach the bills neatly.\n• Guests dance briefly with the bride or groom, pin their gift, and step aside so the next person can take a turn.\n• A trusted person quietly collects and safekeeps the cash as the dance winds down, so nothing goes astray in the festivities.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "money-dance-filipino-wedding",
    from: "Plan your reception program, guest list, and budget in one free workspace — no commission on your suppliers, ever.\nsetnayan.com/signup",
    to: "Plan your reception program, guest list, and budget in one free workspace. Hosts pay 0% commission.\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "muslim-moro-wedding-philippines",
    from: "A Muslim Filipino wedding is, at its heart, a solemn covenant and a joyful coming-together of two families. Among the Moro peoples of Mindanao — the Maranao, Maguindanao, Tausug and others — the celebration can be richly cultural, layered with music, attire and feasting that vary beautifully from community to community. This overview is written respectfully by an informed outsider; it describes the marriage in general, well-established terms only. For the specifics that matter to your union, the right guides are your imam and your families, and the governing law is the Code of Muslim Personal Laws of the Philippines.",
    to: "A Muslim Filipino wedding is, at its heart, a solemn covenant and a joyful coming-together of two families. Among the Moro peoples of Mindanao — the Maranao, Maguindanao, Tausug and others — the wedding can be richly cultural, layered with music, attire and feasting that vary beautifully from community to community. This overview is written respectfully by an informed outsider; it describes the marriage in general, well-established terms only. For the specifics that matter to your union, the right guides are your imam and your families, and the governing law is the Code of Muslim Personal Laws of the Philippines.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "muslim-moro-wedding-philippines",
    from: "A defining feature of the Islamic marriage is the mahr — a gift or dowry given by the groom to the bride as her own. It is a mark of honour and commitment, and the details are agreed between the families. Among Moro communities the family plays a central, respected role throughout: in the courtship, in the negotiations, and in the celebration that follows. The wali (guardian) of the bride is part of this process. None of these elements is decorative; each carries meaning, and each is best understood through your own family and officiant rather than a general guide.",
    to: "A defining feature of the Islamic marriage is the mahr — a gift or dowry given by the groom to the bride as her own. It is a mark of honour and commitment, and the details are agreed between the families. Among Moro communities the family plays a central, respected role throughout: in the courtship, in the negotiations, and in the feast that follows. The wali (guardian) of the bride is part of this process. None of these elements is decorative; each carries meaning, and each is best understood through your own family and officiant rather than a general guide.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "muslim-moro-wedding-philippines",
    from: "The celebration\n\nBeyond the contract, the festivities can be magnificent. The kanduli — the communal feast — gathers the wider family and community. Traditional dress, the okir art motifs of Maranao culture, kulintang gong-and-drum ensembles, and dances passed down through generations can all feature, depending on the family and locality. Halal catering is essential, and many couples plan the day around prayer times and the comfort of elders. The richness of the celebration is a point of pride, and it differs from one community to the next — there is no single template for a Moro wedding.",
    to: "The feast and the festivities\n\nBeyond the contract, the festivities can be magnificent. The kanduli — the communal feast — gathers the wider family and community. Traditional dress, the okir art motifs of Maranao culture, kulintang gong-and-drum ensembles, and dances passed down through generations can all feature, depending on the family and locality. Halal catering is essential, and many couples plan the day around prayer times and the comfort of elders. The richness of the feast is a point of pride, and it differs from one community to the next — there is no single template for a Moro wedding.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "new-year-wedding-planning-kickoff",
    from: "Pair your plan with a printable countdown you can fill in by hand and pin to the fridge.\nsetnayan.com/features",
    to: "Let a free, self-updating checklist carry every date.\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "new-years-eve-wedding-philippines",
    from: "Imagine your first kiss as a married couple landing exactly as the fireworks go up and the whole country counts down to midnight. A New Year's Eve wedding is the most dramatic date on the calendar — a celebration that flows straight from your vows into the biggest party of the year, with everyone already in the mood to toast, dance, and stay late. It is unforgettable by design. It is also one of the trickier dates to pull off well, because you are competing with every other New Year plan your guests and suppliers already have. Here is how to make the countdown wedding work.",
    to: "Imagine your first kiss as a married couple landing exactly as the fireworks go up and the whole country counts down to midnight. A New Year's Eve wedding is the most dramatic date on the calendar — a wedding that flows straight from your vows into the biggest party of the year, with everyone already in the mood to toast, dance, and stay late. It is unforgettable by design. It is also one of the trickier dates to pull off well, because you are competing with every other New Year plan your guests and suppliers already have. Here is how to make the countdown wedding work.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "new-years-eve-wedding-philippines",
    from: "Marrying on the last night of the year is bold, glamorous, and deeply romantic — a single celebration that closes one chapter and opens two at once. Plan the midnight moment first, give your guests early and honest notice, sort out the logistics that get sparse on the 31st, and let the countdown do what it was made to do.",
    to: "Marrying on the last night of the year is bold, glamorous, and deeply romantic — a single night that closes one chapter and opens two at once. Plan the midnight moment first, give your guests early and honest notice, sort out the logistics that get sparse on the 31st, and let the countdown do what it was made to do.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "off-peak-weekday-wedding-pros-cons",
    from: "Off-peak rewards couples who value choice and budget over a marquee Saturday, who have a guest list flexible enough to travel midweek, and who are happy to plan a light weather contingency for an off-season date. If that sounds like the two of you, the savings and the calmer, less rushed experience can be very well worth a little extra coordination on the front end. A useful middle path is to keep the guests you most want at the centre of the decision: if your closest people are flexible and local, a weekday is easy, and if your dream entourage is scattered across the country or abroad, a long-weekend off-peak date can capture most of the savings while still making travel realistic for everyone you love. Either way, a weekday or off-season wedding is not a lesser wedding — it is the very same celebration on a smarter calendar. Weigh the guest trade-offs honestly, give generous notice, plan for the weather if you must, and you may well find that your dream suppliers were free all along.",
    to: "Off-peak rewards couples who value choice and budget over a marquee Saturday, who have a guest list flexible enough to travel midweek, and who are happy to plan a light weather contingency for an off-season date. If that sounds like the two of you, the savings and the calmer, less rushed experience can be very well worth a little extra coordination on the front end. A useful middle path is to keep the guests you most want at the centre of the decision: if your closest people are flexible and local, a weekday is easy, and if your dream entourage is scattered across the country or abroad, a long-weekend off-peak date can capture most of the savings while still making travel realistic for everyone you love. Either way, a weekday or off-season wedding is not a lesser wedding — it is the very same wedding on a smarter calendar. Weigh the guest trade-offs honestly, give generous notice, plan for the weather if you must, and you may well find that your dream suppliers were free all along.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "pamamanhikan-explained",
    from: "Customs vary by family and region, but the shape is familiar across the country. The groom's family visits the bride's home, often bringing food, dessert, or a thoughtful gift as a sign of respect — arriving empty-handed is a misstep to avoid. There is conversation, a shared meal, and at some gracious point the blessing is asked and given, sometimes formally and sometimes simply in the warmth of the evening. From there the talk can drift, naturally and without pressure, toward the practical: a rough date, who would like to host what, and how the two families might share the celebration.",
    to: "Customs vary by family and region, but the shape is familiar across the country. The groom's family visits the bride's home, often bringing food, dessert, or a thoughtful gift as a sign of respect — arriving empty-handed is a misstep to avoid. There is conversation, a shared meal, and at some gracious point the blessing is asked and given, sometimes formally and sometimes simply in the warmth of the evening. From there the talk can drift, naturally and without pressure, toward the practical: a rough date, who would like to host what, and how the two families might share the wedding.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "prenup-engagement-shoot-guide-philippines",
    from: "The most memorable prenups are not the most elaborate — they are the most personal. A shoot in the cafe where you first met, the basketball court where he proposed, or your grandparents home will always beat a generic field of flowers you have no connection to. Pick locations and props that mean something, and resist copying someone else photoset wholesale. Your story is the styling.",
    to: "The most memorable prenups are not the most elaborate — they are the most personal. A shoot in the cafe where you first met, the basketball court where he proposed, or your grandparents' home will always beat a generic field of flowers you have no connection to. Pick locations and props that mean something, and resist copying someone else's photoset wholesale. Your story is the styling.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "rainy-season-wedding-philippines",
    from: "Comfort is half the battle, and most of it is won with a few small courtesies. Note on the invitation that the celebration goes on rain or shine, gently suggest closed shoes for a garden setting, and make sure your coordinator and every single supplier know the wet-weather sequence by heart. A rehearsed team moves guests under cover before most people register the first drops. It helps, too, to think of the rain as part of the story rather than its enemy — some of the most-loved wedding photographs ever taken are of couples laughing under a shared umbrella, of clear domes catching the light, of a reception glowing warm against a grey sky. Brief your photographer to be ready for it, and a shower becomes a scene instead of a setback.",
    to: "Comfort is half the battle, and most of it is won with a few small courtesies. Note on the invitation that the wedding goes on rain or shine, gently suggest closed shoes for a garden setting, and make sure your coordinator and every single supplier know the wet-weather sequence by heart. A rehearsed team moves guests under cover before most people register the first drops. It helps, too, to think of the rain as part of the story rather than its enemy — some of the most-loved wedding photographs ever taken are of couples laughing under a shared umbrella, of clear domes catching the light, of a reception glowing warm against a grey sky. Brief your photographer to be ready for it, and a shower becomes a scene instead of a setback.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "release-of-doves-filipino-wedding",
    from: "The release usually lands at a natural high point in the day: just after the couple emerges from the ceremony into the sunlight, or as a flourish during the reception program. Customs vary by family and region, and timing is often chosen for the best light and the biggest audience. Some couples choose butterflies instead of doves — a softer, equally lovely alternative that carries the same spirit of harmony and new beginnings, and that suits gardens and daytime celebrations beautifully. Either way, the meaning is the same: a fragile, living thing set free as a symbol of a fresh start.",
    to: "The release usually lands at a natural high point in the day: just after the couple emerges from the ceremony into the sunlight, or as a flourish during the reception program. Customs vary by family and region, and timing is often chosen for the best light and the biggest audience. Some couples choose butterflies instead of doves — a softer, equally lovely alternative that carries the same spirit of harmony and new beginnings, and that suits gardens and daytime weddings beautifully. Either way, the meaning is the same: a fragile, living thing set free as a symbol of a fresh start.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "release-of-doves-filipino-wedding",
    from: "Browse trusted Filipino suppliers — handlers, stylists, and the teams who make these moments — by city and category.\nsetnayan.com/?browse=1",
    to: "Browse verified Filipino suppliers — handlers, stylists, and the teams who make these moments — by city and category.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "simbang-gabi-and-december-weddings",
    from: "See what your parish will need before you set the date.\nsetnayan.com/features",
    to: "Keep your parish dates and documents in one free checklist before you set the date.\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "unity-candle-ceremony-wedding",
    from: "Whatever your ceremony — Catholic, civil, Christian, or mixed — see how a Filipino wedding flows, beat by beat.\nsetnayan.com/features",
    to: "Whatever your ceremony — Catholic, civil, Christian, or mixed — read our overview of Filipino wedding traditions.\nsetnayan.com/articles/filipino-wedding-traditions-explained",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "visayan-cebuano-wedding-traditions",
    from: "A wedding in the Visayas carries a particular warmth. From Cebu to Bohol, Iloilo to Bacolod, the day is built on family, food and a generosity of spirit that fills every room. If you grew up in the region — or you are marrying into it — you will recognise the rhythm: the families meet first, the church or the beach hosts the vows, and then the celebration spills well into the night. Here are the traditions Visayan and Cebuano couples most often choose to honour, described in general terms. The exact form always varies by family, town and province, so treat your elders as the final word on what your own celebration should hold.",
    to: "A wedding in the Visayas carries a particular warmth. From Cebu to Bohol, Iloilo to Bacolod, the day is built on family, food and a generosity of spirit that fills every room. If you grew up in the region — or you are marrying into it — you will recognise the rhythm: the families meet first, the church or the beach hosts the vows, and then the reception spills well into the night. Here are the traditions Visayan and Cebuano couples most often choose to honour, described in general terms. The exact form always varies by family, town and province, so treat your elders as the final word on what your own wedding should hold.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "visayan-cebuano-wedding-traditions",
    from: "No Visayan celebration is complete without a generous table, and the lechon — Cebu’s is famous nationwide — is often the centrepiece. Expect roast pig, native delicacies, and a spread that no one is meant to finish. Hospitality here is measured in abundance: a host would rather over-cater than risk a guest leaving hungry. Budget accordingly, and lean on a caterer who knows regional favourites and can balance the showpiece lechon with the lighter dishes guests reach for once the feasting slows. A few customs you may still see at the reception: the money dance, where guests pin bills to the couple to help them start their life together; long, heartfelt toasts from family and ninong; and dancing that keeps going long after the formal programme ends. None of it is obligatory — the joy of a regional wedding is choosing the pieces that mean something to you and your families, and letting the rest go.",
    to: "No Visayan wedding is complete without a generous table, and the lechon — Cebu’s is famous nationwide — is often the centrepiece. Expect roast pig, native delicacies, and a spread that no one is meant to finish. Hospitality here is measured in abundance: a host would rather over-cater than risk a guest leaving hungry. Budget accordingly, and lean on a caterer who knows regional favourites and can balance the showpiece lechon with the lighter dishes guests reach for once the feasting slows. A few customs you may still see at the reception: the money dance, where guests pin bills to the couple to help them start their life together; long, heartfelt toasts from family and ninong; and dancing that keeps going long after the formal programme ends. None of it is obligatory — the joy of a regional wedding is choosing the pieces that mean something to you and your families, and letting the rest go.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "visayan-cebuano-wedding-traditions",
    from: "Ready to map out your own Visayan celebration, from the family meeting to the feast?\nsetnayan.com/signup",
    to: "Ready to map out your own Visayan wedding, from the family meeting to the feast?\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-cake-guide-philippines",
    from: "Find cake designers near your venue and compare styles and packages, commission-free.\nsetnayan.com/?browse=1",
    to: "Find cake designers near your venue and compare styles and packages.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-contingency-fund-philippines",
    from: "The unexpected at a wedding is remarkably predictable in shape, even if you cannot name it in advance. The buffer is what absorbs all of it — overtime when the celebration runs long, a late surge of guests or sponsors who could not be turned away, a wet-weather backup or generator, a supplier issue that means rebooking at short notice, and the small fees like corkage and service charge that always appear — without forcing a stressful conversation or a credit-card swipe. And if a buffer feels like a luxury on a tight budget, flip the logic: it is precisely the tighter budgets that need it most, because a wedding with little slack is the one most easily derailed by a single unexpected fee.",
    to: "The unexpected at a wedding is remarkably predictable in shape, even if you cannot name it in advance. The buffer is what absorbs all of it — overtime when the reception runs long, a late surge of guests or sponsors who could not be turned away, a wet-weather backup or generator, a supplier issue that means rebooking at short notice, and the small fees like corkage and service charge that always appear — without forcing a stressful conversation or a credit-card swipe. And if a buffer feels like a luxury on a tight budget, flip the logic: it is precisely the tighter budgets that need it most, because a wedding with little slack is the one most easily derailed by a single unexpected fee.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-coordinator-on-the-day-vs-full",
    from: "As a rough 2026 market guide, on-the-day coordination in the Philippines typically costs a good deal less than full planning, which scales with the size and complexity of the wedding. If the budget is tight, on-the-day coordination is often the single highest-value supplier you can add — it protects every other peso you have already spent. With a free planning workspace doing the organising, many couples comfortably handle the rest themselves.\n\nPlan it yourself with a free workspace, then add a coordinator for the day — start in minutes.\nsetnayan.com/signup",
    to: "On-the-day coordination in the Philippines typically costs a good deal less than full planning, which scales with the size and complexity of the wedding. If the budget is tight, on-the-day coordination is often the single highest-value supplier you can add — it protects every other peso you have already spent. With a free planning workspace doing the organising, many couples comfortably handle the rest themselves.\n\nPlan it yourself with a free workspace, then add a coordinator for the day.\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-florist-styling-guide-philippines",
    from: "As a rough 2026 market guide, wedding florals and styling in the Philippines span a wide range — modest packages for an intimate celebration through to substantial figures for full ballroom transformations. The number that matters is not the total but the fit: a supplier who understands your mood board, respects your budget, and tells you honestly what is achievable on your date.",
    to: "Wedding florals and styling in the Philippines span a wide range — modest packages for an intimate wedding through to substantial figures for full ballroom transformations. The number that matters is not the total but the fit: a supplier who understands your mood board, respects your budget, and tells you honestly what is achievable on your date.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-invitation-wording-etiquette-philippines",
    from: "A few topics call for a gentle touch, and these are the ones that quietly cause the most hurt when handled carelessly. If your reception is adults-only, the cleanest way to convey it is on your Event Hub or a small separate insert, and by addressing the envelope only to the invited adults — pointedly naming whose children are excluded on the card itself reads as cold and is remembered. If you would rather receive cash than gifts, never state it directly on the formal invitation; a softly worded note on your Event Hub, or quiet word of mouth through the family, is the Filipino way to make wishes known without ever appearing grabbing. And always address envelopes by name, never with a vague \"and family\", so each guest knows exactly who, and how many, are actually invited — that single courtesy heads off most of the day-of confusion at the door. Finally, let the tone of the whole thing match the tone of the wedding: a grand church celebration can carry formal, traditional language, while an intimate garden wedding can be warmer and more conversational. The wording should read like a true preview of the day, not a template borrowed from someone else's. Read it aloud before you print — if it sounds like the two of you, it is ready.",
    to: "A few topics call for a gentle touch, and these are the ones that quietly cause the most hurt when handled carelessly. If your reception is adults-only, the cleanest way to convey it is on your Event Hub or a small separate insert, and by addressing the envelope only to the invited adults — pointedly naming whose children are excluded on the card itself reads as cold and is remembered. If you would rather receive cash than gifts, never state it directly on the formal invitation; a softly worded note on your Event Hub, or quiet word of mouth through the family, is the Filipino way to make wishes known without ever appearing grabbing. And always address envelopes by name, never with a vague \"and family\", so each guest knows exactly who, and how many, are actually invited — that single courtesy heads off most of the day-of confusion at the door. Finally, let the tone of the whole thing match the tone of the wedding: a grand church wedding can carry formal, traditional language, while an intimate garden wedding can be warmer and more conversational. The wording should read like a true preview of the day, not a template borrowed from someone else's. Read it aloud before you print — if it sounds like the two of you, it is ready.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-lights-and-sounds-guide",
    from: "• Sound: speakers sized to your room and crowd, microphones for the officiant, host, and speeches, and a mixing board with a live operator.\n• Lighting: ambient and mood lighting, uplights to wash the walls in your palette, spotlights for the entrance and first dance, and sometimes a monogram or gobo projection.\n• AV and screens: an LED wall or projector for your photo or video montage, a slideshow, or a live feed of the program.\n• The operator: a technician on site for the whole event, not just a drop-off of equipment.",
    to: "• Sound: speakers sized to your room and crowd, microphones for the officiant, host, and speeches, and a mixing board with a live operator.\n• Lighting: ambient and mood lighting, uplights to wash the walls in your palette, spotlights for the entrance and first dance, and sometimes your initials or a gobo projection.\n• AV and screens: an LED wall or projector for your photo or video montage, a slideshow, or a live feed of the program.\n• The operator: a technician on site for the whole event, not just a drop-off of equipment.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-lights-and-sounds-guide",
    from: "Coordinate the lights and sounds team with your host and music early, ideally at the same planning meeting, so the entrance music, the dimming for the first dance, and the spotlight cues all land together rather than fighting each other on the night. As a rough 2026 market guide, lights-and-sounds packages in the Philippines range widely with room size, gear quality, the length of the event, and whether LED screens are included. The order of spending matters more than the total: put your money first into clear, reliable sound and a live operator who stays for the whole program. The lighting flourishes — the uplights, the monogram, the warm wash on the walls — are genuinely worth it, but only once the room can hear you say \"I do.\"\n\nFind lights-and-sounds and AV suppliers who know your venue, and compare them commission-free.\nsetnayan.com/?browse=1",
    to: "Coordinate the lights and sounds team with your host and music early, ideally at the same planning meeting, so the entrance music, the dimming for the first dance, and the spotlight cues all land together rather than fighting each other on the night. Lights-and-sounds packages in the Philippines range widely with room size, gear quality, the length of the event, and whether LED screens are included. The order of spending matters more than the total: put your money first into clear, reliable sound and a live operator who stays for the whole program. The lighting flourishes — the uplights, your initials in light, the warm wash on the walls — are genuinely worth it, but only once the room can hear you say \"I do.\"\n\nFind lights-and-sounds and AV suppliers who know your venue, and compare them side by side.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-payment-schedule-deposits-explained",
    from: "When you have eight or ten suppliers, each with their own deposit and balance dates, the calendar is where money slips through the cracks — a balance due you forgot, a deposit you cannot remember sending. The fix is to record each payment the moment it goes out, tagged to the supplier and the milestone it covers, so a single glance tells you your true remaining balance across the whole wedding rather than a guess and a stack of receipts in your phone’s photos. This is also your early-warning system: if the payments due in a given month start to crowd together, you see it weeks ahead and can talk to a supplier about adjusting a date, instead of discovering the crunch the week it lands. Because Setnayan takes zero commission on supplier bookings, the only amounts on your schedule are the ones you agreed with your suppliers — never a surprise platform fee on top. Pay in stages, get it in writing, keep your records, and watch the calendar, and the scariest part of working with suppliers becomes routine: money out, value in, all the way to the day.",
    to: "When you have eight or ten suppliers, each with their own deposit and balance dates, the calendar is where money slips through the cracks — a balance due you forgot, a deposit you cannot remember sending. The fix is to record each payment the moment it goes out, tagged to the supplier and the milestone it covers, so a single glance tells you your true remaining balance across the whole wedding rather than a guess and a stack of receipts in your phone’s photos. This is also your early-warning system: if the payments due in a given month start to crowd together, you see it weeks ahead and can talk to a supplier about adjusting a date, instead of discovering the crunch the week it lands. Hosts pay 0% commission. The only amounts on your schedule are the ones you agreed with your suppliers. Pay in stages, get it in writing, keep your records, and watch the calendar, and the scariest part of working with suppliers becomes routine: money out, value in, all the way to the day.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-photo-deliverables-explained",
    from: "Compare photographer packages by what they actually deliver, not just the headline price.\nsetnayan.com/features",
    to: "Compare photographer packages by what they actually deliver, not just the headline price.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-photo-video-contract-red-flags",
    from: "• A specific delivery window for edited photos, and a separate one for the video.\n• A turnaround date for the album, which is usually later than the digital files.\n• What happens, and what you are owed, if those deadlines are missed.\n• Avoid vague phrasing like soon, in a few months, or when ready.",
    to: "• A specific delivery window for edited photos, and a separate one for the video.\n• A turnaround date for the album, which is usually later than the digital files.\n• What happens, and what you are owed, if those deadlines are missed.\n• Avoid vague phrasing like \"soon\", \"in a few months\" or \"when ready\".",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-photo-video-contract-red-flags",
    from: "Photographers get sick. Gear fails. A serious supplier has a plan for both, and that plan is written down. The contract should name what happens if your booked shooter cannot make it — a qualified replacement of similar standard — and should mention backup equipment. If a supplier brushes off the what if you cannot come question, you are carrying a risk they should be carrying.",
    to: "Photographers get sick. Gear fails. A serious supplier has a plan for both, and that plan is written down. The contract should name what happens if your booked shooter cannot make it — a qualified replacement of similar standard — and should mention backup equipment. If a supplier brushes off the \"what if you cannot come?\" question, you are carrying a risk they should be carrying.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-photo-video-contract-red-flags",
    from: "Book suppliers you can verify and message in one place, with 0% commission on what you pay them.\nsetnayan.com/?browse=1",
    to: "Book suppliers you can verify and message in one place.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-photographer-vs-videographer-philippines",
    from: "Booking a combined photo-and-video team usually costs less than hiring two separate suppliers, and it removes the awkward dance of two rival crews fighting for the same angle and stepping into each other shots all day. Bundled packages range widely, from a smaller team to an established studio with multiple shooters, a dedicated cinematographer and a same-day edit, so ask 3 suppliers for a quote on the same coverage. The gap reflects real differences — hours of coverage, crew size, deliverables, and polish — so two quotes that look far apart can describe nearly the same wedding once you line up the inclusions. Always confirm what counts as photo and what counts as video inside a single bundled price, because sometimes the video is a lighter add-on rather than full, independent coverage.",
    to: "Booking a combined photo-and-video team usually costs less than hiring two separate suppliers, and it removes the awkward dance of two rival crews fighting for the same angle and stepping into each other's shots all day. Bundled packages range widely, from a smaller team to an established studio with multiple shooters, a dedicated cinematographer and a same-day edit, so ask 3 suppliers for a quote on the same coverage. The gap reflects real differences — hours of coverage, crew size, deliverables, and polish — so two quotes that look far apart can describe nearly the same wedding once you line up the inclusions. Always confirm what counts as photo and what counts as video inside a single bundled price, because sometimes the video is a lighter add-on rather than full, independent coverage.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-photographer-vs-videographer-philippines",
    from: "See how much photo and video teams actually charge across the Philippines before you decide.\nsetnayan.com/features",
    to: "Compare photo and video teams side by side.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-seating-plan-guide-philippines",
    from: "The instinct is to seat everyone strictly by family line, but the better question is always who will actually enjoy sitting together. Cluster guests who already know one another or share something in common — college friends at one table, workmates at another, the titos who follow the same teleserye together. A guest surrounded by familiar faces relaxes and stays late; one stranded among strangers watches the clock. Handle the known tensions quietly too: keep estranged relatives at a comfortable distance, with no drama and no announcement. And do not finalise anything until your RSVPs are in and your headcount is firm — late confirmations and surprise plus-ones will rearrange your careful work, so build the plan somewhere you can reshuffle in seconds rather than redraw by hand. Once it is set, place cards or a clear seating display at the entrance let guests find their tables without a bottleneck at the door.\n\nArrange your tables visually and reshuffle in seconds as RSVPs change — the seating planner is free with every Setnayan account.\nsetnayan.com/signup",
    to: "The instinct is to seat everyone strictly by family line, but the better question is always who will actually enjoy sitting together. Cluster guests who already know one another or share something in common — college friends at one table, workmates at another, the titos who follow the same teleserye together. A guest surrounded by familiar faces relaxes and stays late; one stranded among strangers watches the clock. Handle the known tensions quietly too: keep estranged relatives at a comfortable distance, with no drama and no announcement. And do not finalise anything until your RSVPs are in and your headcount is firm — late confirmations and surprise plus-ones will rearrange your careful work, so build the plan somewhere you can reshuffle easily rather than redraw by hand. Once it is set, place cards or a clear seating display at the entrance let guests find their tables without a bottleneck at the door.\n\nArrange your tables visually and reshuffle as RSVPs change — the seating planner is free with every Setnayan account.\nsetnayan.com/signup",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-videography-styles-philippines",
    from: "You watch a few sample films, they all look stunning, and you book one — only to feel, months later, that the wedding video does not quite feel like your wedding. That mismatch is almost always a style problem, not a talent problem. Wedding videographers work in different traditions, and knowing the difference before you sign saves you from a beautiful film of someone else marriage.",
    to: "You watch a few sample films, they all look stunning, and you book one — only to feel, months later, that the wedding video does not quite feel like your wedding. That mismatch is almost always a style problem, not a talent problem. Wedding videographers work in different traditions, and knowing the difference before you sign saves you from a beautiful film of someone else's marriage.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "wedding-wet-weather-contingency-plan",
    from: "See how a free, self-updating planning checklist keeps your whole timeline honest, even when a date has to change.\nsetnayan.com/features",
    to: "See how a free, self-updating planning checklist keeps your whole timeline honest, even when a date has to change.\nsetnayan.com/articles/what-to-do-12-months-before-your-philippine-wedding",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "what-is-a-same-day-edit-sde-wedding",
    from: "The magic of an SDE is timing, pure and simple. Your guests get to relive the morning they mostly did not witness — the bride in her robe, the groom steadying his nerves, the first look — while the emotion of the day is still fresh in the room. The reception gains a genuine showstopper that lifts the whole programme. And it hands you something to share the very night of the wedding, while everyone is still glowing and the comments are pouring in. For a celebration that is, at heart, a shared experience, that immediacy is very hard to match with a film you only receive months later.",
    to: "The magic of an SDE is timing, pure and simple. Your guests get to relive the morning they mostly did not witness — the bride in her robe, the groom steadying his nerves, the first look — while the emotion of the day is still fresh in the room. The reception gains a genuine showstopper that lifts the whole programme. And it hands you something to share the very night of the wedding, while everyone is still glowing and the comments are pouring in. For a wedding that is, at heart, a shared experience, that immediacy is very hard to match with a film you only receive months later.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "what-is-a-same-day-edit-sde-wedding",
    from: "• Worth it if a live reception highlight matters to you and the budget allows.\n• Skippable if you would rather put that money toward fuller coverage or a longer final film.\n• Confirm whether the SDE is in addition to, or instead of, your main highlight video.\n• Ask to see two or three of the studio actual same-day edits before you commit.",
    to: "• Worth it if a live reception highlight matters to you and the budget allows.\n• Skippable if you would rather put that money toward fuller coverage or a longer final film.\n• Confirm whether the SDE is in addition to, or instead of, your main highlight video.\n• Ask to see two or three of the studio's actual same-day edits before you commit.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "what-zero-commission-means-for-couples",
    field: 'title',
    from: "What 0% commission means for couples and suppliers",
    to: "How Setnayan pricing works for hosts",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "what-zero-commission-means-for-couples",
    from: "When you book a wedding supplier through a platform, it is fair to assume the platform makes its money somewhere. Often, that somewhere is a commission — a percentage taken from every booking. It is easy to miss because you rarely see it on the invoice, but it shapes prices all the same. We do something different: no commission on your bookings. To understand why that matters, it helps to see exactly how a commission works, and who quietly ends up paying for it.\n\nHow a commission quietly raises prices\n\nImagine a platform takes a cut of every booking it helps arrange. A supplier knows that a slice of whatever they charge will go to the platform, not to them. So to take home the fee they actually need, they nudge their price up to cover the cut. The couple sees that higher price and assumes it is simply the market rate. The commission never appears as a line item, but it is baked into the number all the same — a hidden markup that the couple pays and the supplier never keeps. Multiply that across every booking and it adds up to real money quietly moved off the table. The cruel part is that no one in the transaction feels good about it: the couple pays more than they should, the supplier earns less than their price suggests, and the only winner is the layer in the middle that did none of the work on the actual wedding.\n\n“A commission is a cost nobody sees on the invoice and everybody pays in the price.”\n\nWhat zero commission changes\n\nWith 0% commission, that whole layer simply disappears. We do not take a percentage of what you book, which means nothing is skimmed off the price you agree and the supplier has no reason to inflate it to cover a cut. The number you discuss with a supplier is the number between the two of you. Both sides come out ahead in a way that is easy to state plainly.\n\n• Your payments to suppliers go straight to them, to their GCash or bank — that money never passes through Setnayan.\n• Couples pay no hidden platform markup folded into the supplier’s price.\n• The quoted price is the real price, set by the supplier and agreed with you.\n• Suppliers can price competitively without padding for a commission they would otherwise lose.",
    to: "When you book a wedding supplier through a platform, it is fair to wonder how the platform makes its money, and whether some of it is hidden inside the price you pay. On Setnayan the answer for hosts is short. Hosts pay 0% commission. Here is what that means for you, from the first quote to the last payment.\n\nWhat you pay a supplier\n\nThe price you discuss with a supplier is the price between the two of you. Ask each supplier for an itemised quote, so you can compare what is included line by line, and agree the payment schedule in writing before you pay a reservation fee.\n\n“The price you agree with a supplier is the price you pay them.”\n\n• Your payments to suppliers go straight to them, to their GCash or bank — that money never passes through Setnayan.\n• The quoted price is the real price, set by the supplier and agreed with you.\n• Every payment you record lands in your budget, so you always know what is paid and what is still owed.\n\nWhat you pay Setnayan\n\nPlanning on Setnayan is free: the checklist, guest list, budget and seating, plus a free Event Hub with online RSVP. Paid plans (Event Plus, Event Pro and Event Ultra) add optional extras for the day. Each one is priced at setnayan.com/pricing, so you can see what it adds before you choose.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "what-zero-commission-means-for-couples",
    from: "A wedding economy works best when the couple and the supplier deal directly and fairly, with no invisible hand taking a slice in the middle. Suppliers — many of them small, family-run teams — keep what they earn, which lets them invest in their craft instead of in covering a fee. Couples get honest pricing they can actually compare, instead of numbers quietly inflated by a markup they cannot see. We earn our keep in other, transparent ways, so the booking itself can stay clean. It is a simpler arrangement, and a fairer one. It also keeps the relationship where it belongs — between you and the people actually doing the work. When no one is taking a cut of the deal, there is no pressure to route your payment a certain way or to nudge you toward whoever pays the platform the most. You choose the supplier you trust, and you settle on a price that is honest on both ends.\n\nWhat suppliers do pay\n\nNo commission does not mean suppliers pay nothing, and we would rather say so plainly. Setnayan bills a supplier a booking fee on a booking, unless the supplier is the first to bring the event: a supplier who is the first to bring an event onto Setnayan — through their own invite, their own booking QR code or their own link — books it free, and a couple new to Setnayan through a supplier books them free. Every other booking carries the fee. The fee is charged to the supplier and is never added to what a couple pays. Suppliers can also choose an optional plan for a bigger shop; how far a supplier is found comes from getting Verified, not from the plan. The current rate is on the For Suppliers page.\n\nZero commission is not a discount or a promo — it is a structural choice. By refusing to take a cut of your bookings, we keep the hidden markup out of your price. What you negotiate is what you pay.\n\nBrowse suppliers and talk price directly, with no platform cut in the middle.\nsetnayan.com/?browse=1",
    to: "A wedding works best when the couple and the supplier deal directly and fairly. It keeps the relationship where it belongs — between you and the people actually doing the work. You choose the supplier you want, and you settle on a price that is clear on both ends.\n\nBrowse suppliers and talk price directly.\nsetnayan.com/?browse=1",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "who-pays-for-what-filipino-wedding",
    from: "Older Filipino custom borrowed from Spanish-Catholic tradition, where the groom’s side carried much of the financial weight — a nod to the arrhae, the 13 coins the groom presents as a pledge to provide. The bride’s family often took on the attire and certain personal preparations, and principal sponsors, the ninong and ninang, were sometimes looked to for help with specific elements of the celebration. It was less a strict invoice and more a web of expectations passed down through generations — warm in spirit, but easy to misread today, when families are smaller, couples marry later, and almost no one assumes the old roles automatically anymore.",
    to: "Older Filipino custom borrowed from Spanish-Catholic tradition, where the groom’s side carried much of the financial weight — a nod to the arrhae, the 13 coins the groom presents as a pledge to provide. The bride’s family often took on the attire and certain personal preparations, and principal sponsors, the ninong and ninang, were sometimes looked to for help with specific elements of the wedding. It was less a strict invoice and more a web of expectations passed down through generations — warm in spirit, but easy to misread today, when families are smaller, couples marry later, and almost no one assumes the old roles automatically anymore.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "why-wedding-planning-should-be-free",
    from: "There is a clear line between the wedding itself and the act of organising it. Your venue, your caterer, your photographer — those have real costs, because real people and resources go into them. But a checklist that reminds you what to do twelve months out, a guest list that tracks RSVPs, a budget that tells you how much is left, a seating chart that sorts your tables — these are organising tools. They do not add to the celebration; they keep it from falling apart. They are the wedding-planning equivalent of pen and paper, and no one should have to rent the pen. Charging a couple for the ability to stay on top of their own plans turns a basic need into a paywall, and that never sat right with us. The couples most likely to need a clear budget and a tidy guest list are often the ones watching every peso most closely — exactly the people who should not be charged for staying organised.\n\n“You should never have to pay for the privilege of keeping your own wedding organised.”",
    to: "There is a clear line between the wedding itself and the act of organising it. Your venue, your caterer, your photographer — those have real costs, because real people and resources go into them. But a checklist that reminds you what to do twelve months out, a guest list that tracks RSVPs, a budget that tells you how much is left, a seating chart that sorts your tables — these are organising tools. They do not add to the wedding; they keep it from falling apart. They are the wedding-planning equivalent of pen and paper, and no one should have to rent the pen. Charging a couple for the ability to stay on top of their own plans turns a basic need into a paywall, and that never sat right with us. The couples most likely to need a clear budget and a tidy guest list are often the ones watching every peso most closely — exactly the people who should not be charged for staying organised.\n\n“Paying for a venue makes sense. Paying just to stay organised does not.”",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "why-wedding-planning-should-be-free",
    from: "When we say the planning workspace is free, we mean the everyday tools every couple needs, with nothing held back behind a trial or a subscription. You can run your whole plan through them from the day you get engaged to the day you say your vows, without a card on file.",
    to: "When we say planning on Setnayan is free, we mean the everyday tools every couple needs. You can run your whole plan through them from the day you get engaged to the day you say your vows, without a card on file.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
  {
    slug: "why-wedding-planning-should-be-free",
    from: "Free is only sustainable if it is honest, so here is the plain version. The planning workspace stays free because it costs us very little to run for each couple, and because we would rather earn your trust early than charge you for the basics. There are optional extras a couple can choose to add — the kind of premium touches that go beyond plain planning — but you are never required to buy anything to organise your wedding from start to finish. The default is free, and it is a real default, not a teaser. There is no trial timer counting down and no card you must enter just to begin. The planning tools are free; Event Pro is there if you want the extras, and it is optional. You can plan your entire wedding without ever buying it, because the everyday tools are not the part we charge for.\n\nYour wedding will ask enough of your savings without the planning tools adding to the bill. Keep your money for the celebration and the people in it; let the organising part be free, because it should be.",
    to: "Free is only sustainable if it is honest, so here is the plain version. Planning on Setnayan is free: the checklist, guest list, budget and seating. It costs us very little to run for each couple, and we would rather earn your trust early than charge you for the basics. Paid plans (Event Plus, Event Pro and Event Ultra) add optional extras for the day — the kind of premium touches that go beyond plain planning. There is no trial timer counting down and no card you must enter just to begin. See what each plan adds at setnayan.com/pricing.\n\nYour wedding will ask enough of your savings without the planning tools adding to the bill. Keep your money for the wedding and the people in it; let the organising part be free, because it should be.",
    migration: "20271365567400_articles_say_only_hosts_pay_0_commission_and_the_test_story_leaves.sql",
  },
];
