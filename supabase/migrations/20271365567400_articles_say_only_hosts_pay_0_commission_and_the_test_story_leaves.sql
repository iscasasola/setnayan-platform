-- ============================================================================
-- 📰 LIVE ARTICLES SAY ONLY "HOSTS PAY 0% COMMISSION." · THE TEST STORY LEAVES
-- ============================================================================
-- Owner rulings 27 Nov 2026 (content finalization, list docs/content-finalization-2026-11-27.md, rows L · A · B,
-- P6 and P33): hosts see only the exact sentence "Hosts pay 0% commission." and the supplier booking fee is never
-- explained to hosts; no "stays free" / "never have to pay" promise; paid plans are named Event Plus, Event Pro
-- and Event Ultra (never Event Pro alone); "celebration" only in brand lines; no speed claims, no hand-typed counts,
-- and every CTA points where its words say. The Journal posts live in `creator_chapters` (imported by
-- 20271355899662, already applied), so an applied migration is never edited: the source (`lib/blog.ts`,
-- `lib/blog-batches/*`) carries each edit, `lib/journal-edits-after-import.ts` lists it, and THIS migration makes
-- the same edit in production. `lib/journal-move.test.ts` proves the three agree.
--
-- 1. 106 text edits over 66 Journal posts. Each one replaces one exact passage of one named post
--    (is_journal, by slug), and only while that passage is still there. A post an admin already rewrote, or a
--    second run, matches nothing and changes nothing.
-- 2. `our-batanes-wedding-told-in-full` (a member-style story posted by a test account on 12 Aug; it opens like the
--    test fixture in tests/db/chapter-body-is-the-story.db.test.ts) is taken down the way a moderator takes one
--    down: `removed_at = now()`. It leaves the article page, the feed, the sitemap and llms.txt. Only while it is
--    still up; a Journal post can never match.
--
-- Scope: the slugs named below, nothing else. No schema change. Idempotent.
-- ============================================================================

BEGIN;

-- A busy table: wait at most 5 s for its lock, then fail (deploy-prod fails closed; the next run applies it).
SET LOCAL lock_timeout = '5s';


-- ── aglipayan-wedding-overview ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Because the Iglesia Filipina Independiente shares much of its liturgical heritage with the Catholic and Anglican traditions, an Aglipayan wedding will be recognisable to most Filipino guests. It is a solemn church ceremony, officiated by a priest, with the rhythm and dignity of a liturgical celebration. Couples often see the same beloved Filipino sacramental symbols woven in, which means guests of many backgrounds tend to feel immediately at home in the pews.$old$, $new$Because the Iglesia Filipina Independiente shares much of its liturgical heritage with the Catholic and Anglican traditions, an Aglipayan wedding will be recognisable to most Filipino guests. It is a solemn church ceremony, officiated by a priest, with the rhythm and dignity of a liturgical rite. Couples often see the same beloved Filipino sacramental symbols woven in, which means guests of many backgrounds tend to feel immediately at home in the pews.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'aglipayan-wedding-overview'
   AND position($old$Because the Iglesia Filipina Independiente shares much of its liturgical heritage with the Catholic and Anglican traditions, an Aglipayan wedding will be recognisable to most Filipino guests. It is a solemn church ceremony, officiated by a priest, with the rhythm and dignity of a liturgical celebration. Couples often see the same beloved Filipino sacramental symbols woven in, which means guests of many backgrounds tend to feel immediately at home in the pews.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Curious about the veil, cord and coins? Here is what each one means.
setnayan.com/features$old$, $new$Curious about the veil, cord and coins? Here is what each one means.
setnayan.com/articles/cord-veil-coins-wedding-meaning$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'aglipayan-wedding-overview'
   AND position($old$Curious about the veil, cord and coins? Here is what each one means.
setnayan.com/features$old$ IN body) > 0;

-- ── average-wedding-cost-philippines-2026 ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$"What is the average cost of a wedding in the Philippines?" is the question every newly engaged couple types into their phone at midnight. The honest answer is that there is no single average — a quiet civil wedding for thirty guests and a grand church celebration for three hundred are both Filipino weddings, and they sit worlds apart on cost. What is far more useful than an average is understanding what drives the number, so you can place your own wedding on the scale with eyes open.$old$, $new$"What is the average cost of a wedding in the Philippines?" is the question every newly engaged couple types into their phone at midnight. The honest answer is that there is no single average — a quiet civil wedding for thirty guests and a grand church wedding for three hundred are both Filipino weddings, and they sit worlds apart on cost. What is far more useful than an average is understanding what drives the number, so you can place your own wedding on the scale with eyes open.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'average-wedding-cost-philippines-2026'
   AND position($old$"What is the average cost of a wedding in the Philippines?" is the question every newly engaged couple types into their phone at midnight. The honest answer is that there is no single average — a quiet civil wedding for thirty guests and a grand church celebration for three hundred are both Filipino weddings, and they sit worlds apart on cost. What is far more useful than an average is understanding what drives the number, so you can place your own wedding on the scale with eyes open.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$An average blends a backyard celebration and a five-star ballroom into one figure that describes neither. Your cost depends far more on the choices in front of you than on any national number. The same wedding can double in price by moving from a province to Metro Manila, from a weekday to a Saturday in December, or from eighty guests to two hundred.$old$, $new$An average blends a backyard party and a five-star ballroom into one figure that describes neither. Your cost depends far more on the choices in front of you than on any national number. The same wedding can double in price by moving from a province to Metro Manila, from a weekday to a Saturday in December, or from eighty guests to two hundred.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'average-wedding-cost-philippines-2026'
   AND position($old$An average blends a backyard celebration and a five-star ballroom into one figure that describes neither. Your cost depends far more on the choices in front of you than on any national number. The same wedding can double in price by moving from a province to Metro Manila, from a weekday to a Saturday in December, or from eighty guests to two hundred.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$See the full percentage breakdown of where a Filipino wedding budget really goes.
setnayan.com/features$old$, $new$See the full percentage breakdown of where a Filipino wedding budget really goes.
setnayan.com/articles/wedding-budget-breakdown-philippines$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'average-wedding-cost-philippines-2026'
   AND position($old$See the full percentage breakdown of where a Filipino wedding budget really goes.
setnayan.com/features$old$ IN body) > 0;

-- ── avp-save-the-date-video-guide ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$This is your announcement, dressed up. Often built from prenup footage or a short, fun shoot done just for the purpose, it is a brief and highly shareable clip — typically under a minute — that lands in your guests inboxes, group chats, and feeds carrying only the essentials: who is getting married, and when. Its whole job is to lock the date into people heads early and set the tone, so guests immediately sense whether to expect something formal and grand, relaxed and beachy, or light and playful. Because it travels online, it should look good on a phone screen and make sense even when watched on mute, which is how most people will first see it.$old$, $new$This is your announcement, dressed up. Often built from prenup footage or a short, fun shoot done just for the purpose, it is a brief and highly shareable clip — typically under a minute — that lands in your guests' inboxes, group chats, and feeds carrying only the essentials: who is getting married, and when. Its whole job is to lock the date into people's heads early and set the tone, so guests immediately sense whether to expect something formal and grand, relaxed and beachy, or light and playful. Because it travels online, it should look good on a phone screen and make sense even when watched on mute, which is how most people will first see it.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'avp-save-the-date-video-guide'
   AND position($old$This is your announcement, dressed up. Often built from prenup footage or a short, fun shoot done just for the purpose, it is a brief and highly shareable clip — typically under a minute — that lands in your guests inboxes, group chats, and feeds carrying only the essentials: who is getting married, and when. Its whole job is to lock the date into people heads early and set the tone, so guests immediately sense whether to expect something formal and grand, relaxed and beachy, or light and playful. Because it travels online, it should look good on a phone screen and make sense even when watched on mute, which is how most people will first see it.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Plan both with intent. The save-the-date is marketing for your wedding; the AVP is storytelling at it. Give your supplier a clear brief for each, respect your guests attention with tight edits, and these two small films will do an outsized amount of work in setting the mood of your day.$old$, $new$Plan both with intent. The save-the-date is marketing for your wedding; the AVP is storytelling at it. Give your supplier a clear brief for each, respect your guests' attention with tight edits, and these two small films will do an outsized amount of work in setting the mood of your day.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'avp-save-the-date-video-guide'
   AND position($old$Plan both with intent. The save-the-date is marketing for your wedding; the AVP is storytelling at it. Give your supplier a clear brief for each, respect your guests attention with tight edits, and these two small films will do an outsized amount of work in setting the mood of your day.$old$ IN body) > 0;

-- ── ber-months-wedding-season-book-early ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Ask any Filipino wedding supplier and they will tell you the same thing without hesitation: once the ber-months arrive, the calendar fills fast. From September to December the whole country shifts into celebration mode, and weddings — especially the coveted December dates — get snapped up in a hurry. If you have your eye on this stretch of the year, the single most important word in your plan is "early". Here is why the rush happens like clockwork, and how to stay comfortably ahead of it instead of chasing whatever is left.$old$, $new$Ask any Filipino wedding supplier and they will tell you the same thing without hesitation: once the ber-months arrive, the calendar fills fast. From September to December the whole country shifts into party mode, and weddings — especially the coveted December dates — get snapped up in a hurry. If you have your eye on this stretch of the year, the single most important word in your plan is "early". Here is why the rush happens like clockwork, and how to stay comfortably ahead of it instead of chasing whatever is left.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'ber-months-wedding-season-book-early'
   AND position($old$Ask any Filipino wedding supplier and they will tell you the same thing without hesitation: once the ber-months arrive, the calendar fills fast. From September to December the whole country shifts into celebration mode, and weddings — especially the coveted December dates — get snapped up in a hurry. If you have your eye on this stretch of the year, the single most important word in your plan is "early". Here is why the rush happens like clockwork, and how to stay comfortably ahead of it instead of chasing whatever is left.$old$ IN body) > 0;

-- ── born-again-christian-wedding-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Outside the ceremony, planning looks much like any Filipino wedding: a venue, a caterer, photo and video, and a guest list. And as with every marriage in the country, the civil requirement — the marriage licence — still applies, so handle it early. If you are weighing a church ceremony against a purely civil one, our civil-versus-church explainer lays out the differences plainly, which can be a helpful conversation to have with your partner before you commit. Many born-again couples also build a simple programme that includes worship, so guests of every background can follow along and feel part of the celebration.$old$, $new$Outside the ceremony, planning looks much like any Filipino wedding: a venue, a caterer, photo and video, and a guest list. And as with every marriage in the country, the civil requirement — the marriage licence — still applies, so handle it early. If you are weighing a church ceremony against a purely civil one, our civil-versus-church explainer lays out the differences plainly, which can be a helpful conversation to have with your partner before you commit. Many born-again couples also build a simple programme that includes worship, so guests of every background can follow along and feel part of the day.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'born-again-christian-wedding-philippines'
   AND position($old$Outside the ceremony, planning looks much like any Filipino wedding: a venue, a caterer, photo and video, and a guest list. And as with every marriage in the country, the civil requirement — the marriage licence — still applies, so handle it early. If you are weighing a church ceremony against a purely civil one, our civil-versus-church explainer lays out the differences plainly, which can be a helpful conversation to have with your partner before you commit. Many born-again couples also build a simple programme that includes worship, so guests of every background can follow along and feel part of the celebration.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Weighing church versus civil? Here is a clear, side-by-side comparison.
setnayan.com/features$old$, $new$Weighing church versus civil? Here is a clear, side-by-side comparison.
setnayan.com/articles/civil-vs-church-wedding-philippines$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'born-again-christian-wedding-philippines'
   AND position($old$Weighing church versus civil? Here is a clear, side-by-side comparison.
setnayan.com/features$old$ IN body) > 0;

-- ── bridal-car-and-motorcade-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$The bridal car is really a small stage on wheels. It carries the bride to the ceremony and the newlyweds away from it, and in between it becomes the backdrop for some of the day's loveliest photographs — the quiet ride to the church when the nerves are real, the just-married drive afterward with the window rolled down, the confetti catching the light. In many Filipino weddings a motorcade then forms behind it: a convoy of family and guests, sometimes with ribboned cars and a friendly chorus of horns, escorting the couple between venues in a moving, public celebration that lets the whole neighbourhood in on the news. The meaning is simple, generous joy, spilled out onto the road for everyone to share — a wedding refusing to stay politely indoors.

“A motorcade turns the drive between venues into part of the celebration — joy, ribboned and rolling, for the whole street to see.”$old$, $new$The bridal car is really a small stage on wheels. It carries the bride to the ceremony and the newlyweds away from it, and in between it becomes the backdrop for some of the day's loveliest photographs — the quiet ride to the church when the nerves are real, the just-married drive afterward with the window rolled down, the confetti catching the light. In many Filipino weddings a motorcade then forms behind it: a convoy of family and guests, sometimes with ribboned cars and a friendly chorus of horns, escorting the couple between venues in a moving, public parade that lets the whole neighbourhood in on the news. The meaning is simple, generous joy, spilled out onto the road for everyone to share — a wedding refusing to stay politely indoors.

“A motorcade turns the drive between venues into part of the wedding — joy, ribboned and rolling, for the whole street to see.”$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'bridal-car-and-motorcade-wedding'
   AND position($old$The bridal car is really a small stage on wheels. It carries the bride to the ceremony and the newlyweds away from it, and in between it becomes the backdrop for some of the day's loveliest photographs — the quiet ride to the church when the nerves are real, the just-married drive afterward with the window rolled down, the confetti catching the light. In many Filipino weddings a motorcade then forms behind it: a convoy of family and guests, sometimes with ribboned cars and a friendly chorus of horns, escorting the couple between venues in a moving, public celebration that lets the whole neighbourhood in on the news. The meaning is simple, generous joy, spilled out onto the road for everyone to share — a wedding refusing to stay politely indoors.

“A motorcade turns the drive between venues into part of the celebration — joy, ribboned and rolling, for the whole street to see.”$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Find trusted Filipino suppliers — bridal cars, stylists, coordinators — by city and category.
setnayan.com/?browse=1$old$, $new$Find verified Filipino suppliers — bridal cars, stylists, coordinators — by city and category.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'bridal-car-and-motorcade-wedding'
   AND position($old$Find trusted Filipino suppliers — bridal cars, stylists, coordinators — by city and category.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── brownout-power-contingency-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$It rarely makes the worry list until very late in the planning, but in the Philippines a brownout can quietly undo a beautiful day in seconds. Storms in the wet months, grid strain during peak demand, and rural venues with shaky supply all raise the odds that the power blinks out at exactly the wrong moment. And so much of a modern wedding leans on electricity: the lights, the sound system, the band, the projector for your same-day edit, even the caterer's warming equipment. A little foresight keeps the celebration glowing even when the grid does not.$old$, $new$It rarely makes the worry list until very late in the planning, but in the Philippines a brownout can quietly undo a beautiful day in seconds. Storms in the wet months, grid strain during peak demand, and rural venues with shaky supply all raise the odds that the power blinks out at exactly the wrong moment. And so much of a modern wedding leans on electricity: the lights, the sound system, the band, the projector for your same-day edit, even the caterer's warming equipment. A little foresight keeps the reception glowing even when the grid does not.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'brownout-power-contingency-wedding'
   AND position($old$It rarely makes the worry list until very late in the planning, but in the Philippines a brownout can quietly undo a beautiful day in seconds. Storms in the wet months, grid strain during peak demand, and rural venues with shaky supply all raise the odds that the power blinks out at exactly the wrong moment. And so much of a modern wedding leans on electricity: the lights, the sound system, the band, the projector for your same-day edit, even the caterer's warming equipment. A little foresight keeps the celebration glowing even when the grid does not.$old$ IN body) > 0;

-- ── buffet-vs-plated-vs-family-style-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$The buffet is the most common reception format in the Philippines, and it earns its place. It usually offers the widest variety of dishes per peso, lets guests choose what and how much they eat, and tends to be the most budget-friendly of the three. It also suits the warmth of a Filipino celebration — people get up, move around, and bump into family between trips to the line. The trade-offs are real, though. Buffets need space for the stations and enough staff to keep them stocked, or the line crawls. With a large guest list and a single station, you can end up with a long queue and a cold first table; the fix is usually more stations or a second serving line, so ask your caterer how they handle a crowd your size.$old$, $new$The buffet is the most common reception format in the Philippines, and it earns its place. It usually offers the widest variety of dishes per peso, lets guests choose what and how much they eat, and tends to be the most budget-friendly of the three. It also suits the warmth of a Filipino reception — people get up, move around, and bump into family between trips to the line. The trade-offs are real, though. Buffets need space for the stations and enough staff to keep them stocked, or the line crawls. With a large guest list and a single station, you can end up with a long queue and a cold first table; the fix is usually more stations or a second serving line, so ask your caterer how they handle a crowd your size.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'buffet-vs-plated-vs-family-style-wedding'
   AND position($old$The buffet is the most common reception format in the Philippines, and it earns its place. It usually offers the widest variety of dishes per peso, lets guests choose what and how much they eat, and tends to be the most budget-friendly of the three. It also suits the warmth of a Filipino celebration — people get up, move around, and bump into family between trips to the line. The trade-offs are real, though. Buffets need space for the stations and enough staff to keep them stocked, or the line crawls. With a large guest list and a single station, you can end up with a long queue and a cold first table; the fix is usually more stations or a second serving line, so ask your caterer how they handle a crowd your size.$old$ IN body) > 0;

-- ── choosing-your-ceremony-by-faith-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A Muslim (nikah) wedding follows Islamic rites and, in parts of Mindanao, the Code of Muslim Personal Laws, with its own solemnising officers and customs. A civil wedding — officiated by a judge or mayor — is the simplest and fastest path, ideal for couples who want to be married now and celebrate later, or who prefer a small, private moment. And many Filipino couples are mixed-faith: the gentlest approach is usually to honour both, whether through one ceremony that blends traditions or two distinct celebrations. None of these is a lesser choice; each is simply a different shape for the same promise.$old$, $new$A Muslim (nikah) wedding follows Islamic rites and, in parts of Mindanao, the Code of Muslim Personal Laws, with its own solemnising officers and customs. A civil wedding — officiated by a judge or mayor — is the simplest and fastest path, ideal for couples who want to be married now and celebrate later, or who prefer a small, private moment. And many Filipino couples are mixed-faith: the gentlest approach is usually to honour both, whether through one ceremony that blends traditions or two distinct ceremonies. None of these is a lesser choice; each is simply a different shape for the same promise.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'choosing-your-ceremony-by-faith-philippines'
   AND position($old$A Muslim (nikah) wedding follows Islamic rites and, in parts of Mindanao, the Code of Muslim Personal Laws, with its own solemnising officers and customs. A civil wedding — officiated by a judge or mayor — is the simplest and fastest path, ideal for couples who want to be married now and celebrate later, or who prefer a small, private moment. And many Filipino couples are mixed-faith: the gentlest approach is usually to honour both, whether through one ceremony that blends traditions or two distinct celebrations. None of these is a lesser choice; each is simply a different shape for the same promise.$old$ IN body) > 0;

-- ── christmas-themed-wedding-ideas-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$If you are marrying in December, you do not have to fight the season — you can let it carry your whole celebration. A Christmas wedding in the Philippines has a head start most couples would pay for: the lights are already up, the mood is already warm, and everyone already feels a little more sentimental than usual. By December the country has been in the Christmas spirit for weeks, the cool amihan breeze has finally arrived, and your guests turn up already glowing with the holidays. The trick is to borrow the season gently, so your wedding feels festive and personal rather than like a department-store display. Choose a few touches you genuinely love and do them well; the season fills in the rest. Here are ideas that lean into the holidays the Filipino way.$old$, $new$If you are marrying in December, you do not have to fight the season — you can let it carry your whole wedding. A Christmas wedding in the Philippines has a head start most couples would pay for: the lights are already up, the mood is already warm, and everyone already feels a little more sentimental than usual. By December the country has been in the Christmas spirit for weeks, the cool amihan breeze has finally arrived, and your guests turn up already glowing with the holidays. The trick is to borrow the season gently, so your wedding feels festive and personal rather than like a department-store display. Choose a few touches you genuinely love and do them well; the season fills in the rest. Here are ideas that lean into the holidays the Filipino way.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'christmas-themed-wedding-ideas-philippines'
   AND position($old$If you are marrying in December, you do not have to fight the season — you can let it carry your whole celebration. A Christmas wedding in the Philippines has a head start most couples would pay for: the lights are already up, the mood is already warm, and everyone already feels a little more sentimental than usual. By December the country has been in the Christmas spirit for weeks, the cool amihan breeze has finally arrived, and your guests turn up already glowing with the holidays. The trick is to borrow the season gently, so your wedding feels festive and personal rather than like a department-store display. Choose a few touches you genuinely love and do them well; the season fills in the rest. Here are ideas that lean into the holidays the Filipino way.$old$ IN body) > 0;

-- ── civil-vs-church-wedding-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Every Filipino couple faces this early question: civil or church? Both result in a legally married couple — the difference is in the ceremony, the requirements, the timeline, and the feel of the day. Here is a clear comparison to help you decide, whether you want a quiet signing or a full liturgical celebration.$old$, $new$Every Filipino couple faces this early question: civil or church? Both result in a legally married couple — the difference is in the ceremony, the requirements, the timeline, and the feel of the day. Here is a clear comparison to help you decide, whether you want a quiet signing or a full church ceremony.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'civil-vs-church-wedding-philippines'
   AND position($old$Every Filipino couple faces this early question: civil or church? Both result in a legally married couple — the difference is in the ceremony, the requirements, the timeline, and the feel of the day. Here is a clear comparison to help you decide, whether you want a quiet signing or a full liturgical celebration.$old$ IN body) > 0;

-- ── cord-veil-coins-wedding-meaning ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Want the full cast — sponsors, bearers, ninong, and ninang — and what each one does? Read the entourage guide.
setnayan.com/features$old$, $new$Want the full cast — sponsors, bearers, ninong, and ninang — and what each one does? Read the entourage guide.
setnayan.com/articles/filipino-wedding-entourage-guide-ninong-ninang-sponsors$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'cord-veil-coins-wedding-meaning'
   AND position($old$Want the full cast — sponsors, bearers, ninong, and ninang — and what each one does? Read the entourage guide.
setnayan.com/features$old$ IN body) > 0;

-- ── despedida-de-soltera-explained ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$It is easy to mistake despedida de soltera for a bachelorette party, but the feel is genuinely different. Where a bachelorette is often a friends-led night out built around fun, the despedida is typically a family-centred dinner — warmer, more sentimental, and usually organised by the bride's parents or relatives rather than her barkada. The focus is gratitude and blessing: a chance to honour the bride, gather the family she grew up in, and mark the transition with grace rather than wild celebration. Some brides have both, on different nights, and there is nothing contradictory in that — one for the heart, one for the laughs.$old$, $new$It is easy to mistake despedida de soltera for a bachelorette party, but the feel is genuinely different. Where a bachelorette is often a friends-led night out built around fun, the despedida is typically a family-centred dinner — warmer, more sentimental, and usually organised by the bride's parents or relatives rather than her barkada. The focus is gratitude and blessing: a chance to honour the bride, gather the family she grew up in, and mark the transition with grace rather than a wild party. Some brides have both, on different nights, and there is nothing contradictory in that — one for the heart, one for the laughs.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'despedida-de-soltera-explained'
   AND position($old$It is easy to mistake despedida de soltera for a bachelorette party, but the feel is genuinely different. Where a bachelorette is often a friends-led night out built around fun, the despedida is typically a family-centred dinner — warmer, more sentimental, and usually organised by the bride's parents or relatives rather than her barkada. The focus is gratitude and blessing: a chance to honour the bride, gather the family she grew up in, and mark the transition with grace rather than wild celebration. Some brides have both, on different nights, and there is nothing contradictory in that — one for the heart, one for the laughs.$old$ IN body) > 0;

-- ── destination-wedding-philippines-guide ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$With more than seven thousand islands, the Philippines is one of the world’s great destination-wedding settings. A vow exchanged with Boracay’s white sand underfoot, Palawan’s lagoons behind you, Tagaytay’s ridge in the cool air, or a heritage church in Bohol — the country offers a backdrop for every kind of couple. A destination wedding takes more coordination than a hometown one, but with the right approach the logistics never overshadow the celebration. Here is how to plan one with a clear head and a generous heart.$old$, $new$With more than seven thousand islands, the Philippines is one of the world’s great destination-wedding settings. A vow exchanged with Boracay’s white sand underfoot, Palawan’s lagoons behind you, Tagaytay’s ridge in the cool air, or a heritage church in Bohol — the country offers a backdrop for every kind of couple. A destination wedding takes more coordination than a hometown one, but with the right approach the logistics never overshadow the wedding. Here is how to plan one with a clear head and a generous heart.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'destination-wedding-philippines-guide'
   AND position($old$With more than seven thousand islands, the Philippines is one of the world’s great destination-wedding settings. A vow exchanged with Boracay’s white sand underfoot, Palawan’s lagoons behind you, Tagaytay’s ridge in the cool air, or a heritage church in Bohol — the country offers a backdrop for every kind of couple. A destination wedding takes more coordination than a hometown one, but with the right approach the logistics never overshadow the celebration. Here is how to plan one with a clear head and a generous heart.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$“A destination wedding is really two events to plan — the celebration itself, and the journey that gets everyone there. Respect both.”$old$, $new$“A destination wedding is really two events to plan — the wedding itself, and the journey that gets everyone there. Respect both.”$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'destination-wedding-philippines-guide'
   AND position($old$“A destination wedding is really two events to plan — the celebration itself, and the journey that gets everyone there. Respect both.”$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Get a feel for supplier costs before you commit to an island.
setnayan.com/features$old$, $new$Get a feel for supplier costs before you commit to an island.
setnayan.com/articles/how-much-do-wedding-suppliers-cost-philippines$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'destination-wedding-philippines-guide'
   AND position($old$Get a feel for supplier costs before you commit to an island.
setnayan.com/features$old$ IN body) > 0;

-- ── digital-invitations-online-rsvp-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$The appeal goes well beyond saved postage. A digital invitation reaches every guest the instant you send it, updates itself when a detail changes, and — most valuable of all — gathers every reply into one tidy, living list instead of scattering them across a dozen chat threads. The guest taps "yes" or "no", and your headcount updates on its own, no manual tallying required.$old$, $new$The appeal goes well beyond saved postage. A digital invitation reaches every guest at one link, updates itself when a detail changes, and — most valuable of all — gathers every reply into one tidy, living list instead of scattering them across a dozen chat threads. The guest taps "yes" or "no", and your headcount updates on its own, no manual tallying required.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'digital-invitations-online-rsvp-wedding'
   AND position($old$The appeal goes well beyond saved postage. A digital invitation reaches every guest the instant you send it, updates itself when a detail changes, and — most valuable of all — gathers every reply into one tidy, living list instead of scattering them across a dozen chat threads. The guest taps "yes" or "no", and your headcount updates on its own, no manual tallying required.$old$ IN body) > 0;

-- ── engaged-over-christmas-first-steps ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A holiday engagement is one of the great Filipino joys — and it comes with a quiet undercurrent worth knowing about: thousands of other couples just said yes too, swept up in the same season of parols, reunions, and Noche Buena. As January arrives, the rush for dates, venues, and suppliers begins in earnest, and the best of them go fast. The reassuring part is that you do not need to plan the whole wedding this week, or even this month. You only need to take a handful of calm, early steps that protect your options while the celebration is still warm in the air — small moves now that spare you a scramble later. Here they are, in the order that keeps everything else simple.$old$, $new$A holiday engagement is one of the great Filipino joys — and it comes with a quiet undercurrent worth knowing about: thousands of other couples just said yes too, swept up in the same season of parols, reunions, and Noche Buena. As January arrives, the rush for dates, venues, and suppliers begins in earnest, and the best of them go fast. The reassuring part is that you do not need to plan the whole wedding this week, or even this month. You only need to take a handful of calm, early steps that protect your options while the joy is still warm in the air — small moves now that spare you a scramble later. Here they are, in the order that keeps everything else simple.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'engaged-over-christmas-first-steps'
   AND position($old$A holiday engagement is one of the great Filipino joys — and it comes with a quiet undercurrent worth knowing about: thousands of other couples just said yes too, swept up in the same season of parols, reunions, and Noche Buena. As January arrives, the rush for dates, venues, and suppliers begins in earnest, and the best of them go fast. The reassuring part is that you do not need to plan the whole wedding this week, or even this month. You only need to take a handful of calm, early steps that protect your options while the celebration is still warm in the air — small moves now that spare you a scramble later. Here they are, in the order that keeps everything else simple.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Before any spreadsheet or supplier search, simply savour it. Share the news with both families in the way that suits your culture — a visit, a call, a gathering over the holidays. In many Filipino families this is also where the real conversation about a celebration genuinely begins, so let the people who matter most share the moment first. Then, when you are ready, settle two figures: roughly how many guests, and roughly how much you can comfortably spend. Neither needs to be exact yet. A sensible range for each is more than enough to keep you from falling for a venue you cannot fill or a budget you cannot sustain, and almost everything downstream flows from those two numbers.$old$, $new$Before any spreadsheet or supplier search, simply savour it. Share the news with both families in the way that suits your culture — a visit, a call, a gathering over the holidays. In many Filipino families this is also where the real conversation about a wedding genuinely begins, so let the people who matter most share the moment first. Then, when you are ready, settle two figures: roughly how many guests, and roughly how much you can comfortably spend. Neither needs to be exact yet. A sensible range for each is more than enough to keep you from falling for a venue you cannot fill or a budget you cannot sustain, and almost everything downstream flows from those two numbers.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'engaged-over-christmas-first-steps'
   AND position($old$Before any spreadsheet or supplier search, simply savour it. Share the news with both families in the way that suits your culture — a visit, a call, a gathering over the holidays. In many Filipino families this is also where the real conversation about a celebration genuinely begins, so let the people who matter most share the moment first. Then, when you are ready, settle two figures: roughly how many guests, and roughly how much you can comfortably spend. Neither needs to be exact yet. A sensible range for each is more than enough to keep you from falling for a venue you cannot fill or a budget you cannot sustain, and almost everything downstream flows from those two numbers.$old$ IN body) > 0;

-- ── filipino-wedding-entourage-guide-ninong-ninang-sponsors ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Setnayan's guest list includes more than 30 Filipino ceremony roles — sponsors, bearers, ninong, ninang, and more — so everyone is placed and counted.
setnayan.com/signup$old$, $new$Setnayan's guest list knows the Filipino entourage — sponsors, bearers, ninong and ninang — so everyone is placed and counted.
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'filipino-wedding-entourage-guide-ninong-ninang-sponsors'
   AND position($old$Setnayan's guest list includes more than 30 Filipino ceremony roles — sponsors, bearers, ninong, ninang, and more — so everyone is placed and counted.
setnayan.com/signup$old$ IN body) > 0;

-- ── filipino-wedding-gift-etiquette-cash ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A Filipino wedding is also the start of a household, and many couples are genuinely helped by money toward the honeymoon, the first home, or even the wedding's own remaining costs. Cash lets the couple direct the help exactly where they need it most, with no risk of a duplicate appliance or a vase that never gets used. It is given discreetly — usually in an envelope, often handed to a designated family member or dropped into a gift box near the entrance — and it is no less heartfelt than a wrapped present chosen with care. The money dance, where guests pin bills to the dancing couple, is simply this same generous instinct turned into a celebration.$old$, $new$A Filipino wedding is also the start of a household, and many couples are genuinely helped by money toward the honeymoon, the first home, or even the wedding's own remaining costs. Cash lets the couple direct the help exactly where they need it most, with no risk of a duplicate appliance or a vase that never gets used. It is given discreetly — usually in an envelope, often handed to a designated family member or dropped into a gift box near the entrance — and it is no less heartfelt than a wrapped present chosen with care. The money dance, where guests pin bills to the dancing couple, is simply this same generous instinct turned into a joyful ritual.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'filipino-wedding-gift-etiquette-cash'
   AND position($old$A Filipino wedding is also the start of a household, and many couples are genuinely helped by money toward the honeymoon, the first home, or even the wedding's own remaining costs. Cash lets the couple direct the help exactly where they need it most, with no risk of a duplicate appliance or a vase that never gets used. It is given discreetly — usually in an envelope, often handed to a designated family member or dropped into a gift box near the entrance — and it is no less heartfelt than a wrapped present chosen with care. The money dance, where guests pin bills to the dancing couple, is simply this same generous instinct turned into a celebration.$old$ IN body) > 0;

-- ── filipino-wedding-superstitions-pamahiin ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Curious about the rites and reception customs too? Read our overview of Filipino wedding traditions.
setnayan.com/features$old$, $new$Curious about the rites and reception customs too? Read our overview of Filipino wedding traditions.
setnayan.com/articles/filipino-wedding-traditions-explained$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'filipino-wedding-superstitions-pamahiin'
   AND position($old$Curious about the rites and reception customs too? Read our overview of Filipino wedding traditions.
setnayan.com/features$old$ IN body) > 0;

-- ── food-carts-late-night-snacks-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A reception has a natural lull after the main meal. A food cart fills it with energy and a reason to get up. It also signals abundance and care — the sense that the celebration is not over yet. Practically, carts are interactive: guests choose, watch, and chat while their order is made, which keeps the floor lively when the formal program ends.$old$, $new$A reception has a natural lull after the main meal. A food cart fills it with energy and a reason to get up. It also signals abundance and care — the sense that the party is not over yet. Practically, carts are interactive: guests choose, watch, and chat while their order is made, which keeps the floor lively when the formal program ends.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'food-carts-late-night-snacks-wedding'
   AND position($old$A reception has a natural lull after the main meal. A food cart fills it with energy and a reason to get up. It also signals abundance and care — the sense that the celebration is not over yet. Practically, carts are interactive: guests choose, watch, and chat while their order is made, which keeps the floor lively when the formal program ends.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$• Ice cream or sorbetes — the dirty-ice-cream cart is pure nostalgia and works for every age, especially in warm weather.
• Cotton candy, popcorn, or churros — playful, photogenic, and a hit with younger guests and the entourage kids.
• Lechon, isaw, or grilled-skewer stations — hearty late-night savoury bites for a hungrier, livelier crowd.
• Coffee, milk tea, or fresh-buko carts — perfect for an afternoon wedding or a long evening that needs a second wind.
• Taho, fishball, or kwek-kwek — street-food carts that lean into a fun, unpretentious celebration.$old$, $new$• Ice cream or sorbetes — the dirty-ice-cream cart is pure nostalgia and works for every age, especially in warm weather.
• Cotton candy, popcorn, or churros — playful, photogenic, and a hit with younger guests and the entourage kids.
• Lechon, isaw, or grilled-skewer stations — hearty late-night savoury bites for a hungrier, livelier crowd.
• Coffee, milk tea, or fresh-buko carts — perfect for an afternoon wedding or a long evening that needs a second wind.
• Taho, fishball, or kwek-kwek — street-food carts that lean into a fun, unpretentious reception.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'food-carts-late-night-snacks-wedding'
   AND position($old$• Ice cream or sorbetes — the dirty-ice-cream cart is pure nostalgia and works for every age, especially in warm weather.
• Cotton candy, popcorn, or churros — playful, photogenic, and a hit with younger guests and the entourage kids.
• Lechon, isaw, or grilled-skewer stations — hearty late-night savoury bites for a hungrier, livelier crowd.
• Coffee, milk tea, or fresh-buko carts — perfect for an afternoon wedding or a long evening that needs a second wind.
• Taho, fishball, or kwek-kwek — street-food carts that lean into a fun, unpretentious celebration.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Browse food-cart and snack suppliers, compare packages, and book with zero commission.
setnayan.com/?browse=1$old$, $new$Browse food-cart and snack suppliers, and compare packages side by side.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'food-carts-late-night-snacks-wedding'
   AND position($old$Browse food-cart and snack suppliers, compare packages, and book with zero commission.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── free-event-hub-how-it-helps ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$• Guests RSVP online, and your headcount updates automatically.
• All your wedding details live at one link you can share anywhere.
• Update something once and every guest sees the change instantly.
• A reliable final count means cleaner numbers for catering and seating.$old$, $new$• Guests RSVP online, and your headcount updates automatically.
• All your wedding details live at one link you can share anywhere.
• Update something once and every guest sees the change.
• A reliable final count means cleaner numbers for catering and seating.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'free-event-hub-how-it-helps'
   AND position($old$• Guests RSVP online, and your headcount updates automatically.
• All your wedding details live at one link you can share anywhere.
• Update something once and every guest sees the change instantly.
• A reliable final count means cleaner numbers for catering and seating.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$A good Event Hub meets your guests where they are. The tech-comfortable cousin RSVPs in seconds on their phone; the relative who is less online still gets a simple page they can read without an account or an app. Because the Event Hub and its RSVP are free and built in, there is no reason to skip it. You get a real, working Event Hub and a real RSVP system as the default; Event Pro adds optional extras on top, and you never need it to collect RSVPs. And because it lives next to the rest of your planning, the headcount it gathers is the same number your guest list, your budget, and your seating chart all draw from — no copying figures between apps, no version that is quietly out of date.$old$, $new$A good Event Hub meets your guests where they are. The tech-comfortable cousin RSVPs on their phone; the relative who is less online still gets a simple page they can read without an account or an app. Because the Event Hub and its RSVP are free and built in, there is no reason to skip it. You get a real, working Event Hub and a real RSVP system as the default. Paid plans add optional extras on top; RSVPs are free. And because it lives next to the rest of your planning, the headcount it gathers is the same number your guest list, your budget, and your seating chart all draw from — no copying figures between apps, no version that is quietly out of date.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'free-event-hub-how-it-helps'
   AND position($old$A good Event Hub meets your guests where they are. The tech-comfortable cousin RSVPs in seconds on their phone; the relative who is less online still gets a simple page they can read without an account or an app. Because the Event Hub and its RSVP are free and built in, there is no reason to skip it. You get a real, working Event Hub and a real RSVP system as the default; Event Pro adds optional extras on top, and you never need it to collect RSVPs. And because it lives next to the rest of your planning, the headcount it gathers is the same number your guest list, your budget, and your seating chart all draw from — no copying figures between apps, no version that is quietly out of date.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Create your free Event Hub and turn on RSVPs in minutes.
setnayan.com/signup$old$, $new$Create your free Event Hub and turn on RSVPs.
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'free-event-hub-how-it-helps'
   AND position($old$Create your free Event Hub and turn on RSVPs in minutes.
setnayan.com/signup$old$ IN body) > 0;

-- ── garden-vs-ballroom-vs-beach-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A hotel or events-place ballroom is the most controlled, predictable choice. The air-conditioning is reliable, the rain is irrelevant, and the in-house team often handles catering, tables and coordination as a package, which takes a real load off the couple. It suits larger guest counts and formal celebrations. The trade-off is that you are working within a fixed space and house rules, sometimes with a required in-house caterer, and a fully styled ballroom can carry a higher all-in cost than its sticker price suggests.$old$, $new$A hotel or events-place ballroom is the most controlled, predictable choice. The air-conditioning is reliable, the rain is irrelevant, and the in-house team often handles catering, tables and coordination as a package, which takes a real load off the couple. It suits larger guest counts and formal weddings. The trade-off is that you are working within a fixed space and house rules, sometimes with a required in-house caterer, and a fully styled ballroom can carry a higher all-in cost than its sticker price suggests.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'garden-vs-ballroom-vs-beach-wedding'
   AND position($old$A hotel or events-place ballroom is the most controlled, predictable choice. The air-conditioning is reliable, the rain is irrelevant, and the in-house team often handles catering, tables and coordination as a package, which takes a real load off the couple. It suits larger guest counts and formal celebrations. The trade-off is that you are working within a fixed space and house rules, sometimes with a required in-house caterer, and a fully styled ballroom can carry a higher all-in cost than its sticker price suggests.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Weigh four things together: your guest count, your season and weather risk, your budget, and the feeling you want. A large formal wedding in the rainy months leans ballroom; an intimate, natural celebration in fair weather suits a garden; a couple chasing a sunset-and-sand dream — and willing to manage the logistics — heads to the beach. Once you have settled the type, choosing the actual venue gets far easier, because you are comparing like with like. Our venue-selection guide walks through the exact questions to ask each one before you sign. And whatever type you land on, a free planning workspace helps you compare venues and suppliers side by side at 0% commission — you deal with suppliers directly — so you can see the real trade-offs before you commit. Visit a shortlist in person if you can, at the time of day your wedding will happen, and you will know very quickly which kind of venue feels like yours.

Compare real venues and suppliers side by side, commission-free.
setnayan.com/?browse=1$old$, $new$Weigh four things together: your guest count, your season and weather risk, your budget, and the feeling you want. A large formal wedding in the rainy months leans ballroom; an intimate, natural wedding in fair weather suits a garden; a couple chasing a sunset-and-sand dream — and willing to manage the logistics — heads to the beach. Once you have settled the type, choosing the actual venue gets far easier, because you are comparing like with like. Our venue-selection guide walks through the exact questions to ask each one before you sign. And whatever type you land on, a free planning workspace helps you compare venues and suppliers side by side. Hosts pay 0% commission. You deal with suppliers directly, so you can see the real trade-offs before you commit. Visit a shortlist in person if you can, at the time of day your wedding will happen, and you will know very quickly which kind of venue feels like yours.

Compare real venues and suppliers side by side.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'garden-vs-ballroom-vs-beach-wedding'
   AND position($old$Weigh four things together: your guest count, your season and weather risk, your budget, and the feeling you want. A large formal wedding in the rainy months leans ballroom; an intimate, natural celebration in fair weather suits a garden; a couple chasing a sunset-and-sand dream — and willing to manage the logistics — heads to the beach. Once you have settled the type, choosing the actual venue gets far easier, because you are comparing like with like. Our venue-selection guide walks through the exact questions to ask each one before you sign. And whatever type you land on, a free planning workspace helps you compare venues and suppliers side by side at 0% commission — you deal with suppliers directly — so you can see the real trade-offs before you commit. Visit a shortlist in person if you can, at the time of day your wedding will happen, and you will know very quickly which kind of venue feels like yours.

Compare real venues and suppliers side by side, commission-free.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── holiday-proposal-ideas-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$So enjoy the proposal fully and let the to-do list wait. Whenever you do decide you are both ready to begin, a free planning workspace is there the moment you want it — so the celebration of the engagement can come first, exactly as it should, and the planning can start on your own gentle timeline rather than the season's. Whatever shape your proposal takes — a roomful of relatives or a quiet two of you under the parol — let it sound like the two of you and no one else. The holidays only set the stage; the moment itself is entirely yours to write.$old$, $new$So enjoy the proposal fully and let the to-do list wait. Whenever you do decide you are both ready to begin, a free planning workspace is there the moment you want it — so celebrating the engagement can come first, exactly as it should, and the planning can start on your own gentle timeline rather than the season's. Whatever shape your proposal takes — a roomful of relatives or a quiet two of you under the parol — let it sound like the two of you and no one else. The holidays only set the stage; the moment itself is entirely yours to write.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'holiday-proposal-ideas-philippines'
   AND position($old$So enjoy the proposal fully and let the to-do list wait. Whenever you do decide you are both ready to begin, a free planning workspace is there the moment you want it — so the celebration of the engagement can come first, exactly as it should, and the planning can start on your own gentle timeline rather than the season's. Whatever shape your proposal takes — a roomful of relatives or a quiet two of you under the parol — let it sound like the two of you and no one else. The holidays only set the stage; the moment itself is entirely yours to write.$old$ IN body) > 0;

-- ── how-much-do-wedding-suppliers-cost-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$There is no single answer to "how much does a wedding supplier cost" in the Philippines — rates swing widely by city, season, experience, and how much of the work is included. The ranges below are realistic 2026 starting points to help you build a first budget. Treat them as a compass, not a quote: always ask each supplier for an inclusions list in writing, because the same headline price can mean very different things.$old$, $new$There is no single answer to "how much does a wedding supplier cost" in the Philippines — rates swing widely by city, season, experience, and how much of the work is included. Treat any quote as a compass, not a final price: always ask each supplier for an inclusions list in writing, because the same headline price can mean very different things.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-much-do-wedding-suppliers-cost-philippines'
   AND position($old$There is no single answer to "how much does a wedding supplier cost" in the Philippines — rates swing widely by city, season, experience, and how much of the work is included. The ranges below are realistic 2026 starting points to help you build a first budget. Treat them as a compass, not a quote: always ask each supplier for an inclusions list in writing, because the same headline price can mean very different things.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Typical starting ranges (2026)$old$, $new$Price by category$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-much-do-wedding-suppliers-cost-philippines'
   AND position($old$Typical starting ranges (2026)$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$When you are ready to shortlist, browsing verified suppliers side by side — with the styles and cities they actually serve — makes the ranges above concrete for your specific date and place.$old$, $new$When you are ready to shortlist, browsing verified suppliers side by side — with the styles and cities they actually serve — makes the prices concrete for your specific date and place.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-much-do-wedding-suppliers-cost-philippines'
   AND position($old$When you are ready to shortlist, browsing verified suppliers side by side — with the styles and cities they actually serve — makes the ranges above concrete for your specific date and place.$old$ IN body) > 0;

-- ── how-to-ask-someone-to-be-ninong-ninang ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Curious what each sponsor and bearer actually does on the day? Our full entourage guide breaks it all down.
setnayan.com/features$old$, $new$Curious what each sponsor and bearer actually does on the day? Our full entourage guide breaks it all down.
setnayan.com/articles/filipino-wedding-entourage-guide-ninong-ninang-sponsors$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-ask-someone-to-be-ninong-ninang'
   AND position($old$Curious what each sponsor and bearer actually does on the day? Our full entourage guide breaks it all down.
setnayan.com/features$old$ IN body) > 0;

-- ── how-to-budget-a-philippine-wedding-step-by-step ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A budget is only real if you can see it. From the day you pay your first deposit, record every payment against your total so the number on the screen always matches the money in the bank. This is also where booking through a marketplace that takes zero commission on supplier bookings quietly protects you: the price you agree with a supplier is the price you pay, with no hidden platform cut eating into the total you worked so carefully to set. When something has to give later, you trim from the areas you already agreed matter least — calmly, not in a panic three months out.$old$, $new$A budget is only real if you can see it. From the day you pay your first deposit, record every payment against your total so the number on the screen always matches the money in the bank. This is also where one plain rule protects you. Hosts pay 0% commission. The price you agree with a supplier is the price you pay them. When something has to give later, you trim from the areas you already agreed matter least — calmly, not in a panic three months out.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-budget-a-philippine-wedding-step-by-step'
   AND position($old$A budget is only real if you can see it. From the day you pay your first deposit, record every payment against your total so the number on the screen always matches the money in the bank. This is also where booking through a marketplace that takes zero commission on supplier bookings quietly protects you: the price you agree with a supplier is the price you pay, with no hidden platform cut eating into the total you worked so carefully to set. When something has to give later, you trim from the areas you already agreed matter least — calmly, not in a panic three months out.$old$ IN body) > 0;

-- ── how-to-choose-a-wedding-caterer-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Compare caterers side by side, by city and budget, with zero commission on anything you book.
setnayan.com/?browse=1$old$, $new$Compare caterers side by side, by city and budget.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-choose-a-wedding-caterer-philippines'
   AND position($old$Compare caterers side by side, by city and budget, with zero commission on anything you book.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── how-to-choose-a-wedding-photographer-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Compare real portfolios, inclusions, and availability in one place, with no commission added to what you pay your supplier.
setnayan.com/?browse=1$old$, $new$Compare real portfolios, inclusions, and availability in one place.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-choose-a-wedding-photographer-philippines'
   AND position($old$Compare real portfolios, inclusions, and availability in one place, with no commission added to what you pay your supplier.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── how-to-choose-a-wedding-venue-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Browse 100+ real Philippine wedding venues by city, with capacity and day-rate details.
setnayan.com/?browse=1$old$, $new$Browse Philippine wedding venues by city.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-choose-a-wedding-venue-philippines'
   AND position($old$Browse 100+ real Philippine wedding venues by city, with capacity and day-rate details.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── how-to-save-money-on-your-wedding-philippines ──
UPDATE public.creator_chapters
   SET title = $new$23 honest ways to save money on a Filipino wedding$new$, updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-save-money-on-your-wedding-philippines'
   AND title = $old$30 honest ways to save money on a Filipino wedding$old$;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Saving money on a wedding sounds like a compromise, and the worry underneath it is real: "Will it look cheap? Will people notice?" The truth is that the smartest savings are invisible. Guests remember warmth, good food, and a day that flowed — not the line items you trimmed to get there. Here are thirty honest ways to spend less, grouped so you can pick the ones that fit your wedding.$old$, $new$Saving money on a wedding sounds like a compromise, and the worry underneath it is real: "Will it look cheap? Will people notice?" The truth is that the smartest savings are invisible. Guests remember warmth, good food, and a day that flowed — not the line items you trimmed to get there. Here are twenty-three honest ways to spend less, grouped so you can pick the ones that fit your wedding.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-save-money-on-your-wedding-philippines'
   AND position($old$Saving money on a wedding sounds like a compromise, and the worry underneath it is real: "Will it look cheap? Will people notice?" The truth is that the smartest savings are invisible. Guests remember warmth, good food, and a day that flowed — not the line items you trimmed to get there. Here are thirty honest ways to spend less, grouped so you can pick the ones that fit your wedding.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$• Send digital invitations and a free Event Hub instead of printing for every guest.
• Print only a few keepsake invitations for sponsors and close family.
• Make favours edible or useful — homemade treats beat trinkets that get left behind.
• Build your own playlist for cocktails and dinner; save the live band for the key moments.
• Borrow décor, signage, and props from recently married friends, and DIY the genuinely simple touches.
• Buy your own alcohol where the venue allows, and limit the bar to beer, wine, and one signature drink.
• Set your total first, track every deposit, and keep a 10–15% buffer so nothing forces a panic purchase.
• Book through a marketplace that charges 0% commission, so the price you agree is the price you pay.
• Negotiate gently and always in writing, avoid debt, and put any savings toward the honeymoon — not new add-ons.

You will not use all thirty — no one does. Pick the handful that suit your wedding, and the savings stack up without a single guest ever feeling the difference. The most powerful ones are at the top of this list: the guest count and the date move more money than every small swap combined, so start there before you fuss over favours. And remember that the goal is never the cheapest wedding — it is the wedding that fits your life, paid for without stress. A saving you make on a detail no one will notice is a saving you can pour into the food everyone will remember, the photos you will keep forever, or simply the peace of starting married life with money still in the bank.

Track every choice and every peso saved in one free budget — with 0% commission on every booking.
setnayan.com/signup$old$, $new$• Send digital invitations and a free Event Hub instead of printing for every guest.
• Print only a few keepsake invitations for sponsors and close family.
• Make favours edible or useful — homemade treats beat trinkets that get left behind.
• Build your own playlist for cocktails and dinner; save the live band for the key moments.
• Borrow décor, signage, and props from recently married friends, and DIY the genuinely simple touches.
• Buy your own alcohol where the venue allows, and limit the bar to beer, wine, and one signature drink.
• Set your total first, track every deposit, and keep a 10–15% buffer so nothing forces a panic purchase.
• Hosts pay 0% commission. The price you agree is the price you pay.
• Negotiate gently and always in writing, avoid debt, and put any savings toward the honeymoon — not new add-ons.

You will not use all twenty-three — no one does. Pick the handful that suit your wedding, and the savings stack up without a single guest ever feeling the difference. The most powerful ones are at the top of this list: the guest count and the date move more money than every small swap combined, so start there before you fuss over favours. And remember that the goal is never the cheapest wedding — it is the wedding that fits your life, paid for without stress. A saving you make on a detail no one will notice is a saving you can pour into the food everyone will remember, the photos you will keep forever, or simply the peace of starting married life with money still in the bank.

Track every choice and every peso saved in one free budget. Hosts pay 0% commission.
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-save-money-on-your-wedding-philippines'
   AND position($old$• Send digital invitations and a free Event Hub instead of printing for every guest.
• Print only a few keepsake invitations for sponsors and close family.
• Make favours edible or useful — homemade treats beat trinkets that get left behind.
• Build your own playlist for cocktails and dinner; save the live band for the key moments.
• Borrow décor, signage, and props from recently married friends, and DIY the genuinely simple touches.
• Buy your own alcohol where the venue allows, and limit the bar to beer, wine, and one signature drink.
• Set your total first, track every deposit, and keep a 10–15% buffer so nothing forces a panic purchase.
• Book through a marketplace that charges 0% commission, so the price you agree is the price you pay.
• Negotiate gently and always in writing, avoid debt, and put any savings toward the honeymoon — not new add-ons.

You will not use all thirty — no one does. Pick the handful that suit your wedding, and the savings stack up without a single guest ever feeling the difference. The most powerful ones are at the top of this list: the guest count and the date move more money than every small swap combined, so start there before you fuss over favours. And remember that the goal is never the cheapest wedding — it is the wedding that fits your life, paid for without stress. A saving you make on a detail no one will notice is a saving you can pour into the food everyone will remember, the photos you will keep forever, or simply the peace of starting married life with money still in the bank.

Track every choice and every peso saved in one free budget — with 0% commission on every booking.
setnayan.com/signup$old$ IN body) > 0;

-- ── how-to-set-a-wedding-budget-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A budget is also a values exercise. Before you book anything, agree on the two or three things that matter most — perhaps the food, the photos, or a venue you have always dreamed of — and protect their share of the total. Everything else can flex. When something has to give, you trim from the areas you already agreed are less important, rather than arguing about it in a stressful week three months out. This single conversation prevents most of the money tension couples feel, because every later choice is measured against a decision you already made together, calmly, at the start. And when you book through a marketplace that takes zero commission on supplier bookings, the price you agree with a supplier is the price you pay — no hidden platform cut quietly eating into the total you worked so hard to set.$old$, $new$A budget is also a values exercise. Before you book anything, agree on the two or three things that matter most — perhaps the food, the photos, or a venue you have always dreamed of — and protect their share of the total. Everything else can flex. When something has to give, you trim from the areas you already agreed are less important, rather than arguing about it in a stressful week three months out. This single conversation prevents most of the money tension couples feel, because every later choice is measured against a decision you already made together, calmly, at the start. Hosts pay 0% commission. The price you agree with a supplier is the price you pay.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-set-a-wedding-budget-philippines'
   AND position($old$A budget is also a values exercise. Before you book anything, agree on the two or three things that matter most — perhaps the food, the photos, or a venue you have always dreamed of — and protect their share of the total. Everything else can flex. When something has to give, you trim from the areas you already agreed are less important, rather than arguing about it in a stressful week three months out. This single conversation prevents most of the money tension couples feel, because every later choice is measured against a decision you already made together, calmly, at the start. And when you book through a marketplace that takes zero commission on supplier bookings, the price you agree with a supplier is the price you pay — no hidden platform cut quietly eating into the total you worked so hard to set.$old$ IN body) > 0;

-- ── how-to-trim-your-wedding-guest-list ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Some shortcuts cause more hurt than they save. Do not invite someone to the church but pointedly leave them off the reception, unless your families clearly understand these as two separate gatherings — otherwise it reads as a deliberate slight. Do not announce on social media that the wedding is "intimate" and then be seen inviting half the office. And above all, never promise an invitation you are not certain you can keep. An un-invite stings far more than a never-invite ever could. Trimming is uncomfortable, but a wedding you can genuinely afford and enjoy is worth a few awkward conversations. The people who love you will understand a smaller celebration; the ones who would hold it against you were almost certainly tier three to begin with.$old$, $new$Some shortcuts cause more hurt than they save. Do not invite someone to the church but pointedly leave them off the reception, unless your families clearly understand these as two separate gatherings — otherwise it reads as a deliberate slight. Do not announce on social media that the wedding is "intimate" and then be seen inviting half the office. And above all, never promise an invitation you are not certain you can keep. An un-invite stings far more than a never-invite ever could. Trimming is uncomfortable, but a wedding you can genuinely afford and enjoy is worth a few awkward conversations. The people who love you will understand a smaller wedding; the ones who would hold it against you were almost certainly tier three to begin with.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'how-to-trim-your-wedding-guest-list'
   AND position($old$Some shortcuts cause more hurt than they save. Do not invite someone to the church but pointedly leave them off the reception, unless your families clearly understand these as two separate gatherings — otherwise it reads as a deliberate slight. Do not announce on social media that the wedding is "intimate" and then be seen inviting half the office. And above all, never promise an invitation you are not certain you can keep. An un-invite stings far more than a never-invite ever could. Trimming is uncomfortable, but a wedding you can genuinely afford and enjoy is worth a few awkward conversations. The people who love you will understand a smaller celebration; the ones who would hold it against you were almost certainly tier three to begin with.$old$ IN body) > 0;

-- ── iglesia-ni-cristo-wedding-overview ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Unlike a venue you book on the open market, the ceremony takes place in the Iglesia ni Cristo chapel and is led by a minister of the church. The form, the words and the conduct of the wedding follow the church’s established practice. Couples who are members are guided through the process directly by their local congregation, and that guidance — not any outside source, and certainly not a wedding blog — is the authority on what is required and how the day unfolds. The respectful thing to do is to let the church lead and to plan everything else around it.$old$, $new$Unlike a venue you book on the open market, the ceremony takes place in the Iglesia ni Cristo chapel and is led by a minister of the church. The form, the words and the conduct of the wedding follow the church’s established practice. Couples who are members are guided through the process directly by their local congregation, and that guidance — not any outside source, and certainly not an article online — is the authority on what is required and how the day unfolds. The respectful thing to do is to let the church lead and to plan everything else around it.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'iglesia-ni-cristo-wedding-overview'
   AND position($old$Unlike a venue you book on the open market, the ceremony takes place in the Iglesia ni Cristo chapel and is led by a minister of the church. The form, the words and the conduct of the wedding follow the church’s established practice. Couples who are members are guided through the process directly by their local congregation, and that guidance — not any outside source, and certainly not a wedding blog — is the authority on what is required and how the day unfolds. The respectful thing to do is to let the church lead and to plan everything else around it.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Because the ceremony itself is arranged within the church, a couple’s outside planning energy goes mostly into the reception and the surrounding logistics, plus the civil legal requirements that apply to every Philippine marriage. The reception — the venue, the caterer, the photographer, the guest list — is yours to plan in the usual way, and it is where most of your supplier decisions will be made. Treat it as you would any celebration: set a budget, build a guest list, and choose suppliers you trust.

• The ceremony and its requirements are set by your congregation — speak with your minister early.
• Plan the reception, suppliers and guest list as you would for any celebration.
• The civil legal requirements (the marriage licence) still apply — see our guide to those.
• Confirm anything you are unsure of directly with the church, not from outside sources.$old$, $new$Because the ceremony itself is arranged within the church, a couple’s outside planning energy goes mostly into the reception and the surrounding logistics, plus the civil legal requirements that apply to every Philippine marriage. The reception — the venue, the caterer, the photographer, the guest list — is yours to plan in the usual way, and it is where most of your supplier decisions will be made. Treat it as you would any event: set a budget, build a guest list, and choose suppliers you trust.

• The ceremony and its requirements are set by your congregation — speak with your minister early.
• Plan the reception, suppliers and guest list as you would for any event.
• The civil legal requirements (the marriage licence) still apply — see our guide to those.
• Confirm anything you are unsure of directly with the church, not from outside sources.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'iglesia-ni-cristo-wedding-overview'
   AND position($old$Because the ceremony itself is arranged within the church, a couple’s outside planning energy goes mostly into the reception and the surrounding logistics, plus the civil legal requirements that apply to every Philippine marriage. The reception — the venue, the caterer, the photographer, the guest list — is yours to plan in the usual way, and it is where most of your supplier decisions will be made. Treat it as you would any celebration: set a budget, build a guest list, and choose suppliers you trust.

• The ceremony and its requirements are set by your congregation — speak with your minister early.
• Plan the reception, suppliers and guest list as you would for any celebration.
• The civil legal requirements (the marriage licence) still apply — see our guide to those.
• Confirm anything you are unsure of directly with the church, not from outside sources.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Handle the civil paperwork on time — here is exactly what a marriage licence requires.
setnayan.com/features$old$, $new$Handle the civil paperwork on time — here is exactly what a marriage licence requires.
setnayan.com/articles/marriage-license-requirements-philippines$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'iglesia-ni-cristo-wedding-overview'
   AND position($old$Handle the civil paperwork on time — here is exactly what a marriage licence requires.
setnayan.com/features$old$ IN body) > 0;

-- ── ilocano-wedding-traditions ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Ilocano weddings carry the temperament of the North: practical, deeply rooted in family, and quietly generous. The region is known for valuing thrift and hard work, and you can feel it in how a wedding is planned — every peso considered, every relative involved, nothing wasted. But do not mistake thrift for restraint. An Ilocano celebration is full of heart, and the customs around it have endured for generations. Here is a respectful overview; as always, the exact practices vary by family and town, so let your elders guide the details that matter most to you.$old$, $new$Ilocano weddings carry the temperament of the North: practical, deeply rooted in family, and quietly generous. The region is known for valuing thrift and hard work, and you can feel it in how a wedding is planned — every peso considered, every relative involved, nothing wasted. But do not mistake thrift for restraint. An Ilocano wedding is full of heart, and the customs around it have endured for generations. Here is a respectful overview; as always, the exact practices vary by family and town, so let your elders guide the details that matter most to you.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'ilocano-wedding-traditions'
   AND position($old$Ilocano weddings carry the temperament of the North: practical, deeply rooted in family, and quietly generous. The region is known for valuing thrift and hard work, and you can feel it in how a wedding is planned — every peso considered, every relative involved, nothing wasted. But do not mistake thrift for restraint. An Ilocano celebration is full of heart, and the customs around it have endured for generations. Here is a respectful overview; as always, the exact practices vary by family and town, so let your elders guide the details that matter most to you.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$As across much of the Philippines, the two families meet formally before the wedding to ask for the bride’s hand and agree on the plans. In Ilocano households this gathering is taken seriously: it is where responsibilities are divided, the date is set, and the sponsors are named. Respect for elders runs through everything, and their counsel often shapes the biggest decisions — from the choice of date to the size of the celebration. A couple who brings the elders along early tends to have a much smoother road to the altar. There is a quiet practicality at work too: by settling money and roles around a table, with food shared and elders present, an Ilocano family avoids the awkward late conversations that strain so many weddings. What looks like ceremony is also good planning — the kind that keeps a celebration affordable and a family at peace.$old$, $new$As across much of the Philippines, the two families meet formally before the wedding to ask for the bride’s hand and agree on the plans. In Ilocano households this gathering is taken seriously: it is where responsibilities are divided, the date is set, and the sponsors are named. Respect for elders runs through everything, and their counsel often shapes the biggest decisions — from the choice of date to the size of the wedding. A couple who brings the elders along early tends to have a much smoother road to the altar. There is a quiet practicality at work too: by settling money and roles around a table, with food shared and elders present, an Ilocano family avoids the awkward late conversations that strain so many weddings. What looks like ceremony is also good planning — the kind that keeps a wedding affordable and a family at peace.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'ilocano-wedding-traditions'
   AND position($old$As across much of the Philippines, the two families meet formally before the wedding to ask for the bride’s hand and agree on the plans. In Ilocano households this gathering is taken seriously: it is where responsibilities are divided, the date is set, and the sponsors are named. Respect for elders runs through everything, and their counsel often shapes the biggest decisions — from the choice of date to the size of the celebration. A couple who brings the elders along early tends to have a much smoother road to the altar. There is a quiet practicality at work too: by settling money and roles around a table, with food shared and elders present, an Ilocano family avoids the awkward late conversations that strain so many weddings. What looks like ceremony is also good planning — the kind that keeps a celebration affordable and a family at peace.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Perhaps the most well-known Ilocano wedding custom is the bitor: a gift-giving or money-pinning tradition where guests, family and friends contribute to help the newlyweds begin married life. In some celebrations it takes the form of the familiar money dance, with bills pinned to the couple as they dance; in others it is a more formal offering received and recorded by a relative. Whatever the form, the spirit is the same — the community pools its resources so the couple does not start out alone, and the gesture is remembered for years.$old$, $new$Perhaps the most well-known Ilocano wedding custom is the bitor: a gift-giving or money-pinning tradition where guests, family and friends contribute to help the newlyweds begin married life. At some weddings it takes the form of the familiar money dance, with bills pinned to the couple as they dance; in others it is a more formal offering received and recorded by a relative. Whatever the form, the spirit is the same — the community pools its resources so the couple does not start out alone, and the gesture is remembered for years.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'ilocano-wedding-traditions'
   AND position($old$Perhaps the most well-known Ilocano wedding custom is the bitor: a gift-giving or money-pinning tradition where guests, family and friends contribute to help the newlyweds begin married life. In some celebrations it takes the form of the familiar money dance, with bills pinned to the couple as they dance; in others it is a more formal offering received and recorded by a relative. Whatever the form, the spirit is the same — the community pools its resources so the couple does not start out alone, and the gesture is remembered for years.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$The thrift the region is known for is a planning asset, not a limit. Careful budgeting and a clear timeline let an Ilocano couple host a celebration that feels abundant without overspending — choosing where to be generous (the food, the people) and where to keep things simple (the extras that few guests will remember). Many of the tools that help you plan this way are free, which keeps the spirit of the bitor alive in the planning itself.$old$, $new$The thrift the region is known for is a planning asset, not a limit. Careful budgeting and a clear timeline let an Ilocano couple host a wedding that feels abundant without overspending — choosing where to be generous (the food, the people) and where to keep things simple (the extras that few guests will remember). Many of the tools that help you plan this way are free, which keeps the spirit of the bitor alive in the planning itself.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'ilocano-wedding-traditions'
   AND position($old$The thrift the region is known for is a planning asset, not a limit. Careful budgeting and a clear timeline let an Ilocano couple host a celebration that feels abundant without overspending — choosing where to be generous (the food, the people) and where to keep things simple (the extras that few guests will remember). Many of the tools that help you plan this way are free, which keeps the spirit of the bitor alive in the planning itself.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Plan your Northern celebration with a free, deadline-aware checklist.
setnayan.com/features$old$, $new$Plan your Northern wedding with a free, deadline-aware checklist.
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'ilocano-wedding-traditions'
   AND position($old$Plan your Northern celebration with a free, deadline-aware checklist.
setnayan.com/features$old$ IN body) > 0;

-- ── intimate-wedding-vs-big-wedding-cost ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$An intimate wedding does more than cut the bill. It lets you spend more per guest — a nicer venue, better food, a longer celebration — while spending less overall, and it buys you real time with everyone there instead of a blur of handshakes. A big wedding, on the other hand, honours the Filipino reality that family and community are wide and beloved, and leaving people out carries its own quiet cost in relationships. Neither is wrong; the right choice is the one you can fund comfortably and will be glad of for years.$old$, $new$An intimate wedding does more than cut the bill. It lets you spend more per guest — a nicer venue, better food, a longer reception — while spending less overall, and it buys you real time with everyone there instead of a blur of handshakes. A big wedding, on the other hand, honours the Filipino reality that family and community are wide and beloved, and leaving people out carries its own quiet cost in relationships. Neither is wrong; the right choice is the one you can fund comfortably and will be glad of for years.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'intimate-wedding-vs-big-wedding-cost'
   AND position($old$An intimate wedding does more than cut the bill. It lets you spend more per guest — a nicer venue, better food, a longer celebration — while spending less overall, and it buys you real time with everyone there instead of a blur of handshakes. A big wedding, on the other hand, honours the Filipino reality that family and community are wide and beloved, and leaving people out carries its own quiet cost in relationships. Neither is wrong; the right choice is the one you can fund comfortably and will be glad of for years.$old$ IN body) > 0;

-- ── marriage-license-requirements-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Setnayan tracks the statutory deadlines for your date — licence window included — so nothing lapses.
setnayan.com/features$old$, $new$Setnayan's checklist dates every task from your wedding date, so each deadline shows up in time.
setnayan.com/features$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'marriage-license-requirements-philippines'
   AND position($old$Setnayan tracks the statutory deadlines for your date — licence window included — so nothing lapses.
setnayan.com/features$old$ IN body) > 0;

-- ── mobile-bar-wedding-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Find and compare mobile bar suppliers near your venue, with no booking commission.
setnayan.com/?browse=1$old$, $new$Find and compare mobile bar suppliers near your venue.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'mobile-bar-wedding-philippines'
   AND position($old$Find and compare mobile bar suppliers near your venue, with no booking commission.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── money-dance-filipino-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$• The host or emcee announces the money dance and invites guests to line up, usually after dinner when the room is relaxed.
• Helpers — often close friends or members of the entourage — stand by with pins, tape, or ribbon to attach the bills neatly.
• Guests dance briefly with the bride or groom, pin their gift, and step aside so the next person can take a turn.
• A trusted person quietly collects and safekeeps the cash as the dance winds down, so nothing goes astray in the celebration.$old$, $new$• The host or emcee announces the money dance and invites guests to line up, usually after dinner when the room is relaxed.
• Helpers — often close friends or members of the entourage — stand by with pins, tape, or ribbon to attach the bills neatly.
• Guests dance briefly with the bride or groom, pin their gift, and step aside so the next person can take a turn.
• A trusted person quietly collects and safekeeps the cash as the dance winds down, so nothing goes astray in the festivities.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'money-dance-filipino-wedding'
   AND position($old$• The host or emcee announces the money dance and invites guests to line up, usually after dinner when the room is relaxed.
• Helpers — often close friends or members of the entourage — stand by with pins, tape, or ribbon to attach the bills neatly.
• Guests dance briefly with the bride or groom, pin their gift, and step aside so the next person can take a turn.
• A trusted person quietly collects and safekeeps the cash as the dance winds down, so nothing goes astray in the celebration.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Plan your reception program, guest list, and budget in one free workspace — no commission on your suppliers, ever.
setnayan.com/signup$old$, $new$Plan your reception program, guest list, and budget in one free workspace. Hosts pay 0% commission.
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'money-dance-filipino-wedding'
   AND position($old$Plan your reception program, guest list, and budget in one free workspace — no commission on your suppliers, ever.
setnayan.com/signup$old$ IN body) > 0;

-- ── muslim-moro-wedding-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A Muslim Filipino wedding is, at its heart, a solemn covenant and a joyful coming-together of two families. Among the Moro peoples of Mindanao — the Maranao, Maguindanao, Tausug and others — the celebration can be richly cultural, layered with music, attire and feasting that vary beautifully from community to community. This overview is written respectfully by an informed outsider; it describes the marriage in general, well-established terms only. For the specifics that matter to your union, the right guides are your imam and your families, and the governing law is the Code of Muslim Personal Laws of the Philippines.$old$, $new$A Muslim Filipino wedding is, at its heart, a solemn covenant and a joyful coming-together of two families. Among the Moro peoples of Mindanao — the Maranao, Maguindanao, Tausug and others — the wedding can be richly cultural, layered with music, attire and feasting that vary beautifully from community to community. This overview is written respectfully by an informed outsider; it describes the marriage in general, well-established terms only. For the specifics that matter to your union, the right guides are your imam and your families, and the governing law is the Code of Muslim Personal Laws of the Philippines.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'muslim-moro-wedding-philippines'
   AND position($old$A Muslim Filipino wedding is, at its heart, a solemn covenant and a joyful coming-together of two families. Among the Moro peoples of Mindanao — the Maranao, Maguindanao, Tausug and others — the celebration can be richly cultural, layered with music, attire and feasting that vary beautifully from community to community. This overview is written respectfully by an informed outsider; it describes the marriage in general, well-established terms only. For the specifics that matter to your union, the right guides are your imam and your families, and the governing law is the Code of Muslim Personal Laws of the Philippines.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$A defining feature of the Islamic marriage is the mahr — a gift or dowry given by the groom to the bride as her own. It is a mark of honour and commitment, and the details are agreed between the families. Among Moro communities the family plays a central, respected role throughout: in the courtship, in the negotiations, and in the celebration that follows. The wali (guardian) of the bride is part of this process. None of these elements is decorative; each carries meaning, and each is best understood through your own family and officiant rather than a general guide.$old$, $new$A defining feature of the Islamic marriage is the mahr — a gift or dowry given by the groom to the bride as her own. It is a mark of honour and commitment, and the details are agreed between the families. Among Moro communities the family plays a central, respected role throughout: in the courtship, in the negotiations, and in the feast that follows. The wali (guardian) of the bride is part of this process. None of these elements is decorative; each carries meaning, and each is best understood through your own family and officiant rather than a general guide.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'muslim-moro-wedding-philippines'
   AND position($old$A defining feature of the Islamic marriage is the mahr — a gift or dowry given by the groom to the bride as her own. It is a mark of honour and commitment, and the details are agreed between the families. Among Moro communities the family plays a central, respected role throughout: in the courtship, in the negotiations, and in the celebration that follows. The wali (guardian) of the bride is part of this process. None of these elements is decorative; each carries meaning, and each is best understood through your own family and officiant rather than a general guide.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$The celebration

Beyond the contract, the festivities can be magnificent. The kanduli — the communal feast — gathers the wider family and community. Traditional dress, the okir art motifs of Maranao culture, kulintang gong-and-drum ensembles, and dances passed down through generations can all feature, depending on the family and locality. Halal catering is essential, and many couples plan the day around prayer times and the comfort of elders. The richness of the celebration is a point of pride, and it differs from one community to the next — there is no single template for a Moro wedding.$old$, $new$The feast and the festivities

Beyond the contract, the festivities can be magnificent. The kanduli — the communal feast — gathers the wider family and community. Traditional dress, the okir art motifs of Maranao culture, kulintang gong-and-drum ensembles, and dances passed down through generations can all feature, depending on the family and locality. Halal catering is essential, and many couples plan the day around prayer times and the comfort of elders. The richness of the feast is a point of pride, and it differs from one community to the next — there is no single template for a Moro wedding.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'muslim-moro-wedding-philippines'
   AND position($old$The celebration

Beyond the contract, the festivities can be magnificent. The kanduli — the communal feast — gathers the wider family and community. Traditional dress, the okir art motifs of Maranao culture, kulintang gong-and-drum ensembles, and dances passed down through generations can all feature, depending on the family and locality. Halal catering is essential, and many couples plan the day around prayer times and the comfort of elders. The richness of the celebration is a point of pride, and it differs from one community to the next — there is no single template for a Moro wedding.$old$ IN body) > 0;

-- ── new-year-wedding-planning-kickoff ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Pair your plan with a printable countdown you can fill in by hand and pin to the fridge.
setnayan.com/features$old$, $new$Let a free, self-updating checklist carry every date.
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'new-year-wedding-planning-kickoff'
   AND position($old$Pair your plan with a printable countdown you can fill in by hand and pin to the fridge.
setnayan.com/features$old$ IN body) > 0;

-- ── new-years-eve-wedding-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Imagine your first kiss as a married couple landing exactly as the fireworks go up and the whole country counts down to midnight. A New Year's Eve wedding is the most dramatic date on the calendar — a celebration that flows straight from your vows into the biggest party of the year, with everyone already in the mood to toast, dance, and stay late. It is unforgettable by design. It is also one of the trickier dates to pull off well, because you are competing with every other New Year plan your guests and suppliers already have. Here is how to make the countdown wedding work.$old$, $new$Imagine your first kiss as a married couple landing exactly as the fireworks go up and the whole country counts down to midnight. A New Year's Eve wedding is the most dramatic date on the calendar — a wedding that flows straight from your vows into the biggest party of the year, with everyone already in the mood to toast, dance, and stay late. It is unforgettable by design. It is also one of the trickier dates to pull off well, because you are competing with every other New Year plan your guests and suppliers already have. Here is how to make the countdown wedding work.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'new-years-eve-wedding-philippines'
   AND position($old$Imagine your first kiss as a married couple landing exactly as the fireworks go up and the whole country counts down to midnight. A New Year's Eve wedding is the most dramatic date on the calendar — a celebration that flows straight from your vows into the biggest party of the year, with everyone already in the mood to toast, dance, and stay late. It is unforgettable by design. It is also one of the trickier dates to pull off well, because you are competing with every other New Year plan your guests and suppliers already have. Here is how to make the countdown wedding work.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Marrying on the last night of the year is bold, glamorous, and deeply romantic — a single celebration that closes one chapter and opens two at once. Plan the midnight moment first, give your guests early and honest notice, sort out the logistics that get sparse on the 31st, and let the countdown do what it was made to do.$old$, $new$Marrying on the last night of the year is bold, glamorous, and deeply romantic — a single night that closes one chapter and opens two at once. Plan the midnight moment first, give your guests early and honest notice, sort out the logistics that get sparse on the 31st, and let the countdown do what it was made to do.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'new-years-eve-wedding-philippines'
   AND position($old$Marrying on the last night of the year is bold, glamorous, and deeply romantic — a single celebration that closes one chapter and opens two at once. Plan the midnight moment first, give your guests early and honest notice, sort out the logistics that get sparse on the 31st, and let the countdown do what it was made to do.$old$ IN body) > 0;

-- ── off-peak-weekday-wedding-pros-cons ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Off-peak rewards couples who value choice and budget over a marquee Saturday, who have a guest list flexible enough to travel midweek, and who are happy to plan a light weather contingency for an off-season date. If that sounds like the two of you, the savings and the calmer, less rushed experience can be very well worth a little extra coordination on the front end. A useful middle path is to keep the guests you most want at the centre of the decision: if your closest people are flexible and local, a weekday is easy, and if your dream entourage is scattered across the country or abroad, a long-weekend off-peak date can capture most of the savings while still making travel realistic for everyone you love. Either way, a weekday or off-season wedding is not a lesser wedding — it is the very same celebration on a smarter calendar. Weigh the guest trade-offs honestly, give generous notice, plan for the weather if you must, and you may well find that your dream suppliers were free all along.$old$, $new$Off-peak rewards couples who value choice and budget over a marquee Saturday, who have a guest list flexible enough to travel midweek, and who are happy to plan a light weather contingency for an off-season date. If that sounds like the two of you, the savings and the calmer, less rushed experience can be very well worth a little extra coordination on the front end. A useful middle path is to keep the guests you most want at the centre of the decision: if your closest people are flexible and local, a weekday is easy, and if your dream entourage is scattered across the country or abroad, a long-weekend off-peak date can capture most of the savings while still making travel realistic for everyone you love. Either way, a weekday or off-season wedding is not a lesser wedding — it is the very same wedding on a smarter calendar. Weigh the guest trade-offs honestly, give generous notice, plan for the weather if you must, and you may well find that your dream suppliers were free all along.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'off-peak-weekday-wedding-pros-cons'
   AND position($old$Off-peak rewards couples who value choice and budget over a marquee Saturday, who have a guest list flexible enough to travel midweek, and who are happy to plan a light weather contingency for an off-season date. If that sounds like the two of you, the savings and the calmer, less rushed experience can be very well worth a little extra coordination on the front end. A useful middle path is to keep the guests you most want at the centre of the decision: if your closest people are flexible and local, a weekday is easy, and if your dream entourage is scattered across the country or abroad, a long-weekend off-peak date can capture most of the savings while still making travel realistic for everyone you love. Either way, a weekday or off-season wedding is not a lesser wedding — it is the very same celebration on a smarter calendar. Weigh the guest trade-offs honestly, give generous notice, plan for the weather if you must, and you may well find that your dream suppliers were free all along.$old$ IN body) > 0;

-- ── pamamanhikan-explained ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Customs vary by family and region, but the shape is familiar across the country. The groom's family visits the bride's home, often bringing food, dessert, or a thoughtful gift as a sign of respect — arriving empty-handed is a misstep to avoid. There is conversation, a shared meal, and at some gracious point the blessing is asked and given, sometimes formally and sometimes simply in the warmth of the evening. From there the talk can drift, naturally and without pressure, toward the practical: a rough date, who would like to host what, and how the two families might share the celebration.$old$, $new$Customs vary by family and region, but the shape is familiar across the country. The groom's family visits the bride's home, often bringing food, dessert, or a thoughtful gift as a sign of respect — arriving empty-handed is a misstep to avoid. There is conversation, a shared meal, and at some gracious point the blessing is asked and given, sometimes formally and sometimes simply in the warmth of the evening. From there the talk can drift, naturally and without pressure, toward the practical: a rough date, who would like to host what, and how the two families might share the wedding.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'pamamanhikan-explained'
   AND position($old$Customs vary by family and region, but the shape is familiar across the country. The groom's family visits the bride's home, often bringing food, dessert, or a thoughtful gift as a sign of respect — arriving empty-handed is a misstep to avoid. There is conversation, a shared meal, and at some gracious point the blessing is asked and given, sometimes formally and sometimes simply in the warmth of the evening. From there the talk can drift, naturally and without pressure, toward the practical: a rough date, who would like to host what, and how the two families might share the celebration.$old$ IN body) > 0;

-- ── prenup-engagement-shoot-guide-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$The most memorable prenups are not the most elaborate — they are the most personal. A shoot in the cafe where you first met, the basketball court where he proposed, or your grandparents home will always beat a generic field of flowers you have no connection to. Pick locations and props that mean something, and resist copying someone else photoset wholesale. Your story is the styling.$old$, $new$The most memorable prenups are not the most elaborate — they are the most personal. A shoot in the cafe where you first met, the basketball court where he proposed, or your grandparents' home will always beat a generic field of flowers you have no connection to. Pick locations and props that mean something, and resist copying someone else's photoset wholesale. Your story is the styling.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'prenup-engagement-shoot-guide-philippines'
   AND position($old$The most memorable prenups are not the most elaborate — they are the most personal. A shoot in the cafe where you first met, the basketball court where he proposed, or your grandparents home will always beat a generic field of flowers you have no connection to. Pick locations and props that mean something, and resist copying someone else photoset wholesale. Your story is the styling.$old$ IN body) > 0;

-- ── rainy-season-wedding-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Comfort is half the battle, and most of it is won with a few small courtesies. Note on the invitation that the celebration goes on rain or shine, gently suggest closed shoes for a garden setting, and make sure your coordinator and every single supplier know the wet-weather sequence by heart. A rehearsed team moves guests under cover before most people register the first drops. It helps, too, to think of the rain as part of the story rather than its enemy — some of the most-loved wedding photographs ever taken are of couples laughing under a shared umbrella, of clear domes catching the light, of a reception glowing warm against a grey sky. Brief your photographer to be ready for it, and a shower becomes a scene instead of a setback.$old$, $new$Comfort is half the battle, and most of it is won with a few small courtesies. Note on the invitation that the wedding goes on rain or shine, gently suggest closed shoes for a garden setting, and make sure your coordinator and every single supplier know the wet-weather sequence by heart. A rehearsed team moves guests under cover before most people register the first drops. It helps, too, to think of the rain as part of the story rather than its enemy — some of the most-loved wedding photographs ever taken are of couples laughing under a shared umbrella, of clear domes catching the light, of a reception glowing warm against a grey sky. Brief your photographer to be ready for it, and a shower becomes a scene instead of a setback.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'rainy-season-wedding-philippines'
   AND position($old$Comfort is half the battle, and most of it is won with a few small courtesies. Note on the invitation that the celebration goes on rain or shine, gently suggest closed shoes for a garden setting, and make sure your coordinator and every single supplier know the wet-weather sequence by heart. A rehearsed team moves guests under cover before most people register the first drops. It helps, too, to think of the rain as part of the story rather than its enemy — some of the most-loved wedding photographs ever taken are of couples laughing under a shared umbrella, of clear domes catching the light, of a reception glowing warm against a grey sky. Brief your photographer to be ready for it, and a shower becomes a scene instead of a setback.$old$ IN body) > 0;

-- ── release-of-doves-filipino-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$The release usually lands at a natural high point in the day: just after the couple emerges from the ceremony into the sunlight, or as a flourish during the reception program. Customs vary by family and region, and timing is often chosen for the best light and the biggest audience. Some couples choose butterflies instead of doves — a softer, equally lovely alternative that carries the same spirit of harmony and new beginnings, and that suits gardens and daytime celebrations beautifully. Either way, the meaning is the same: a fragile, living thing set free as a symbol of a fresh start.$old$, $new$The release usually lands at a natural high point in the day: just after the couple emerges from the ceremony into the sunlight, or as a flourish during the reception program. Customs vary by family and region, and timing is often chosen for the best light and the biggest audience. Some couples choose butterflies instead of doves — a softer, equally lovely alternative that carries the same spirit of harmony and new beginnings, and that suits gardens and daytime weddings beautifully. Either way, the meaning is the same: a fragile, living thing set free as a symbol of a fresh start.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'release-of-doves-filipino-wedding'
   AND position($old$The release usually lands at a natural high point in the day: just after the couple emerges from the ceremony into the sunlight, or as a flourish during the reception program. Customs vary by family and region, and timing is often chosen for the best light and the biggest audience. Some couples choose butterflies instead of doves — a softer, equally lovely alternative that carries the same spirit of harmony and new beginnings, and that suits gardens and daytime celebrations beautifully. Either way, the meaning is the same: a fragile, living thing set free as a symbol of a fresh start.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Browse trusted Filipino suppliers — handlers, stylists, and the teams who make these moments — by city and category.
setnayan.com/?browse=1$old$, $new$Browse verified Filipino suppliers — handlers, stylists, and the teams who make these moments — by city and category.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'release-of-doves-filipino-wedding'
   AND position($old$Browse trusted Filipino suppliers — handlers, stylists, and the teams who make these moments — by city and category.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── simbang-gabi-and-december-weddings ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$See what your parish will need before you set the date.
setnayan.com/features$old$, $new$Keep your parish dates and documents in one free checklist before you set the date.
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'simbang-gabi-and-december-weddings'
   AND position($old$See what your parish will need before you set the date.
setnayan.com/features$old$ IN body) > 0;

-- ── unity-candle-ceremony-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Whatever your ceremony — Catholic, civil, Christian, or mixed — see how a Filipino wedding flows, beat by beat.
setnayan.com/features$old$, $new$Whatever your ceremony — Catholic, civil, Christian, or mixed — read our overview of Filipino wedding traditions.
setnayan.com/articles/filipino-wedding-traditions-explained$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'unity-candle-ceremony-wedding'
   AND position($old$Whatever your ceremony — Catholic, civil, Christian, or mixed — see how a Filipino wedding flows, beat by beat.
setnayan.com/features$old$ IN body) > 0;

-- ── visayan-cebuano-wedding-traditions ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A wedding in the Visayas carries a particular warmth. From Cebu to Bohol, Iloilo to Bacolod, the day is built on family, food and a generosity of spirit that fills every room. If you grew up in the region — or you are marrying into it — you will recognise the rhythm: the families meet first, the church or the beach hosts the vows, and then the celebration spills well into the night. Here are the traditions Visayan and Cebuano couples most often choose to honour, described in general terms. The exact form always varies by family, town and province, so treat your elders as the final word on what your own celebration should hold.$old$, $new$A wedding in the Visayas carries a particular warmth. From Cebu to Bohol, Iloilo to Bacolod, the day is built on family, food and a generosity of spirit that fills every room. If you grew up in the region — or you are marrying into it — you will recognise the rhythm: the families meet first, the church or the beach hosts the vows, and then the reception spills well into the night. Here are the traditions Visayan and Cebuano couples most often choose to honour, described in general terms. The exact form always varies by family, town and province, so treat your elders as the final word on what your own wedding should hold.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'visayan-cebuano-wedding-traditions'
   AND position($old$A wedding in the Visayas carries a particular warmth. From Cebu to Bohol, Iloilo to Bacolod, the day is built on family, food and a generosity of spirit that fills every room. If you grew up in the region — or you are marrying into it — you will recognise the rhythm: the families meet first, the church or the beach hosts the vows, and then the celebration spills well into the night. Here are the traditions Visayan and Cebuano couples most often choose to honour, described in general terms. The exact form always varies by family, town and province, so treat your elders as the final word on what your own celebration should hold.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$No Visayan celebration is complete without a generous table, and the lechon — Cebu’s is famous nationwide — is often the centrepiece. Expect roast pig, native delicacies, and a spread that no one is meant to finish. Hospitality here is measured in abundance: a host would rather over-cater than risk a guest leaving hungry. Budget accordingly, and lean on a caterer who knows regional favourites and can balance the showpiece lechon with the lighter dishes guests reach for once the feasting slows. A few customs you may still see at the reception: the money dance, where guests pin bills to the couple to help them start their life together; long, heartfelt toasts from family and ninong; and dancing that keeps going long after the formal programme ends. None of it is obligatory — the joy of a regional wedding is choosing the pieces that mean something to you and your families, and letting the rest go.$old$, $new$No Visayan wedding is complete without a generous table, and the lechon — Cebu’s is famous nationwide — is often the centrepiece. Expect roast pig, native delicacies, and a spread that no one is meant to finish. Hospitality here is measured in abundance: a host would rather over-cater than risk a guest leaving hungry. Budget accordingly, and lean on a caterer who knows regional favourites and can balance the showpiece lechon with the lighter dishes guests reach for once the feasting slows. A few customs you may still see at the reception: the money dance, where guests pin bills to the couple to help them start their life together; long, heartfelt toasts from family and ninong; and dancing that keeps going long after the formal programme ends. None of it is obligatory — the joy of a regional wedding is choosing the pieces that mean something to you and your families, and letting the rest go.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'visayan-cebuano-wedding-traditions'
   AND position($old$No Visayan celebration is complete without a generous table, and the lechon — Cebu’s is famous nationwide — is often the centrepiece. Expect roast pig, native delicacies, and a spread that no one is meant to finish. Hospitality here is measured in abundance: a host would rather over-cater than risk a guest leaving hungry. Budget accordingly, and lean on a caterer who knows regional favourites and can balance the showpiece lechon with the lighter dishes guests reach for once the feasting slows. A few customs you may still see at the reception: the money dance, where guests pin bills to the couple to help them start their life together; long, heartfelt toasts from family and ninong; and dancing that keeps going long after the formal programme ends. None of it is obligatory — the joy of a regional wedding is choosing the pieces that mean something to you and your families, and letting the rest go.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Ready to map out your own Visayan celebration, from the family meeting to the feast?
setnayan.com/signup$old$, $new$Ready to map out your own Visayan wedding, from the family meeting to the feast?
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'visayan-cebuano-wedding-traditions'
   AND position($old$Ready to map out your own Visayan celebration, from the family meeting to the feast?
setnayan.com/signup$old$ IN body) > 0;

-- ── wedding-cake-guide-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Find cake designers near your venue and compare styles and packages, commission-free.
setnayan.com/?browse=1$old$, $new$Find cake designers near your venue and compare styles and packages.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-cake-guide-philippines'
   AND position($old$Find cake designers near your venue and compare styles and packages, commission-free.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── wedding-contingency-fund-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$The unexpected at a wedding is remarkably predictable in shape, even if you cannot name it in advance. The buffer is what absorbs all of it — overtime when the celebration runs long, a late surge of guests or sponsors who could not be turned away, a wet-weather backup or generator, a supplier issue that means rebooking at short notice, and the small fees like corkage and service charge that always appear — without forcing a stressful conversation or a credit-card swipe. And if a buffer feels like a luxury on a tight budget, flip the logic: it is precisely the tighter budgets that need it most, because a wedding with little slack is the one most easily derailed by a single unexpected fee.$old$, $new$The unexpected at a wedding is remarkably predictable in shape, even if you cannot name it in advance. The buffer is what absorbs all of it — overtime when the reception runs long, a late surge of guests or sponsors who could not be turned away, a wet-weather backup or generator, a supplier issue that means rebooking at short notice, and the small fees like corkage and service charge that always appear — without forcing a stressful conversation or a credit-card swipe. And if a buffer feels like a luxury on a tight budget, flip the logic: it is precisely the tighter budgets that need it most, because a wedding with little slack is the one most easily derailed by a single unexpected fee.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-contingency-fund-philippines'
   AND position($old$The unexpected at a wedding is remarkably predictable in shape, even if you cannot name it in advance. The buffer is what absorbs all of it — overtime when the celebration runs long, a late surge of guests or sponsors who could not be turned away, a wet-weather backup or generator, a supplier issue that means rebooking at short notice, and the small fees like corkage and service charge that always appear — without forcing a stressful conversation or a credit-card swipe. And if a buffer feels like a luxury on a tight budget, flip the logic: it is precisely the tighter budgets that need it most, because a wedding with little slack is the one most easily derailed by a single unexpected fee.$old$ IN body) > 0;

-- ── wedding-coordinator-on-the-day-vs-full ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$As a rough 2026 market guide, on-the-day coordination in the Philippines typically costs a good deal less than full planning, which scales with the size and complexity of the wedding. If the budget is tight, on-the-day coordination is often the single highest-value supplier you can add — it protects every other peso you have already spent. With a free planning workspace doing the organising, many couples comfortably handle the rest themselves.

Plan it yourself with a free workspace, then add a coordinator for the day — start in minutes.
setnayan.com/signup$old$, $new$On-the-day coordination in the Philippines typically costs a good deal less than full planning, which scales with the size and complexity of the wedding. If the budget is tight, on-the-day coordination is often the single highest-value supplier you can add — it protects every other peso you have already spent. With a free planning workspace doing the organising, many couples comfortably handle the rest themselves.

Plan it yourself with a free workspace, then add a coordinator for the day.
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-coordinator-on-the-day-vs-full'
   AND position($old$As a rough 2026 market guide, on-the-day coordination in the Philippines typically costs a good deal less than full planning, which scales with the size and complexity of the wedding. If the budget is tight, on-the-day coordination is often the single highest-value supplier you can add — it protects every other peso you have already spent. With a free planning workspace doing the organising, many couples comfortably handle the rest themselves.

Plan it yourself with a free workspace, then add a coordinator for the day — start in minutes.
setnayan.com/signup$old$ IN body) > 0;

-- ── wedding-florist-styling-guide-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$As a rough 2026 market guide, wedding florals and styling in the Philippines span a wide range — modest packages for an intimate celebration through to substantial figures for full ballroom transformations. The number that matters is not the total but the fit: a supplier who understands your mood board, respects your budget, and tells you honestly what is achievable on your date.$old$, $new$Wedding florals and styling in the Philippines span a wide range — modest packages for an intimate wedding through to substantial figures for full ballroom transformations. The number that matters is not the total but the fit: a supplier who understands your mood board, respects your budget, and tells you honestly what is achievable on your date.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-florist-styling-guide-philippines'
   AND position($old$As a rough 2026 market guide, wedding florals and styling in the Philippines span a wide range — modest packages for an intimate celebration through to substantial figures for full ballroom transformations. The number that matters is not the total but the fit: a supplier who understands your mood board, respects your budget, and tells you honestly what is achievable on your date.$old$ IN body) > 0;

-- ── wedding-invitation-wording-etiquette-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$A few topics call for a gentle touch, and these are the ones that quietly cause the most hurt when handled carelessly. If your reception is adults-only, the cleanest way to convey it is on your Event Hub or a small separate insert, and by addressing the envelope only to the invited adults — pointedly naming whose children are excluded on the card itself reads as cold and is remembered. If you would rather receive cash than gifts, never state it directly on the formal invitation; a softly worded note on your Event Hub, or quiet word of mouth through the family, is the Filipino way to make wishes known without ever appearing grabbing. And always address envelopes by name, never with a vague "and family", so each guest knows exactly who, and how many, are actually invited — that single courtesy heads off most of the day-of confusion at the door. Finally, let the tone of the whole thing match the tone of the wedding: a grand church celebration can carry formal, traditional language, while an intimate garden wedding can be warmer and more conversational. The wording should read like a true preview of the day, not a template borrowed from someone else's. Read it aloud before you print — if it sounds like the two of you, it is ready.$old$, $new$A few topics call for a gentle touch, and these are the ones that quietly cause the most hurt when handled carelessly. If your reception is adults-only, the cleanest way to convey it is on your Event Hub or a small separate insert, and by addressing the envelope only to the invited adults — pointedly naming whose children are excluded on the card itself reads as cold and is remembered. If you would rather receive cash than gifts, never state it directly on the formal invitation; a softly worded note on your Event Hub, or quiet word of mouth through the family, is the Filipino way to make wishes known without ever appearing grabbing. And always address envelopes by name, never with a vague "and family", so each guest knows exactly who, and how many, are actually invited — that single courtesy heads off most of the day-of confusion at the door. Finally, let the tone of the whole thing match the tone of the wedding: a grand church wedding can carry formal, traditional language, while an intimate garden wedding can be warmer and more conversational. The wording should read like a true preview of the day, not a template borrowed from someone else's. Read it aloud before you print — if it sounds like the two of you, it is ready.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-invitation-wording-etiquette-philippines'
   AND position($old$A few topics call for a gentle touch, and these are the ones that quietly cause the most hurt when handled carelessly. If your reception is adults-only, the cleanest way to convey it is on your Event Hub or a small separate insert, and by addressing the envelope only to the invited adults — pointedly naming whose children are excluded on the card itself reads as cold and is remembered. If you would rather receive cash than gifts, never state it directly on the formal invitation; a softly worded note on your Event Hub, or quiet word of mouth through the family, is the Filipino way to make wishes known without ever appearing grabbing. And always address envelopes by name, never with a vague "and family", so each guest knows exactly who, and how many, are actually invited — that single courtesy heads off most of the day-of confusion at the door. Finally, let the tone of the whole thing match the tone of the wedding: a grand church celebration can carry formal, traditional language, while an intimate garden wedding can be warmer and more conversational. The wording should read like a true preview of the day, not a template borrowed from someone else's. Read it aloud before you print — if it sounds like the two of you, it is ready.$old$ IN body) > 0;

-- ── wedding-lights-and-sounds-guide ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$• Sound: speakers sized to your room and crowd, microphones for the officiant, host, and speeches, and a mixing board with a live operator.
• Lighting: ambient and mood lighting, uplights to wash the walls in your palette, spotlights for the entrance and first dance, and sometimes a monogram or gobo projection.
• AV and screens: an LED wall or projector for your photo or video montage, a slideshow, or a live feed of the program.
• The operator: a technician on site for the whole event, not just a drop-off of equipment.$old$, $new$• Sound: speakers sized to your room and crowd, microphones for the officiant, host, and speeches, and a mixing board with a live operator.
• Lighting: ambient and mood lighting, uplights to wash the walls in your palette, spotlights for the entrance and first dance, and sometimes your initials or a gobo projection.
• AV and screens: an LED wall or projector for your photo or video montage, a slideshow, or a live feed of the program.
• The operator: a technician on site for the whole event, not just a drop-off of equipment.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-lights-and-sounds-guide'
   AND position($old$• Sound: speakers sized to your room and crowd, microphones for the officiant, host, and speeches, and a mixing board with a live operator.
• Lighting: ambient and mood lighting, uplights to wash the walls in your palette, spotlights for the entrance and first dance, and sometimes a monogram or gobo projection.
• AV and screens: an LED wall or projector for your photo or video montage, a slideshow, or a live feed of the program.
• The operator: a technician on site for the whole event, not just a drop-off of equipment.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Coordinate the lights and sounds team with your host and music early, ideally at the same planning meeting, so the entrance music, the dimming for the first dance, and the spotlight cues all land together rather than fighting each other on the night. As a rough 2026 market guide, lights-and-sounds packages in the Philippines range widely with room size, gear quality, the length of the event, and whether LED screens are included. The order of spending matters more than the total: put your money first into clear, reliable sound and a live operator who stays for the whole program. The lighting flourishes — the uplights, the monogram, the warm wash on the walls — are genuinely worth it, but only once the room can hear you say "I do."

Find lights-and-sounds and AV suppliers who know your venue, and compare them commission-free.
setnayan.com/?browse=1$old$, $new$Coordinate the lights and sounds team with your host and music early, ideally at the same planning meeting, so the entrance music, the dimming for the first dance, and the spotlight cues all land together rather than fighting each other on the night. Lights-and-sounds packages in the Philippines range widely with room size, gear quality, the length of the event, and whether LED screens are included. The order of spending matters more than the total: put your money first into clear, reliable sound and a live operator who stays for the whole program. The lighting flourishes — the uplights, your initials in light, the warm wash on the walls — are genuinely worth it, but only once the room can hear you say "I do."

Find lights-and-sounds and AV suppliers who know your venue, and compare them side by side.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-lights-and-sounds-guide'
   AND position($old$Coordinate the lights and sounds team with your host and music early, ideally at the same planning meeting, so the entrance music, the dimming for the first dance, and the spotlight cues all land together rather than fighting each other on the night. As a rough 2026 market guide, lights-and-sounds packages in the Philippines range widely with room size, gear quality, the length of the event, and whether LED screens are included. The order of spending matters more than the total: put your money first into clear, reliable sound and a live operator who stays for the whole program. The lighting flourishes — the uplights, the monogram, the warm wash on the walls — are genuinely worth it, but only once the room can hear you say "I do."

Find lights-and-sounds and AV suppliers who know your venue, and compare them commission-free.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── wedding-payment-schedule-deposits-explained ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$When you have eight or ten suppliers, each with their own deposit and balance dates, the calendar is where money slips through the cracks — a balance due you forgot, a deposit you cannot remember sending. The fix is to record each payment the moment it goes out, tagged to the supplier and the milestone it covers, so a single glance tells you your true remaining balance across the whole wedding rather than a guess and a stack of receipts in your phone’s photos. This is also your early-warning system: if the payments due in a given month start to crowd together, you see it weeks ahead and can talk to a supplier about adjusting a date, instead of discovering the crunch the week it lands. Because Setnayan takes zero commission on supplier bookings, the only amounts on your schedule are the ones you agreed with your suppliers — never a surprise platform fee on top. Pay in stages, get it in writing, keep your records, and watch the calendar, and the scariest part of working with suppliers becomes routine: money out, value in, all the way to the day.$old$, $new$When you have eight or ten suppliers, each with their own deposit and balance dates, the calendar is where money slips through the cracks — a balance due you forgot, a deposit you cannot remember sending. The fix is to record each payment the moment it goes out, tagged to the supplier and the milestone it covers, so a single glance tells you your true remaining balance across the whole wedding rather than a guess and a stack of receipts in your phone’s photos. This is also your early-warning system: if the payments due in a given month start to crowd together, you see it weeks ahead and can talk to a supplier about adjusting a date, instead of discovering the crunch the week it lands. Hosts pay 0% commission. The only amounts on your schedule are the ones you agreed with your suppliers. Pay in stages, get it in writing, keep your records, and watch the calendar, and the scariest part of working with suppliers becomes routine: money out, value in, all the way to the day.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-payment-schedule-deposits-explained'
   AND position($old$When you have eight or ten suppliers, each with their own deposit and balance dates, the calendar is where money slips through the cracks — a balance due you forgot, a deposit you cannot remember sending. The fix is to record each payment the moment it goes out, tagged to the supplier and the milestone it covers, so a single glance tells you your true remaining balance across the whole wedding rather than a guess and a stack of receipts in your phone’s photos. This is also your early-warning system: if the payments due in a given month start to crowd together, you see it weeks ahead and can talk to a supplier about adjusting a date, instead of discovering the crunch the week it lands. Because Setnayan takes zero commission on supplier bookings, the only amounts on your schedule are the ones you agreed with your suppliers — never a surprise platform fee on top. Pay in stages, get it in writing, keep your records, and watch the calendar, and the scariest part of working with suppliers becomes routine: money out, value in, all the way to the day.$old$ IN body) > 0;

-- ── wedding-photo-deliverables-explained ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Compare photographer packages by what they actually deliver, not just the headline price.
setnayan.com/features$old$, $new$Compare photographer packages by what they actually deliver, not just the headline price.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-photo-deliverables-explained'
   AND position($old$Compare photographer packages by what they actually deliver, not just the headline price.
setnayan.com/features$old$ IN body) > 0;

-- ── wedding-photo-video-contract-red-flags ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$• A specific delivery window for edited photos, and a separate one for the video.
• A turnaround date for the album, which is usually later than the digital files.
• What happens, and what you are owed, if those deadlines are missed.
• Avoid vague phrasing like soon, in a few months, or when ready.$old$, $new$• A specific delivery window for edited photos, and a separate one for the video.
• A turnaround date for the album, which is usually later than the digital files.
• What happens, and what you are owed, if those deadlines are missed.
• Avoid vague phrasing like "soon", "in a few months" or "when ready".$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-photo-video-contract-red-flags'
   AND position($old$• A specific delivery window for edited photos, and a separate one for the video.
• A turnaround date for the album, which is usually later than the digital files.
• What happens, and what you are owed, if those deadlines are missed.
• Avoid vague phrasing like soon, in a few months, or when ready.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Photographers get sick. Gear fails. A serious supplier has a plan for both, and that plan is written down. The contract should name what happens if your booked shooter cannot make it — a qualified replacement of similar standard — and should mention backup equipment. If a supplier brushes off the what if you cannot come question, you are carrying a risk they should be carrying.$old$, $new$Photographers get sick. Gear fails. A serious supplier has a plan for both, and that plan is written down. The contract should name what happens if your booked shooter cannot make it — a qualified replacement of similar standard — and should mention backup equipment. If a supplier brushes off the "what if you cannot come?" question, you are carrying a risk they should be carrying.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-photo-video-contract-red-flags'
   AND position($old$Photographers get sick. Gear fails. A serious supplier has a plan for both, and that plan is written down. The contract should name what happens if your booked shooter cannot make it — a qualified replacement of similar standard — and should mention backup equipment. If a supplier brushes off the what if you cannot come question, you are carrying a risk they should be carrying.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Book suppliers you can verify and message in one place, with 0% commission on what you pay them.
setnayan.com/?browse=1$old$, $new$Book suppliers you can verify and message in one place.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-photo-video-contract-red-flags'
   AND position($old$Book suppliers you can verify and message in one place, with 0% commission on what you pay them.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── wedding-photographer-vs-videographer-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Booking a combined photo-and-video team usually costs less than hiring two separate suppliers, and it removes the awkward dance of two rival crews fighting for the same angle and stepping into each other shots all day. Bundled packages range widely, from a smaller team to an established studio with multiple shooters, a dedicated cinematographer and a same-day edit, so ask 3 suppliers for a quote on the same coverage. The gap reflects real differences — hours of coverage, crew size, deliverables, and polish — so two quotes that look far apart can describe nearly the same wedding once you line up the inclusions. Always confirm what counts as photo and what counts as video inside a single bundled price, because sometimes the video is a lighter add-on rather than full, independent coverage.$old$, $new$Booking a combined photo-and-video team usually costs less than hiring two separate suppliers, and it removes the awkward dance of two rival crews fighting for the same angle and stepping into each other's shots all day. Bundled packages range widely, from a smaller team to an established studio with multiple shooters, a dedicated cinematographer and a same-day edit, so ask 3 suppliers for a quote on the same coverage. The gap reflects real differences — hours of coverage, crew size, deliverables, and polish — so two quotes that look far apart can describe nearly the same wedding once you line up the inclusions. Always confirm what counts as photo and what counts as video inside a single bundled price, because sometimes the video is a lighter add-on rather than full, independent coverage.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-photographer-vs-videographer-philippines'
   AND position($old$Booking a combined photo-and-video team usually costs less than hiring two separate suppliers, and it removes the awkward dance of two rival crews fighting for the same angle and stepping into each other shots all day. Bundled packages range widely, from a smaller team to an established studio with multiple shooters, a dedicated cinematographer and a same-day edit, so ask 3 suppliers for a quote on the same coverage. The gap reflects real differences — hours of coverage, crew size, deliverables, and polish — so two quotes that look far apart can describe nearly the same wedding once you line up the inclusions. Always confirm what counts as photo and what counts as video inside a single bundled price, because sometimes the video is a lighter add-on rather than full, independent coverage.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$See how much photo and video teams actually charge across the Philippines before you decide.
setnayan.com/features$old$, $new$Compare photo and video teams side by side.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-photographer-vs-videographer-philippines'
   AND position($old$See how much photo and video teams actually charge across the Philippines before you decide.
setnayan.com/features$old$ IN body) > 0;

-- ── wedding-seating-plan-guide-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$The instinct is to seat everyone strictly by family line, but the better question is always who will actually enjoy sitting together. Cluster guests who already know one another or share something in common — college friends at one table, workmates at another, the titos who follow the same teleserye together. A guest surrounded by familiar faces relaxes and stays late; one stranded among strangers watches the clock. Handle the known tensions quietly too: keep estranged relatives at a comfortable distance, with no drama and no announcement. And do not finalise anything until your RSVPs are in and your headcount is firm — late confirmations and surprise plus-ones will rearrange your careful work, so build the plan somewhere you can reshuffle in seconds rather than redraw by hand. Once it is set, place cards or a clear seating display at the entrance let guests find their tables without a bottleneck at the door.

Arrange your tables visually and reshuffle in seconds as RSVPs change — the seating planner is free with every Setnayan account.
setnayan.com/signup$old$, $new$The instinct is to seat everyone strictly by family line, but the better question is always who will actually enjoy sitting together. Cluster guests who already know one another or share something in common — college friends at one table, workmates at another, the titos who follow the same teleserye together. A guest surrounded by familiar faces relaxes and stays late; one stranded among strangers watches the clock. Handle the known tensions quietly too: keep estranged relatives at a comfortable distance, with no drama and no announcement. And do not finalise anything until your RSVPs are in and your headcount is firm — late confirmations and surprise plus-ones will rearrange your careful work, so build the plan somewhere you can reshuffle easily rather than redraw by hand. Once it is set, place cards or a clear seating display at the entrance let guests find their tables without a bottleneck at the door.

Arrange your tables visually and reshuffle as RSVPs change — the seating planner is free with every Setnayan account.
setnayan.com/signup$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-seating-plan-guide-philippines'
   AND position($old$The instinct is to seat everyone strictly by family line, but the better question is always who will actually enjoy sitting together. Cluster guests who already know one another or share something in common — college friends at one table, workmates at another, the titos who follow the same teleserye together. A guest surrounded by familiar faces relaxes and stays late; one stranded among strangers watches the clock. Handle the known tensions quietly too: keep estranged relatives at a comfortable distance, with no drama and no announcement. And do not finalise anything until your RSVPs are in and your headcount is firm — late confirmations and surprise plus-ones will rearrange your careful work, so build the plan somewhere you can reshuffle in seconds rather than redraw by hand. Once it is set, place cards or a clear seating display at the entrance let guests find their tables without a bottleneck at the door.

Arrange your tables visually and reshuffle in seconds as RSVPs change — the seating planner is free with every Setnayan account.
setnayan.com/signup$old$ IN body) > 0;

-- ── wedding-videography-styles-philippines ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$You watch a few sample films, they all look stunning, and you book one — only to feel, months later, that the wedding video does not quite feel like your wedding. That mismatch is almost always a style problem, not a talent problem. Wedding videographers work in different traditions, and knowing the difference before you sign saves you from a beautiful film of someone else marriage.$old$, $new$You watch a few sample films, they all look stunning, and you book one — only to feel, months later, that the wedding video does not quite feel like your wedding. That mismatch is almost always a style problem, not a talent problem. Wedding videographers work in different traditions, and knowing the difference before you sign saves you from a beautiful film of someone else's marriage.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-videography-styles-philippines'
   AND position($old$You watch a few sample films, they all look stunning, and you book one — only to feel, months later, that the wedding video does not quite feel like your wedding. That mismatch is almost always a style problem, not a talent problem. Wedding videographers work in different traditions, and knowing the difference before you sign saves you from a beautiful film of someone else marriage.$old$ IN body) > 0;

-- ── wedding-wet-weather-contingency-plan ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$See how a free, self-updating planning checklist keeps your whole timeline honest, even when a date has to change.
setnayan.com/features$old$, $new$See how a free, self-updating planning checklist keeps your whole timeline honest, even when a date has to change.
setnayan.com/articles/what-to-do-12-months-before-your-philippine-wedding$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'wedding-wet-weather-contingency-plan'
   AND position($old$See how a free, self-updating planning checklist keeps your whole timeline honest, even when a date has to change.
setnayan.com/features$old$ IN body) > 0;

-- ── what-is-a-same-day-edit-sde-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$The magic of an SDE is timing, pure and simple. Your guests get to relive the morning they mostly did not witness — the bride in her robe, the groom steadying his nerves, the first look — while the emotion of the day is still fresh in the room. The reception gains a genuine showstopper that lifts the whole programme. And it hands you something to share the very night of the wedding, while everyone is still glowing and the comments are pouring in. For a celebration that is, at heart, a shared experience, that immediacy is very hard to match with a film you only receive months later.$old$, $new$The magic of an SDE is timing, pure and simple. Your guests get to relive the morning they mostly did not witness — the bride in her robe, the groom steadying his nerves, the first look — while the emotion of the day is still fresh in the room. The reception gains a genuine showstopper that lifts the whole programme. And it hands you something to share the very night of the wedding, while everyone is still glowing and the comments are pouring in. For a wedding that is, at heart, a shared experience, that immediacy is very hard to match with a film you only receive months later.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'what-is-a-same-day-edit-sde-wedding'
   AND position($old$The magic of an SDE is timing, pure and simple. Your guests get to relive the morning they mostly did not witness — the bride in her robe, the groom steadying his nerves, the first look — while the emotion of the day is still fresh in the room. The reception gains a genuine showstopper that lifts the whole programme. And it hands you something to share the very night of the wedding, while everyone is still glowing and the comments are pouring in. For a celebration that is, at heart, a shared experience, that immediacy is very hard to match with a film you only receive months later.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$• Worth it if a live reception highlight matters to you and the budget allows.
• Skippable if you would rather put that money toward fuller coverage or a longer final film.
• Confirm whether the SDE is in addition to, or instead of, your main highlight video.
• Ask to see two or three of the studio actual same-day edits before you commit.$old$, $new$• Worth it if a live reception highlight matters to you and the budget allows.
• Skippable if you would rather put that money toward fuller coverage or a longer final film.
• Confirm whether the SDE is in addition to, or instead of, your main highlight video.
• Ask to see two or three of the studio's actual same-day edits before you commit.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'what-is-a-same-day-edit-sde-wedding'
   AND position($old$• Worth it if a live reception highlight matters to you and the budget allows.
• Skippable if you would rather put that money toward fuller coverage or a longer final film.
• Confirm whether the SDE is in addition to, or instead of, your main highlight video.
• Ask to see two or three of the studio actual same-day edits before you commit.$old$ IN body) > 0;

-- ── what-zero-commission-means-for-couples ──
UPDATE public.creator_chapters
   SET title = $new$How Setnayan pricing works for hosts$new$, updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'what-zero-commission-means-for-couples'
   AND title = $old$What 0% commission means for couples and suppliers$old$;
UPDATE public.creator_chapters
   SET body = replace(body, $old$When you book a wedding supplier through a platform, it is fair to assume the platform makes its money somewhere. Often, that somewhere is a commission — a percentage taken from every booking. It is easy to miss because you rarely see it on the invoice, but it shapes prices all the same. We do something different: no commission on your bookings. To understand why that matters, it helps to see exactly how a commission works, and who quietly ends up paying for it.

How a commission quietly raises prices

Imagine a platform takes a cut of every booking it helps arrange. A supplier knows that a slice of whatever they charge will go to the platform, not to them. So to take home the fee they actually need, they nudge their price up to cover the cut. The couple sees that higher price and assumes it is simply the market rate. The commission never appears as a line item, but it is baked into the number all the same — a hidden markup that the couple pays and the supplier never keeps. Multiply that across every booking and it adds up to real money quietly moved off the table. The cruel part is that no one in the transaction feels good about it: the couple pays more than they should, the supplier earns less than their price suggests, and the only winner is the layer in the middle that did none of the work on the actual wedding.

“A commission is a cost nobody sees on the invoice and everybody pays in the price.”

What zero commission changes

With 0% commission, that whole layer simply disappears. We do not take a percentage of what you book, which means nothing is skimmed off the price you agree and the supplier has no reason to inflate it to cover a cut. The number you discuss with a supplier is the number between the two of you. Both sides come out ahead in a way that is easy to state plainly.

• Your payments to suppliers go straight to them, to their GCash or bank — that money never passes through Setnayan.
• Couples pay no hidden platform markup folded into the supplier’s price.
• The quoted price is the real price, set by the supplier and agreed with you.
• Suppliers can price competitively without padding for a commission they would otherwise lose.$old$, $new$When you book a wedding supplier through a platform, it is fair to wonder how the platform makes its money, and whether some of it is hidden inside the price you pay. On Setnayan the answer for hosts is short. Hosts pay 0% commission. Here is what that means for you, from the first quote to the last payment.

What you pay a supplier

The price you discuss with a supplier is the price between the two of you. Ask each supplier for an itemised quote, so you can compare what is included line by line, and agree the payment schedule in writing before you pay a reservation fee.

“The price you agree with a supplier is the price you pay them.”

• Your payments to suppliers go straight to them, to their GCash or bank — that money never passes through Setnayan.
• The quoted price is the real price, set by the supplier and agreed with you.
• Every payment you record lands in your budget, so you always know what is paid and what is still owed.

What you pay Setnayan

Planning on Setnayan is free: the checklist, guest list, budget and seating, plus a free Event Hub with online RSVP. Paid plans (Event Plus, Event Pro and Event Ultra) add optional extras for the day. Each one is priced at setnayan.com/pricing, so you can see what it adds before you choose.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'what-zero-commission-means-for-couples'
   AND position($old$When you book a wedding supplier through a platform, it is fair to assume the platform makes its money somewhere. Often, that somewhere is a commission — a percentage taken from every booking. It is easy to miss because you rarely see it on the invoice, but it shapes prices all the same. We do something different: no commission on your bookings. To understand why that matters, it helps to see exactly how a commission works, and who quietly ends up paying for it.

How a commission quietly raises prices

Imagine a platform takes a cut of every booking it helps arrange. A supplier knows that a slice of whatever they charge will go to the platform, not to them. So to take home the fee they actually need, they nudge their price up to cover the cut. The couple sees that higher price and assumes it is simply the market rate. The commission never appears as a line item, but it is baked into the number all the same — a hidden markup that the couple pays and the supplier never keeps. Multiply that across every booking and it adds up to real money quietly moved off the table. The cruel part is that no one in the transaction feels good about it: the couple pays more than they should, the supplier earns less than their price suggests, and the only winner is the layer in the middle that did none of the work on the actual wedding.

“A commission is a cost nobody sees on the invoice and everybody pays in the price.”

What zero commission changes

With 0% commission, that whole layer simply disappears. We do not take a percentage of what you book, which means nothing is skimmed off the price you agree and the supplier has no reason to inflate it to cover a cut. The number you discuss with a supplier is the number between the two of you. Both sides come out ahead in a way that is easy to state plainly.

• Your payments to suppliers go straight to them, to their GCash or bank — that money never passes through Setnayan.
• Couples pay no hidden platform markup folded into the supplier’s price.
• The quoted price is the real price, set by the supplier and agreed with you.
• Suppliers can price competitively without padding for a commission they would otherwise lose.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$A wedding economy works best when the couple and the supplier deal directly and fairly, with no invisible hand taking a slice in the middle. Suppliers — many of them small, family-run teams — keep what they earn, which lets them invest in their craft instead of in covering a fee. Couples get honest pricing they can actually compare, instead of numbers quietly inflated by a markup they cannot see. We earn our keep in other, transparent ways, so the booking itself can stay clean. It is a simpler arrangement, and a fairer one. It also keeps the relationship where it belongs — between you and the people actually doing the work. When no one is taking a cut of the deal, there is no pressure to route your payment a certain way or to nudge you toward whoever pays the platform the most. You choose the supplier you trust, and you settle on a price that is honest on both ends.

What suppliers do pay

No commission does not mean suppliers pay nothing, and we would rather say so plainly. Setnayan bills a supplier a booking fee on a booking, unless the supplier is the first to bring the event: a supplier who is the first to bring an event onto Setnayan — through their own invite, their own booking QR code or their own link — books it free, and a couple new to Setnayan through a supplier books them free. Every other booking carries the fee. The fee is charged to the supplier and is never added to what a couple pays. Suppliers can also choose an optional plan for a bigger shop; how far a supplier is found comes from getting Verified, not from the plan. The current rate is on the For Suppliers page.

Zero commission is not a discount or a promo — it is a structural choice. By refusing to take a cut of your bookings, we keep the hidden markup out of your price. What you negotiate is what you pay.

Browse suppliers and talk price directly, with no platform cut in the middle.
setnayan.com/?browse=1$old$, $new$A wedding works best when the couple and the supplier deal directly and fairly. It keeps the relationship where it belongs — between you and the people actually doing the work. You choose the supplier you want, and you settle on a price that is clear on both ends.

Browse suppliers and talk price directly.
setnayan.com/?browse=1$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'what-zero-commission-means-for-couples'
   AND position($old$A wedding economy works best when the couple and the supplier deal directly and fairly, with no invisible hand taking a slice in the middle. Suppliers — many of them small, family-run teams — keep what they earn, which lets them invest in their craft instead of in covering a fee. Couples get honest pricing they can actually compare, instead of numbers quietly inflated by a markup they cannot see. We earn our keep in other, transparent ways, so the booking itself can stay clean. It is a simpler arrangement, and a fairer one. It also keeps the relationship where it belongs — between you and the people actually doing the work. When no one is taking a cut of the deal, there is no pressure to route your payment a certain way or to nudge you toward whoever pays the platform the most. You choose the supplier you trust, and you settle on a price that is honest on both ends.

What suppliers do pay

No commission does not mean suppliers pay nothing, and we would rather say so plainly. Setnayan bills a supplier a booking fee on a booking, unless the supplier is the first to bring the event: a supplier who is the first to bring an event onto Setnayan — through their own invite, their own booking QR code or their own link — books it free, and a couple new to Setnayan through a supplier books them free. Every other booking carries the fee. The fee is charged to the supplier and is never added to what a couple pays. Suppliers can also choose an optional plan for a bigger shop; how far a supplier is found comes from getting Verified, not from the plan. The current rate is on the For Suppliers page.

Zero commission is not a discount or a promo — it is a structural choice. By refusing to take a cut of your bookings, we keep the hidden markup out of your price. What you negotiate is what you pay.

Browse suppliers and talk price directly, with no platform cut in the middle.
setnayan.com/?browse=1$old$ IN body) > 0;

-- ── who-pays-for-what-filipino-wedding ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$Older Filipino custom borrowed from Spanish-Catholic tradition, where the groom’s side carried much of the financial weight — a nod to the arrhae, the 13 coins the groom presents as a pledge to provide. The bride’s family often took on the attire and certain personal preparations, and principal sponsors, the ninong and ninang, were sometimes looked to for help with specific elements of the celebration. It was less a strict invoice and more a web of expectations passed down through generations — warm in spirit, but easy to misread today, when families are smaller, couples marry later, and almost no one assumes the old roles automatically anymore.$old$, $new$Older Filipino custom borrowed from Spanish-Catholic tradition, where the groom’s side carried much of the financial weight — a nod to the arrhae, the 13 coins the groom presents as a pledge to provide. The bride’s family often took on the attire and certain personal preparations, and principal sponsors, the ninong and ninang, were sometimes looked to for help with specific elements of the wedding. It was less a strict invoice and more a web of expectations passed down through generations — warm in spirit, but easy to misread today, when families are smaller, couples marry later, and almost no one assumes the old roles automatically anymore.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'who-pays-for-what-filipino-wedding'
   AND position($old$Older Filipino custom borrowed from Spanish-Catholic tradition, where the groom’s side carried much of the financial weight — a nod to the arrhae, the 13 coins the groom presents as a pledge to provide. The bride’s family often took on the attire and certain personal preparations, and principal sponsors, the ninong and ninang, were sometimes looked to for help with specific elements of the celebration. It was less a strict invoice and more a web of expectations passed down through generations — warm in spirit, but easy to misread today, when families are smaller, couples marry later, and almost no one assumes the old roles automatically anymore.$old$ IN body) > 0;

-- ── why-wedding-planning-should-be-free ──
UPDATE public.creator_chapters
   SET body = replace(body, $old$There is a clear line between the wedding itself and the act of organising it. Your venue, your caterer, your photographer — those have real costs, because real people and resources go into them. But a checklist that reminds you what to do twelve months out, a guest list that tracks RSVPs, a budget that tells you how much is left, a seating chart that sorts your tables — these are organising tools. They do not add to the celebration; they keep it from falling apart. They are the wedding-planning equivalent of pen and paper, and no one should have to rent the pen. Charging a couple for the ability to stay on top of their own plans turns a basic need into a paywall, and that never sat right with us. The couples most likely to need a clear budget and a tidy guest list are often the ones watching every peso most closely — exactly the people who should not be charged for staying organised.

“You should never have to pay for the privilege of keeping your own wedding organised.”$old$, $new$There is a clear line between the wedding itself and the act of organising it. Your venue, your caterer, your photographer — those have real costs, because real people and resources go into them. But a checklist that reminds you what to do twelve months out, a guest list that tracks RSVPs, a budget that tells you how much is left, a seating chart that sorts your tables — these are organising tools. They do not add to the wedding; they keep it from falling apart. They are the wedding-planning equivalent of pen and paper, and no one should have to rent the pen. Charging a couple for the ability to stay on top of their own plans turns a basic need into a paywall, and that never sat right with us. The couples most likely to need a clear budget and a tidy guest list are often the ones watching every peso most closely — exactly the people who should not be charged for staying organised.

“Paying for a venue makes sense. Paying just to stay organised does not.”$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'why-wedding-planning-should-be-free'
   AND position($old$There is a clear line between the wedding itself and the act of organising it. Your venue, your caterer, your photographer — those have real costs, because real people and resources go into them. But a checklist that reminds you what to do twelve months out, a guest list that tracks RSVPs, a budget that tells you how much is left, a seating chart that sorts your tables — these are organising tools. They do not add to the celebration; they keep it from falling apart. They are the wedding-planning equivalent of pen and paper, and no one should have to rent the pen. Charging a couple for the ability to stay on top of their own plans turns a basic need into a paywall, and that never sat right with us. The couples most likely to need a clear budget and a tidy guest list are often the ones watching every peso most closely — exactly the people who should not be charged for staying organised.

“You should never have to pay for the privilege of keeping your own wedding organised.”$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$When we say the planning workspace is free, we mean the everyday tools every couple needs, with nothing held back behind a trial or a subscription. You can run your whole plan through them from the day you get engaged to the day you say your vows, without a card on file.$old$, $new$When we say planning on Setnayan is free, we mean the everyday tools every couple needs. You can run your whole plan through them from the day you get engaged to the day you say your vows, without a card on file.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'why-wedding-planning-should-be-free'
   AND position($old$When we say the planning workspace is free, we mean the everyday tools every couple needs, with nothing held back behind a trial or a subscription. You can run your whole plan through them from the day you get engaged to the day you say your vows, without a card on file.$old$ IN body) > 0;
UPDATE public.creator_chapters
   SET body = replace(body, $old$Free is only sustainable if it is honest, so here is the plain version. The planning workspace stays free because it costs us very little to run for each couple, and because we would rather earn your trust early than charge you for the basics. There are optional extras a couple can choose to add — the kind of premium touches that go beyond plain planning — but you are never required to buy anything to organise your wedding from start to finish. The default is free, and it is a real default, not a teaser. There is no trial timer counting down and no card you must enter just to begin. The planning tools are free; Event Pro is there if you want the extras, and it is optional. You can plan your entire wedding without ever buying it, because the everyday tools are not the part we charge for.

Your wedding will ask enough of your savings without the planning tools adding to the bill. Keep your money for the celebration and the people in it; let the organising part be free, because it should be.$old$, $new$Free is only sustainable if it is honest, so here is the plain version. Planning on Setnayan is free: the checklist, guest list, budget and seating. It costs us very little to run for each couple, and we would rather earn your trust early than charge you for the basics. Paid plans (Event Plus, Event Pro and Event Ultra) add optional extras for the day — the kind of premium touches that go beyond plain planning. There is no trial timer counting down and no card you must enter just to begin. See what each plan adds at setnayan.com/pricing.

Your wedding will ask enough of your savings without the planning tools adding to the bill. Keep your money for the wedding and the people in it; let the organising part be free, because it should be.$new$), updated_at = now()
 WHERE is_journal IS TRUE AND slug = 'why-wedding-planning-should-be-free'
   AND position($old$Free is only sustainable if it is honest, so here is the plain version. The planning workspace stays free because it costs us very little to run for each couple, and because we would rather earn your trust early than charge you for the basics. There are optional extras a couple can choose to add — the kind of premium touches that go beyond plain planning — but you are never required to buy anything to organise your wedding from start to finish. The default is free, and it is a real default, not a teaser. There is no trial timer counting down and no card you must enter just to begin. The planning tools are free; Event Pro is there if you want the extras, and it is optional. You can plan your entire wedding without ever buying it, because the everyday tools are not the part we charge for.

Your wedding will ask enough of your savings without the planning tools adding to the bill. Keep your money for the celebration and the people in it; let the organising part be free, because it should be.$old$ IN body) > 0;

-- ── 2 · the test story leaves (P33 · L1 · L15) ──
UPDATE public.creator_chapters
   SET removed_at = now()
 WHERE slug = 'our-batanes-wedding-told-in-full'
   AND is_journal IS FALSE
   AND removed_at IS NULL;

COMMIT;
