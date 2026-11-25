-- ============================================================================
-- 📰 THE DECEMBER 2026 FEATURE ARTICLES — 14 posts, supplier features first
-- ============================================================================
-- ⛔ GENERATED — do not hand-edit. Source: apps/web/lib/articles-december-2026.ts. Regenerate:
-- (cd apps/web && npx tsx scripts/gen-december-articles.ts --write). lib/articles-december-2026.test.ts fails when
-- this file and the source differ.
--
-- Owner 2026-11-24: "supplier posts to december appoved" (Batch 1) and "our first goal is to have posts that
-- promotes to suppliers on facebook". Each post is a Journal article (is_journal, the internal account, text and
-- links only), published with a FUTURE date: onlyPublicArticles and RLS keep it hidden until 08:00 Manila on its
-- day (2026-12-01 → 2026-12-31). The Articles → Facebook sweep teases each one once.
-- If there is no internal account (a fresh replay), NOTHING is inserted.
-- Re-runnable: ON CONFLICT (slug) DO NOTHING — a second apply, or a slug already taken, changes nothing.
-- ============================================================================

DO $december$
DECLARE
  v_owner UUID;
BEGIN
  SELECT u.user_id INTO v_owner
    FROM public.users u
   WHERE u.is_internal = TRUE
   ORDER BY u.created_at
   LIMIT 1;

  IF v_owner IS NULL THEN
    RAISE NOTICE 'december articles: no internal account — nothing inserted';
    RETURN;
  END IF;

  INSERT INTO public.creator_chapters
    (user_id, kind, is_journal, slug, title, body, status, published_at, tags, created_at, updated_at)
  SELECT v_owner, 'wedding', TRUE, r.slug, r.title, r.body, 'published', r.published_at, r.tags, now(), now()
    FROM (VALUES
    ($d0$quotes-payment-plans-and-dates-in-one-chat$d0$, $d1$Quotes, payment plans and dates, all in one chat$d1$,
     $d2$Scroll up in your Messenger. Somewhere in there is the quote you sent in March. And the revised one in April. The screenshot of the GCash receipt. The voice note that said "sige po, 150 pax na lang."

Now find which one the couple agreed to.

Every supplier knows that scroll. Setnayan's chat was built so you never have to do it again.

One chat per couple, with everything inside

When a couple inquires, you talk in one chat on Setnayan. Same as messaging, pero ang pinagkaiba: the business lives inside it.

Tap the (+) and you can:

• Make a quote. It sits in the chat as a card, with your line items and total.
• Drop an offer. A limited deal, right where the couple is reading.
• Set a payment plan. Reservation fee, then the balance in parts, with dates.
• Send dates and times. For a tasting, an ocular, a fitting, the call time.
• Share photos and files. Mood shots, floor plans, the menu.
• Ask for a decision or run a poll. "Chicken or fish for the kids' table?"

Every version of a quote is kept. You can open them all, so nobody argues about what was agreed.

The quote is the deal

Only you can edit your quote. The couple can't change your numbers.

When they're ready, they lock the deal from the chat. You agree, and it becomes the booking. The payment plan always adds up to the whole amount, so nothing goes missing between "reservation" and "full payment."

After booking, the chat keeps working. Ask for a payment when it's due. Send a form for the final details. Share the handover when the work is delivered.

Why this matters to your business

Deals that live in one chat don't fall apart in the handover between apps. You see who agreed to what, when, and what's still owed.

Your Facebook page stays your storefront. It's where couples discover your work. Setnayan is where the quote, the booking and the paperwork happen.

Your client list, chats and payments are yours.

What couples feel

Couples feel it too. Instead of scrolling through threads, they see your quote, your plan and their next payment, in one place.

When they share the chat with a coordinator, the coordinator sees the same thing. Walang "ano nga ulit yung napag-usapan?"

What you need to start

Open your shop. It's free. Chat tools open once your shop is verified: three papers, and a person checks them.

While you wait for verification, set up your service cards and bring your own clients in. When your papers come through, your quotes are ready to go.

Open your shop and try the chat
setnayan.com/for-suppliers$d2$,
     '2026-12-01 08:00:00+08'::timestamptz, ARRAY['suppliers', 'chat', 'business']::text[]),
    ($d3$you-pay-only-for-the-clients-we-bring$d3$, $d4$You pay only for the clients we bring you$d4$,
     $d5$You built your client list one referral at a time. A tita's recommendation. A couple who saw your work at a cousin's wedding. A follower who finally messaged.

Those clients are yours. Hindi mo sila utang kanino man.

So when a platform asks for a cut of every booking, even the ones you brought in yourself, it stings. Setnayan was built so that never happens.

The clients you bring stay yours

Open your shop, then bring your clients in. Share your shop link, your QR code, or invite a couple straight to their own event.

When a couple you brought books you, there is no booking fee. Not a reduced one. None.

Two things make that work. Your shop is Verified, and your link carries a Setnayan gift for the couple. The gift is something you hand them, like photo credits for their guests.

Not verified yet? You can still open today and bring clients in. Get verified to qualify for free bookings from your QR.

You pay only when we bring the couple

For a Verified shop, the booking fee applies only when Setnayan brings you the couple. They found you in Find, saw your service card, and booked you without you ever posting a single ad.

That is the one moment we charge, because that is the one moment we added something you did not already have.

• Clients you bring: no fee, once you're Verified and your link carries a gift.
• Clients Setnayan brings: a percentage of the booking, and the rate drops on bigger bookings.
• There is a ceiling. The fee never goes above it, however big the booking.

The current rates, with worked examples, are on the For Suppliers page. We keep them there so you always read the real number.

Your couple never sees it

The fee is between you and Setnayan. It is never added to your couple's bill and never shown on their side.

Your price is your price. The couple pays you directly, to your own GCash, Maya or bank. Setnayan does not hold the money between you.

Who counts as "first"

Sometimes two suppliers know the same couple. The rule is simple: the supplier who brings the couple in first is the one whose booking is free.

If a couple is new to Setnayan because of you, they book you with no fee. If they were already planning here when they found you, the fee applies.

Why we built it this way

A Facebook page is a great storefront. Most suppliers already have one. What it can't do is hold the quote, the payment plan, the schedule and the review in one place.

That is what your Setnayan shop is for. We charge for what we add, never for what you already had.

Try it with no risk

Opening a shop is free. No card needed. You can leave anytime from your Profile.

Bring three of your current clients in this week. Send them quotes in chat. See how it feels when the paperwork lives in one place.

Read the rates and open your shop
setnayan.com/for-suppliers$d5$,
     '2026-12-03 08:00:00+08'::timestamptz, ARRAY['suppliers', 'business', 'pricing']::text[]),
    ($d6$one-service-card-that-answers-for-you$d6$, $d7$One service card that answers before you do$d7$,
     $d8$"Available pa po ba kayo on the 19th? Magkano for 120 pax? Malayo ba kayo sa Makati?"

You answer those three questions every day. Sometimes at 11 at night, between two events. And half the time the date is already taken.

A Setnayan service card answers all three before the couple even messages you.

One card, shown everywhere

You make a service card once. Your plated dinner. Your bridal hair and make-up. Your same-day edit.

That one card is what couples see in Find, on your shop page, and when they compare suppliers side by side. Change it once and it changes everywhere.

It already knows their event

Here's the part that feels like magic. When a couple is planning on Setnayan, their date, their venue and their guest count are already saved.

So your card reads their event and adapts.

• Their date. If you're booked on Sat 19 Dec, your card steps aside for that couple. They never message you for a date you can't take.
• Their guest count. They invite 120 guests, so your card shows your price for 120, by itself. No "PM for rates."
• Their venue. Your card shows how far you are from their venue in Makati, Tagaytay or Quezon City.

The couple who does message you already knows you're free, roughly what you cost, and that you can get there.

Badges you earn, on every card

Your card carries the badges you've earned, like completed bookings. They show on the card, so a couple sees your track record before they tap.

Badges are earned on Setnayan. They are never bought. And reviews come only from completed bookings, so a shop can't review itself.

Start with one card

You don't need a full catalogue on day one. Open your shop, then make your first service card. It's free.

Most suppliers start with their best-selling package. Add a few photos from real events, set your price per guest or per event, and set how far you travel.

Cards for every kind of service

Caterers price per guest. Photographers price per event. Stylists often price by package. Your card can be set the way you actually sell.

Make one card per thing a couple can book: your plated dinner, your buffet, your dessert table. Each one carries your badges and shows in Find once you're Verified.

What changes for you

Fewer "hm po?" messages. Fewer chats about dates you can't do. More chats with couples who already fit.

You still talk to every couple yourself. The card just does the first three answers for you.

See a card adapt to a couple's date, guests and venue
setnayan.com/for-suppliers$d8$,
     '2026-12-05 08:00:00+08'::timestamptz, ARRAY['suppliers', 'service cards', 'business']::text[]),
    ($d9$badges-you-earn-never-buy$d9$, $d10$Badges you earn, never buy$d10$,
     $d11$You've done 200 weddings. Your couples cried at your same-day edit. Their titas still message you for referrals.

And yet a new page with 10,000 bought likes looks bigger than you online.

That never sat right. On Setnayan, you look good by actually being good.

Badges, each one earned

Every Setnayan shop can earn these badges. Each one climbs from Bronze up to Black Diamond as you keep doing the work.

• Completed bookings. For events you actually finished, not inquiries.
• Five-star reviews. From couples whose booking was completed.
• Gifts given. For the Setnayan gifts you hand your couples.
• Trusted by. For clients who come back and book you again.
• Invites. For suppliers you bring onto Setnayan, counted once they finish their own first event.

No badge can be bought. Not with a plan, not with an ad, not with anything.

Reviews only from real bookings

A review on Setnayan comes only from a completed booking. A shop can't review itself. A friend who never hired you can't leave five stars.

So when a couple reads your reviews, they're reading people who actually paid you and saw your work on the day.

"No fake reviews. No paid stars. Ever." That line is on our front page, and we hold ourselves to it.

Where your badges show

Your badges travel with you:

• on every service card a couple sees in Find,
• on your shop page,
• on your printed calling cards, standees and tarps from Shop › Promote.

The couple sees your track record before they even tap.

The Verified seal

Before any badge, there's Verified. You send three papers: your DTI or SEC registration, your BIR 2303, and your Mayor's or Business Permit. A person checks them.

Once Verified, couples can find you in Find, and your shop carries the seal.

Why earned badges help small shops

Big studios have big ad budgets. Family-run caterers and solo photographers don't.

Earned badges level that. A small shop that finishes every event well, gets real five-star reviews and keeps its repeat clients will show that on every card. Walang shortcut, pero walang pader din.

How to start earning

Open your shop. Get Verified. Bring your current clients in and book them through Setnayan, so their completed events and reviews count toward your badges.

Your first badge comes from your first completed booking.

Open your shop and start earning
setnayan.com/for-suppliers$d11$,
     '2026-12-08 08:00:00+08'::timestamptz, ARRAY['suppliers', 'badges', 'reviews']::text[]),
    ($d12$find-build-and-compare-your-supplier-team$d12$, $d13$Find, build and compare your supplier team$d13$,
     $d14$Twelve tabs open. Three Facebook pages, two price lists in PDF, one cousin's recommendation in a Viber thread. And still you don't know: are they even free on your date?

Choosing suppliers feels like a second job. Setnayan turns it into one calm screen.

Find: only the ones who fit

Your event already knows your date, your venue and your guest count. So when you open Find, it shows suppliers who fit.

Suppliers who are full on your date don't show. Cards for per-guest services show the price for your guest count. When your venue is pinned, each card shows roughly how far that supplier is.

At the top of Find sits your inspiration board, with the mood board you made for your event. Keep it open while you browse, so you remember the look you're going for.

Build: put a whole team together

Build is where Find turns into a plan. Pick a venue, a caterer, a photographer, a host, and Build puts them together into a plan that fits your budget, date and guest count.

You see the total as you go. Swap the photographer, and the total moves. Try a smaller venue, and see what it frees up.

Each pick has its own "Ask to book", so you talk to each supplier when you're ready, not all at once.

Compare: side by side

Torn between two caterers? Save both, then open Compare and see them side by side.

You can also save two whole builds, a garden plan and a ballroom plan, and compare them. Kita mo agad kung alin ang kaya.

Talk and book in one place

When you're ready, ask to book. The supplier answers in one chat on Setnayan, with the quote, the payment plan and the dates inside it.

You pay suppliers directly. Hosts pay 0% commission.

Badges that mean something

Every supplier card carries badges the shop earned: completed bookings, five-star reviews, repeat clients. Reviews come only from completed bookings.

A verified shop has sent its business papers, and a person checked them.

Tips for a calmer search

• Set your date, venue and guest count first. Find works best when it knows them.
• Save more than you need. Three caterers, two photographers. Narrow down later.
• Read reviews for the details, not just the stars. Did they arrive on time? Was the food warm?
• Ask to book only when you're ready to talk money. One chat per supplier keeps it clean.

Planning is free

Find, Build and Compare are part of free planning on Setnayan. Start your event, set your date, venue and guests, and the suppliers who fit come to you.

See how Find works
setnayan.com/features/suppliers$d14$,
     '2026-12-10 08:00:00+08'::timestamptz, ARRAY['planning', 'suppliers', 'budget']::text[]),
    ($d15$bring-your-favorite-suppliers-with-you$d15$, $d16$Bring the suppliers you always recommend$d16$,
     $d17$Every supplier has a barkada at work. The coordinator who always calls you first. The lights and sound team that never lets you down. The make-up artist you send every bride to.

You already refer each other. Couples already trust your word.

On Setnayan, that circle becomes part of your shop.

Invite a supplier

In Shop › Partnerships, tap Invite a supplier. You get a QR code and a link to share.

When your friend opens it, they see that you invited them. They can make a free shop in a few answers, or link the shop they already have.

Joining makes you partners at once. They show on your shop page as your partner, and you show on theirs.

Partners on your shop page

Couples who land on your page see your partners in one section. A couple who books your catering can find the stylist you recommend in one tap.

That's how referrals already work in real life. Now they're visible, and they're connected to real shops with real reviews.

You can also add a shop that's already on Setnayan, without an invite.

See who joined through you

Your Partnerships page shows how many suppliers joined through your link. Simple.

It earns you a badge

Invites is one of the badges a shop can earn. Each supplier you bring counts once they finish their own first completed event on Setnayan.

Like every badge, it climbs from Bronze toward Black Diamond as you keep going. And like every badge, it can't be bought.

Why bring them

A couple planning an event needs eight, ten, twelve suppliers. When your partners are on Setnayan too, the couple builds a team you already work well with.

Fewer surprises on the day. Fewer "sino po yung contact ng lights niyo?" messages. And the event goes the way you know it can.

What your partners get

The supplier you invite gets the same free shop you have. Service cards that read a couple's date, guests and venue. One chat for quotes and payment plans. A calendar couples can check.

And they start with a partner on day one: you.

Start with three

Think of the three suppliers you refer most. Open Shop › Partnerships, add each one, and send them your invite link today. It takes a minute each.

Haven't opened your own shop yet? Start there. It's free.

Open your shop and invite your partners
setnayan.com/for-suppliers$d17$,
     '2026-12-12 08:00:00+08'::timestamptz, ARRAY['suppliers', 'partners', 'referrals']::text[]),
    ($d18$a-gift-you-hand-your-couple$d18$, $d19$A gift you hand your couple, in your shop's name$d19$,
     $d20$The best suppliers remember the small things. The extra tray of lumpia. The bouquet toss photo you edited first because you knew Lola would ask.

Couples remember those moments longer than the package price.

On Setnayan, every booking comes with one more of those moments: a gift you hand your couple, wrapped in your shop's name.

What the couple sees

When you agree to a booking, you pick the gift. It shows on the couple's quote with your shop's name on it, and it waits in their event like a wrapped box.

"A gift from Sampaguita Table." "A gift from Casa Lirio Catering." Not from Setnayan. From you.

Something you could not offer alone

A caterer can't hand a couple a photo album for all their guests. A make-up artist can't hand them an Event Hub with every theme.

With the Setnayan gift, you can. You choose what to give, from small to generous:

• Papic credits. Photo credits so their guests can shoot the day on their own phones, straight into one album.
• Event Plus. Their Event Hub with every theme and a cinematic Save the Date, plus Papic credits.
• Event Pro. Everything in Event Plus, with their own photos and video, Setnayan AI, more Papic credits, and no Setnayan mark.
• Event Ultra. For the couples you want to spoil.

The price of each gift is on the For Suppliers page, read from our live price table.

How it works with your clients

Every booking includes at least one gift. You buy gifts ahead into your shop's stock, and you pick one for each couple when you agree to their booking. Nothing is added to your fee.

Every gift you give also counts toward your Gifts given badge.

For the clients you bring yourself, the gift is also what makes the booking free of any Setnayan fee, once your shop is Verified. Add a gift to your link, share it, and your own clients book you free.

Why couples love it

Planning an event is mostly spending. Deposits, balances, receipts.

A gift in the middle of all that feels different. It tells the couple, "We're in this with you." And it tells their guests, every time they open the album, who made that possible.

Why it's good for business

Every guest who shoots on Papic sees the event they're part of. Every Event Hub you gift carries the couple's day to their whole guest list.

That's a lot of people meeting your shop at the happiest moment of someone's year. Mas maganda pa sa flyer.

Pick your first gift

Open your shop, verify your papers, and pick the gift you want to hand your couples. Start small. You can change it anytime.

See the gifts and their prices
setnayan.com/for-suppliers$d20$,
     '2026-12-15 08:00:00+08'::timestamptz, ARRAY['suppliers', 'gifts', 'business']::text[]),
    ($d21$your-qr-on-every-table-tarp-and-calling-card$d21$, $d22$Your QR on every tarp, standee and calling card$d22$,
     $d23$Bridal fair, Sunday afternoon. A couple stops at your booth, smiles at your sample album, takes your calling card, and walks on.

Will they remember you by Wednesday? Maybe. Will they find the card? Probably not.

A Setnayan QR on that card changes the ending. One scan, and your shop is on their phone, with your dates already checked.

Your shop, in one code

Every Setnayan shop gets its own QR codes. You pick what each one opens:

• Check a date. The couple taps their date and sees right away if you're free.
• Shortlist. They save you to their event, so you're there when they compare.
• My page. Your full shop: services, photos, reviews, badges.
• Reviews. Only on prints. Hand it to a happy client after the event.

No need to type a link, spell your page name, or search Facebook for the right account.

Print-ready pieces, made from your shop

Go to Shop › Promote. Your prints are already laid out, using your logo, tagline, services and the badges you've earned.

• Calling card. Front and back, 8 to a sheet.
• A5 mini standee. For your welcome table or reception desk.
• Door print. "We are part of Setnayan," for your office door or window.
• Booth backdrop. A big QR people can scan from a few steps away.
• Booth or office tarp. Your name, your line, your QR.
• Roll-up banner. Stands beside your table at expos.
• Table-front. Hangs on the table edge at waist height.

Choose a look that fits your trade. Ink & gold for weddings and venues. Sage linen for garden events and florists. Fiesta for kids' parties. Jet mono for photo and video. There are more.

Nothing to design, nothing to retype

You don't upload anything or move anything around. A print changes only its look. The facts come from your shop.

Update a service or earn a new badge, and your next print carries it. Save the file, bring it to your usual printer, done.

Where suppliers put them

• At expos and bridal fairs, on the backdrop and the table-front.
• On the dessert table or the photo booth at an event you're working, so guests who love your work can find you.
• In your office window, so walk-ins can check a date after hours.
• Inside every calling card you hand out.

Every scan lands on your own shop. And clients who come in through your own QR are yours.

Start with your card

Open your shop, then go to Shop › Promote. Your calling card is the easiest first print. Bring a stack to your next event.

Open your shop and get your QR
setnayan.com/for-suppliers$d23$,
     '2026-12-17 08:00:00+08'::timestamptz, ARRAY['suppliers', 'prints', 'marketing']::text[]),
    ($d24$a-shop-page-that-works-while-you-work$d24$, $d25$A shop page that works while you're at an event$d25$,
     $d26$Saturday, 3 pm. You're mid-setup at a reception in Tagaytay, hands full of flowers. Your phone buzzes four times. "Available po kayo sa March 6?" "Magkano po?" "Saan po kayo located?" "Hello po??"

By the time you answer at midnight, two of them have booked someone else.

Your Setnayan shop page answers those four questions while you work.

One address for your business

Your shop gets its own Setnayan address, with your shop's name in it. Put it in your Facebook bio, your Instagram, your calling card.

On it, couples see:

• your cover photos and your name,
• how long you've been in business and how long you've been on Setnayan,
• the area you serve,
• your services and pricing, with "Add to quote",
• your portfolio and your inspiration photos,
• your reviews, which come only from completed bookings,
• your awards and badges, like the Verified seal.

Check a date, right there

The question you hear most is "Free pa po ba kayo?" Your shop page has a real calendar. A couple taps Check a date and sees right away if you're open.

Your evenings go to couples who can actually book you.

Inquire, or add you to their event

When a couple likes what they see, they can inquire, and the message lands in your Setnayan inbox. Or they add you to their event, so you're on their shortlist when they compare.

The page tells them plainly: replies come in your Setnayan inbox.

Your partners, on your page

Every good supplier has a circle: the coordinator you trust, the florist you always recommend. Your shop shows them as your partners, so couples can find your whole team in one tap.

Why it beats a link tree

A link tree sends couples to five places. Your shop page keeps them in one, and every inquiry, quote and booking that starts there stays with you.

Your Facebook page is still your storefront for attention. Your shop page is where they decide.

Make it yours

A few small things make a shop page work harder:

• Put your best five photos first. Real events, real light.
• Write your About in your own voice. Who you are, since when, what you love doing.
• Set your area. Couples see how far you are from their venue.
• Add every service you sell, even the small add-ons. Couples like to build their own quote.

Open yours in three answers

Opening a shop takes three answers: your shop name, your page address and your main service. It's free, and no card is needed.

Add your first service card, then share your link with the next couple who asks "magkano po?"

Open your shop
setnayan.com/open-shop$d26$,
     '2026-12-19 08:00:00+08'::timestamptz, ARRAY['suppliers', 'shop', 'business']::text[]),
    ($d27$every-guest-phone-becomes-your-camera$d27$, $d28$Every guest's phone becomes your camera$d28$,
     $d29$Your photographer caught the vows, the first dance and the grand entrance. Beautiful.

But who caught Lolo dancing the cha-cha with your bestfriend? Your pamangkin asleep on two chairs? The titas singing "Dancing Queen" at table 6?

Your guests did. On 150 different phones. And most of those photos never reach you.

Let your photographers take the grandest moments

Papic doesn't replace your photographer. It catches everything around them.

Let your photographers take the grandest moments. Let Papic take the precious ones.

Point, shoot, done

Guests don't install anything. They don't make an account.

They scan the code on their table sign or place card, and their phone becomes a Papic camera inside the browser. They shoot photos or short Snippets, and every shot lands in one album: yours.

No Google Drive link that half the guests forget. No "pa-send naman ng pics" the week after.

It works with no signal

Venues in the Philippines and signal don't always get along. Garden in Tagaytay, function hall in the basement, resort in Batangas.

Papic saves every shot on the phone first and sends it when the signal comes back. Nothing gets lost because the bars dropped.

Photos that find their people

After the event, your Event Hub moves to its Post Event stage. Guests tap "Were you there?" and add a selfie, and Papic finds the photos they're in.

A guest who never adds a selfie is never matched. And a guest who doesn't want to be seen at all can turn on FaceBlock: their face is blurred in every photo, everywhere.

You, the host, get every photo.

Kept for life

Every photo lands in your Memories. Full-size originals are kept 3 months after the event, longer on Event Pro and Event Ultra. After that, a 720p copy is kept for life. Your debut, your wedding, your son's christening, one page.

How credits work

Each photo uses a Papic credit. Your first event comes with free credits to get you started. More come in Papic packs, and every paid event plan includes credits too.

Your suppliers can also hand you Papic credits as their gift with your booking.

Prices are on the pricing page, read from our live price table.

Set it up in two minutes

Open your event, turn on Papic, and print the codes on your table signs or place cards. On the day, guests do the rest.

See how Papic works
setnayan.com/features/papic$d29$,
     '2026-12-22 08:00:00+08'::timestamptz, ARRAY['papic', 'photos', 'the day']::text[]),
    ($d30$walk-your-reception-before-the-day$d30$, $d31$Walk your reception in 3D before the day$d31$,
     $d32$Ilang gabi na kayong nakaupo sa sahig, may papel at ballpen, nililipat-lipat ang pangalan ni Tita Baby. Table 4? Table 7? Basta malayo kay Tito Ramon.

Then one RSVP changes and the whole plan moves again.

The seat plan is where family diplomacy meets arithmetic. Setnayan makes it the easy part.

Start with one guest list

Everything starts from your guest list. Add guests by typing them in, by uploading a file, or by sharing an invite link so families add themselves.

Group them the way you already think: Bride's side, Groom's side, ninongs and ninangs, the barkada, office friends. The list has no guest limit.

As guests reply, your count updates by itself. That same number feeds your seat plan, so you're never seating someone who said no.

Lay out your tables in 2D

Draw your reception the way it really looks. Round tables, long tables, the couple's table, the stage.

Then seat people. Drag a name to a table. Or let Auto Arrange do a first pass and fix only what matters.

Add keep-apart rules for the two titas who shouldn't share a lechon. The plan respects them.

Then walk it in 3D

This is the part families love. Open the 3D walk-through and see the room from a guest's eye.

Can Lola see the stage from Table 9? Is the ninang table too far from the couple? Is the entrance crowded?

You'll know before the day, not during it.

Guests find their own seat

On the day, every guest opens their own Event Hub link and taps Find my seat. They see their table on a 2D map, or walk to it in 3D.

No crowd at the seating chart. No one asking the coordinator where they belong.

If you want, you can show guests their seats early. Or keep it a surprise until the day.

The prints come with it

From the same plan you can print table signs, place cards and an entrance chart. Your caterer gets a meal count report by table.

Change a seat, and the next print carries it. Nobody works from an old version.

What you're spared

The paper plan you redraw five times. The group chat asking "san ako uupo?" The awkward moment when the principal sponsors are seated at the back.

Planning on Setnayan is free, and the guest list, seat plan and 3D walk-through are part of it.

See how the seat plan works
setnayan.com/features/seat-plan$d32$,
     '2026-12-24 08:00:00+08'::timestamptz, ARRAY['planning', 'seating', 'guests']::text[]),
    ($d33$family-abroad-can-watch-from-your-event-hub$d33$, $d34$Family abroad can watch, right from your Event Hub$d34$,
     $d35$Your Tita in Dubai has a 2 am shift. Your Kuya in Toronto can't get leave. Lola in California watched you grow up through a laptop screen.

They should see you walk down the aisle, or dance your 18 roses, as it happens.

With Setnayan, they watch from the same link every other guest already has.

The link they already have

Every guest gets one Event Hub link. Family abroad get the same one.

On the day, the Event Hub moves to its The Day stage, and the live video sits right there. No new app to download. No "anong Zoom link ulit?"

One camera comes with every event

Every Setnayan event comes with one camera: yours. Use your own phone or device to stream the ceremony to your Event Hub.

Set it on a tripod near the aisle. Ask a cousin to hold it during the program. That's it.

For a lot of families, that one view is everything. Lola sees the vows. Tita sees the first dance.

Live Watch, for a bigger broadcast

Want something closer to a real broadcast? Live Watch streams your event to your Event Hub through a private, unlisted YouTube broadcast.

You run it from one laptop with streaming software, so your videographer or a techie cousin can mix in a proper camera feed. Your guests and family still watch from the same Event Hub link.

Live Watch is a paid add-on. Its price is on the pricing page, read from our live price table.

Watching together, from far away

Family abroad don't just watch. The Event Hub is their way into the whole day: the schedule, the program, who's in the entourage.

After the event, they see the photos guests shot on Papic and the post-event story, from the same link.

What to set up before the day

• Test your camera the night before, at the venue if you can.
• Tell family abroad the time in their time zone.
• Put one person in charge of the stream, so the couple or the debutante never has to think about it.
• If signal at the venue is weak, ask the venue for Wi-Fi or bring a pocket Wi-Fi.

Bring everyone in

Some of the people you love most won't be in the room. With one link, they can still be part of it, from the first song to the last dance.

See how Live Watch works
setnayan.com/features/live-watch$d35$,
     '2026-12-26 08:00:00+08'::timestamptz, ARRAY['live watch', 'family abroad', 'the day']::text[]),
    ($d36$one-theme-for-your-event-hub-and-every-print$d36$, $d37$One theme for your Event Hub and every print$d37$,
     $d38$You picked dusty rose and gold. Your invitation is dusty rose and gold. Then the seating chart comes out in a different font, the menu card in a different pink, and the welcome sign looks like it came from another event.

Matching everything by hand takes weeks. Or a designer you didn't budget for.

On Setnayan, you choose one theme, and everything wears it.

One theme, everywhere

Pick a theme for your event. Your Event Hub wears it, the page every guest opens. Your prints wear it too.

Change the theme, and the next print follows. Nothing to match by hand.

The themes

Classic, Modern and Cyber Neon come with every event.

A paid event plan opens the rest: Rustic, Cinderella, Luxe, Vintage, Regency, Great Gatsby, Whimsical and more.

From a garden wedding to a neon 18th birthday, there's a look that fits.

What you can print

From the same event, with the same theme:

• the invitation, the entourage and the program,
• the menu,
• guest passes, styled as a calling card, a train ticket, a boarding pass or a phone card,
• posters and an event card,
• guest QR sheets, twelve to a page, for Papic,
• the seating pack and an entrance chart,
• a report for your caterer.

Any single piece is free to print. A paid plan adds "Download all" for the whole set at once.

The facts fill themselves in

Your names, date, venue, entourage and tables come from your event. You don't retype them on every piece.

Move a guest to another table, and the next seating print carries it. Add a ninang to the entourage, and the next entourage card has her.

That also means fewer typos. The spelling of Tita Marivic's name is fixed once, in your guest list, and every print uses it.

Your Mood Board, too

Made a Mood Board? Its palette dresses your Event Hub and your prints, so the colours you chose at the start carry through to the day.

For every kind of event

A debut can go Cinderella. A 1st birthday can go Whimsical. A company anniversary can go Modern. A golden wedding anniversary can go Vintage.

The theme carries the mood. Your names, the date and the details stay yours.

Print anywhere

Save the files and bring them to your usual printer, or print at home. Ang ganda na, consistent pa.

See what you can print
setnayan.com/features/prints$d38$,
     '2026-12-29 08:00:00+08'::timestamptz, ARRAY['design', 'prints', 'event hub']::text[]),
    ($d39$a-planner-that-watches-your-plan$d39$, $d40$Setnayan AI: a planner that watches your plan$d40$,
     $d41$Three weeks before the event, at 11 pm, it hits you. Did we pay the second tranche to the caterer? Is the photographer's call time before or after the bride's make-up? Are we already over budget?

You don't need another app asking you questions. You need someone who reminds you before it's a problem.

That's Setnayan AI.

Not a chatbot. A planner.

Setnayan AI doesn't wait for you to ask. It reads what you already entered for your event: the type, the date, your budget, your guests and the place.

Then it does two things.

It suggests your best-fit team

First, it suggests a team of verified suppliers who fit your event. Picked by how well they fit, never cheapest first.

You still choose. You still talk to each supplier yourself. It just gives you a strong starting team, so you're not scrolling for hours.

Then it watches

Second, it keeps watching your plan in the background:

• It flags a payment before it's due.
• It warns you before you go over budget.
• It warns you when two things clash on the day.

And it tells you the one thing to do next. Not a list of forty.

A day in the life

Monday morning, you open your event. Setnayan AI has one line for you: the photographer's next payment is due Friday.

Wednesday, you add twenty guests. It notices the caterer's quote was for fewer and tells you before the final headcount is due.

Two weeks out, it sees the make-up artist's call time overlaps with the church's. You fix it in a minute, not on the morning itself.

What stays free

Every supplier card in Find shows a match score for your event, and that stays free for everyone. Planning on Setnayan stays free too: your guest list, seat plan, budget, schedule and Event Hub.

Setnayan AI adds the watching.

How to get it

Setnayan AI comes with Event Pro and Event Ultra. You can also add it on its own for one event. Prices are on the pricing page, read from our live price table.

Who it's for

Busy hosts who would rather be told than check. Families planning from two cities. A debutante's parents who are also running a business. Anyone who wants a team picked by fit and a quiet voice that says, "This one's due Friday."

See what Setnayan AI does
setnayan.com/features/setnayan-ai$d41$,
     '2026-12-31 08:00:00+08'::timestamptz, ARRAY['planning', 'setnayan ai', 'suppliers']::text[])
    ) AS r(slug, title, body, published_at, tags)
  ON CONFLICT (slug) WHERE slug IS NOT NULL DO NOTHING;
END
$december$;
