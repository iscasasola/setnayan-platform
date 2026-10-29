import { papicPointCurrencyTerms } from '@/lib/papic-tier-copy';
import { slugForwardingLabel } from '@/lib/slug-forwarding-window';
import { FIRST_BOOKING_ON_US } from '@/lib/booking-fee-lock';
import { mobileAppAnswer, mobileAppAnswerInApp } from '@/lib/where-setnayan-runs';
import { PAPIC_FREE_CREDIT_CONDITION } from '@/lib/papic-free-credit-promise';
import { DAY_OF_ENDS_PLAIN, DAY_OF_STARTS_PLAIN } from '@/lib/day-of-window-words';
import { REFUND_REPORT_WINDOW_DAYS } from '@/lib/rule-constants';

/**
 * The Papic shot currency, DERIVED — `papicPointCurrencyTerms()` interpolates
 * PAPIC_POINTS_PER_PHOTO / PAPIC_POINTS_PER_SNIPPET from the capture path itself
 * (lib/papic-cameras.ts). The clip weight moved 7 → 8 on 2026-07-29; help prose
 * that had typed the number would have gone quietly wrong that day, on the one
 * surface a confused couple reads. `papic-tier-copy` is pure + client-safe, so
 * this import adds nothing to any bundle beyond two strings.
 */
const SHOT_TERMS = papicPointCurrencyTerms();

/**
 * WHO A PUBLIC HELP TOPIC IS FOR. ⛔ There is deliberately no team/admin value:
 * the operations guides live in lib/help-admin.ts, which no public route may
 * import (sweep 2026-10-19 B3 — see that file). A role filter is not a wall;
 * a missing type member is.
 */
export type HelpRole = 'couple' | 'vendor' | 'guest';

/** Every audience the public help may address — the guard iterates this. */
export const PUBLIC_HELP_ROLES: ReadonlyArray<HelpRole> = ['couple', 'vendor', 'guest'];

export type HelpArticle = {
  slug: string;
  title: string;
  body: string;
  /**
   * 🍎 WHAT THE IPHONE APP SAYS INSTEAD (Apple check 2026-10-19, rows #6 · #14
   * — guideline 3.1.1 / 2.3.10). Present only where `body` points a reader at
   * the web to buy ("current rate on setnayan.com/pricing", "a one-time
   * purchase that unlocks", "Everything you buy goes into one pot"), names
   * Android or the desktop app, or walks a couple through a part the app does
   * not include. It says what the feature DOES, with no price, purchase or
   * pointer — or, where the whole answer is a part the app does not include,
   * it is `HELP_NOT_IN_THE_APP` and the app's /help index drops the question.
   * Read through `helpBodyFor` / `helpTopicsFor`, never directly; held by
   * lib/help-in-the-app-sells-nothing.test.ts.
   */
  appBody?: string;
};

/**
 * The app's answer when the whole question is a part of Setnayan the app does
 * not include — the /web-only page's own words, so the two never disagree.
 * Deliberately blank about where else it lives: naming the website here is
 * the external steering guideline 3.1.1 forbids (app/(shell)/web-only).
 */
export const HELP_NOT_IN_THE_APP = 'This part of Setnayan is not included in the app.';

/** The answer this reader is shown: the app's own words in the store shell. */
export function helpBodyFor(article: HelpArticle, storeShell: boolean): string {
  return storeShell && article.appBody !== undefined ? article.appBody : article.body;
}

/**
 * The topics as this reader sees them. Off the store shell: unchanged. In the
 * store shell: every body is the app's answer, a question whose whole answer
 * is `HELP_NOT_IN_THE_APP` is left out, and a topic left with no questions
 * goes too — so the app's /help lists only what the app does.
 */
export function helpTopicsFor(topics: ReadonlyArray<HelpTopic>, storeShell: boolean): HelpTopic[] {
  if (!storeShell) return [...topics];
  return topics
    .map((t) => ({
      ...t,
      articles: t.articles
        .filter((a) => a.appBody !== HELP_NOT_IN_THE_APP)
        .map((a) => ({ slug: a.slug, title: a.title, body: helpBodyFor(a, true) })),
    }))
    .filter((t) => t.articles.length > 0);
}

export type HelpTopic = {
  key: string;
  label: string;
  roles: ReadonlyArray<HelpRole>;
  articles: HelpArticle[];
};

export const HELP_ROLES: ReadonlyArray<{
  key: HelpRole;
  label: string;
  blurb: string;
}> = [
  {
    key: 'couple',
    label: 'Couple',
    blurb: "You're planning an event. Guest list, suppliers, budget, the day itself.",
  },
  {
    key: 'vendor',
    label: 'Supplier',
    blurb: 'You sell a service to couples on Setnayan.',
  },
  {
    key: 'guest',
    label: 'Guest',
    blurb: 'You got an invite. Time to RSVP and show up.',
  },
];

// GEO Phase G3 (2026-05-28) — "About Setnayan" topic lands at the top
// of HELP_TOPICS so its 18 brand/discovery Q&A pairs lead the FAQPage
// JSON-LD shipped by apps/web/app/help/page.tsx. AI answer engines
// (ChatGPT-User · OAI-SearchBot · PerplexityBot · ClaudeBot — allowlisted
// via robots.txt per CLAUDE.md 2026-05-14 SEO playbook lock) extract
// FAQPage Question + Answer pairs verbatim when responding to "what is
// X" / "how much does X cost" / "does X support Filipino weddings"
// queries. Each answer is under ~300 chars so it surfaces cleanly as a
// SERP snippet and as a structured chunk in AI chat responses.
//
// PRICING DISCIPLINE (2026-07-05): article bodies MUST NOT hardcode any
// peso figure, tier boundary, or per-cycle rate — prices are admin-managed
// (platform_retail_catalog_v2 + the vendor billing catalog) and drift, so a
// number baked into this SEO-indexed evergreen corpus goes stale silently
// and can be acted on by users at /help/[slug]. Point at setnayan.com/pricing
// (couple SKUs) or the vendor billing hub (vendor tiers) instead of quoting a
// figure. Same rule for frozen live dates/counts (launch dates, market-size
// counts). A unit test (lib/help-no-hardcoded-prices.test.ts) guards this —
// keep it green.
export const HELP_TOPICS: ReadonlyArray<HelpTopic> = [
  {
    key: 'about-setnayan',
    label: 'About Setnayan',
    roles: ['couple', 'vendor', 'guest'],
    articles: [
      {
        slug: 'what-is-setnayan',
        title: 'What is Setnayan?',
        body: "Setnayan (SET-na-yan, from Tagalog \"Set na 'yan\" — \"that's all set\") is a Philippines-first platform for life's events: one free account to plan each one, run the day and keep it for life. It runs weddings, debuts, christenings, birthdays, graduations, anniversaries, reunions, corporate events, wakes and more. Planning is free with no guest limit, you book verified Filipino suppliers at 0% commission and pay them directly, and everything you make gathers into your Memories.",
      },
      {
        slug: 'how-much-does-setnayan-cost',
        title: 'How much does Setnayan cost?',
        appBody: 'Planning in the Setnayan app is free: schedule, budget, guest list, seat plan, mood board, RSVP with a QR code for every guest, and marketplace browse with a match preview. Couples pay 0% commission on supplier bookings — they pay their suppliers directly and Setnayan never sits between them at checkout.',
        body: 'Planning is free: schedule, budget, guest list, seat plan, mood board, and marketplace browse with a match preview. Setnayan AI (a one-time purchase, with access through your event date) and each optional service are priced on setnayan.com/pricing. Couples pay 0% commission on supplier bookings — they pay suppliers directly. Suppliers: Verified is free, for good, with Solo, Pro and Ultra plans — see setnayan.com/for-suppliers.',
      },
      {
        slug: 'is-setnayan-free-for-couples',
        title: 'Is Setnayan free for couples?',
        appBody: 'Yes. Planning in the app is free, with no card and no guest limit. The schedule, budget, guest list, seat plan and its 3D walkthrough, mood board, RSVP with a QR code for every guest, and the Event Hub with unlimited RSVP are all free with every account, plus marketplace browse and a preview of your supplier matches.',
        body: 'Starting is free, with no card and no guest limit. The schedule, budget, guest list, seat plan and its 3D walkthrough, mood board, RSVP with a QR code for every guest, and the Event Hub with unlimited RSVP are all free with every account, plus marketplace browse and a preview of your supplier matches. Optional paid software — Setnayan AI (a one-time purchase with access through your event date), the Live Watch multi-camera control room, Papic top-ups, Event Hub PRO and more — is priced individually. You only pay for what you choose to add. Current rates are on setnayan.com/pricing.',
      },
      {
        slug: 'does-setnayan-take-commission',
        title: 'Does Setnayan take commission on supplier bookings?',
        appBody: 'No. Couples pay 0% commission on every booking — they pay their suppliers directly, and Setnayan never touches that money.',
        // ⚖ OWNER 2026-10-12 (#14): couple-facing pages do NOT mention the
        // supplier's fee. This topic is shown to couples, so the fee sentence
        // moved to the supplier-only "Fees & plans" topic below — word for
        // word — rather than being deleted.
        body: 'No. Couples pay 0% commission on every booking — they pay their suppliers directly, and Setnayan never touches that money. Setnayan earns from the optional software couples choose to buy (Setnayan AI, Papic, Live Watch, Event Hub PRO and more) and from its services to suppliers. Current rates are on setnayan.com/pricing.',
      },
      {
        slug: 'what-is-todays-focus',
        title: "What is Setnayan AI?",
        appBody: HELP_NOT_IN_THE_APP,
        body: 'Setnayan\'s assisted planner — a one-time purchase that unlocks the full planner through your event date (current rate on setnayan.com/pricing). It matches suppliers to your date, budget, venue, guest count, religion and reviews, and walks you through each decision, from the venue to thank-you cards, with faith-specific steps and deadlines (for a Filipino wedding: Pre-Cana, marriage licence windows, sponsors).',
      },
      {
        slug: 'does-setnayan-support-filipino-customs',
        title: 'Does Setnayan support Filipino wedding customs?',
        body: 'Yes. Supports seven ceremony types (Catholic, Civil, INC, Christian, Muslim, Cultural, Mixed) and seven venue settings (banquet hall, garden, beach, destination, heritage, outdoor tent, civil registrar). More than 30 Filipino ceremony roles in the guest list, including principal sponsors, candle/veil/cord/coin sponsors, ninang, ninong, bearers, and Nikah roles. Multi-faith supplier compatibility tagging across a deep tree of supplier sub-categories.',
      },
      {
        slug: 'what-languages-does-setnayan-support',
        title: 'What languages does Setnayan support?',
        body: 'English is the main language. The dashboard’s menus and buttons are also available in Tagalog, and the feature pages have Tagalog versions.',
      },
      {
        slug: 'where-does-setnayan-operate',
        title: 'Where does Setnayan operate?',
        body: 'Philippines — Metro Manila (Quezon City, Makati, Pasig, Taguig, Manila), Cebu, Davao, Tagaytay, Iloilo, Baguio, Pampanga, Cavite, Batangas, Laguna, Bulacan, and any city Filipino suppliers serve.',
      },
      {
        slug: 'does-setnayan-have-mobile-app',
        title: 'Does Setnayan have a mobile app?',
        appBody: mobileAppAnswerInApp(),
        // One answer for /help, /about and /llms.txt — lib/where-setnayan-runs.ts
        // says what is measured true and why the iPhone line waits on the App Store.
        body: mobileAppAnswer(),
      },
      {
        slug: 'how-are-vendors-verified',
        title: 'How are suppliers verified on Setnayan?',
        body: 'Suppliers complete a business-legitimacy check plus a short video call with a Setnayan admin. Verification is free, for good — no listing fee and no badge fee.',
      },
      {
        slug: 'what-is-pakanta',
        title: 'What is Music Maker?',
        appBody: HELP_NOT_IN_THE_APP,
        body: 'A custom Filipino-style song written for the couple — a one-time per-event purchase (current price on setnayan.com/pricing). Setnayan\'s music team writes original lyrics around the couple\'s love story, records the track, and delivers it for the ceremony or reception.',
      },
      {
        slug: 'what-is-papic',
        title: 'What is Papic?',
        appBody: HELP_NOT_IN_THE_APP,
        body: `Candid photo (and short-video) capture for your event. A few friends you pick — your photo crew — shoot freely from their phones, and you can also let every guest snap photos too. Everyone opens a simple camera from a QR link (no app to install); every shot lands in your private Memories in real time and is matched to the right guests, so each person gets the photos they're in — and untagged photos still land (Papic never drops one). Clips run up to 10 seconds, and optional face-matching (only with each guest's consent) auto-sorts photos to the people in them. Your Memories stay online — keep the originals by downloading them or syncing to your own Google Drive. Cameras are free and unlimited; every photo uses credits. Free credits come ${PAPIC_FREE_CREDIT_CONDITION}, and more are priced on setnayan.com/pricing.`,
      },
      {
        slug: 'what-is-panood',
        title: 'What is Live Watch?',
        appBody: HELP_NOT_IN_THE_APP,
        body: 'Live streaming for your event, embedded directly on your Event Hub. Streaming one camera is free. Live Watch adds all your cameras with a one-time unlock that stays with the event, with unlimited streams (current rate on setnayan.com/pricing). Guests and family who couldn\'t attend in person can watch the ceremony and reception live without leaving Setnayan.',
      },
      {
        slug: 'what-is-pakulay',
        title: 'What is Pakulay?',
        body: 'Pakulay is the Mood Board: your event’s colours and what each role wears, free with every account. Set it in Studio › Palette + Dress Code. Each guest sees their own role’s dress code on your Event Hub, and the 3D seat plan dresses them in it.',
      },
      {
        slug: 'how-does-setnayan-handle-privacy',
        title: 'How does Setnayan handle my privacy?',
        body: 'RA 10173 (Data Privacy Act of the Philippines) compliant. Guest list and event details are never publicly shared without your explicit opt-in. Real stories publish 30 days after the event only with explicit couple consent. Setnayan sets essential cookies only — no analytics, advertising or tracking cookies — and lists every one at setnayan.com/cookies. National Privacy Commission registration in progress. DPO contact at dpo@setnayan.com.',
      },
      {
        slug: 'how-to-contact-support',
        title: 'How do I contact Setnayan support?',
        body: 'Send a message with the contact form at the bottom of setnayan.com/help — pick what it is about (couple, supplier, guest, billing, a bug) and we\'ll route it to the right team. Response within 24 hours during business days. Privacy-related requests reach the DPO directly at dpo@setnayan.com.',
      },
      {
        slug: 'when-does-setnayan-launch',
        // The slug stays (it is an indexed URL); the question is the one a
        // stranger actually has, answered with what is true today.
        title: 'Is Setnayan open now?',
        appBody: 'Yes. Anyone can sign up free and start planning any event type Setnayan offers, and suppliers can open a shop.',
        body: 'Yes. Anyone can sign up free at setnayan.com and start planning any event type Setnayan offers, and suppliers can open a shop from setnayan.com/for-suppliers.',
      },
      // ─── GEO INTENT ANSWERS (2026-09-26) ─────────────────────────────────
      // One article per high-intent query an answer engine is asked. Each opens
      // with the fact an engine can lift as one sentence, then the proof. Every
      // figure is from shipped code: no guest cap in the guest code; `GuestRole`
      // has 35 values ("more than 30" stays true); SEATING_3D + EDITORIAL_PRO in
      // FREE_FOR_ALL_SKUS; free CREDITS are once per account, never per event
      // (the-free-pool-is-not-on-every-event.test.ts); face data deleted 3 months
      // after (the /papic FAQ). ⚠ "photos FIND them" — never "a guest WILL be
      // found automatically": face matching depends on production config.
      // Couple-facing, so the 0% commission is unqualified (owner 2026-09-22).
      {
        slug: 'best-free-filipino-wedding-planner-app',
        title: 'What is the best free Filipino wedding planner app?',
        appBody: 'Setnayan is a free, Philippines-first planner that keeps the whole wedding in one account: a guest list with no guest limit and more than 30 Filipino ceremony roles, RSVP with a QR code for every guest, a seat plan with a free 3D walkthrough of your reception, a budget in pesos, the day’s schedule, a mood board, and an Event Hub for your save-the-date and RSVP. No card and no trial clock. Couples book verified Filipino suppliers at 0% commission and pay them directly.',
        body: 'Setnayan is a free, Philippines-first planner that keeps the whole wedding in one account: a guest list with no guest limit and more than 30 Filipino ceremony roles, RSVP with a QR code for every guest, a seat plan with a free 3D walkthrough of your reception, a budget in pesos, the day’s schedule, a mood board, and an Event Hub for your save-the-date and RSVP. No card and no trial clock. Couples book verified Filipino suppliers at 0% commission and pay them directly. Optional upgrades — guest photo capture, livestream, an AI planner — are priced individually at setnayan.com/pricing.',
      },
      {
        slug: 'guest-list-with-ninongs-and-ninangs',
        title: 'How do I organize a wedding guest list with ninongs and ninangs?',
        body: 'Give each guest a role and let the list sort itself. Setnayan’s free guest list has more than 30 Filipino ceremony roles built in — principal sponsors (ninong and ninang), candle, veil, cord and coin sponsors, ring, bible and coin bearers, flower girl, maid or matron of honor, best man, bridesmaids, groomsmen, officiant, readers, and Nikah roles. The list orders itself bride first, then groom, then by role, and you can filter to just the sponsors, the wedding party or the bearers. Type a name with its side and group in one line, or import your spreadsheet as CSV. Each guest gets a personal QR for RSVP, seating and photos.',
      },
      {
        slug: 'free-seating-plan-and-budget-in-pesos',
        title: 'Is there a free digital seating plan and budget tracker in pesos?',
        body: 'Yes — on Setnayan both are free, with no guest limit. The seat plan lays out tables, the head table and the dance floor, and 3D Plan stands the same layout up into a room you can walk in your browser — also free — so you can check sightlines and aisle space before the day. The budget tracker works in Philippine pesos. Both read from the same guest list and the same supplier ledger, so the numbers stay in step.',
      },
      {
        slug: 'verified-filipino-wedding-vendors-no-commission',
        title: 'Where can I find verified Filipino wedding suppliers with no commission?',
        body: 'Setnayan’s marketplace lists Filipino suppliers who each passed a business-legitimacy check and a video call with a Setnayan admin, and it shows their real business name. Browsing is free and open to anyone. Couples pay 0% commission: you pay suppliers directly, and nothing you pay them comes back to Setnayan. Save two suppliers to compare them side by side — location, rating, services and distance from your venue — then message them from Setnayan, where a supplier sees your event’s name and date, never your email.',
      },
      {
        slug: 'share-wedding-photos-with-guests-automatically',
        title: 'How do I share wedding photos with guests automatically?',
        appBody: HELP_NOT_IN_THE_APP,
        body: `With Papic, every guest’s phone becomes part of one photo-and-video crew — no app and no account, just a code and a browser. Photos gather into your Memories as they are taken, and a guest who adds a selfie once has the photos they appear in find them; anyone who skips it is never matched, and face data is deleted automatically three months after the event. If the venue has no signal, photos wait on the phone and send when it returns. Cameras are free and unlimited; every photo uses credits. Free credits come ${PAPIC_FREE_CREDIT_CONDITION}, and you always receive every photo, kept for life.`,
      },
      {
        slug: 'free-alternative-to-wedding-website-builders',
        title: 'What is a free alternative to paid wedding website builders in the Philippines?',
        appBody: 'Setnayan’s Event Hub is free with unlimited RSVP. It holds your save-the-date, your RSVP, the day’s details — when, where, dress code, directions — and your love story, laid out like a magazine feature instead of a form. Guests RSVP with one tap and you see the count in real time beside your guest list and seat plan.',
        body: 'Setnayan’s Event Hub is free with unlimited RSVP. It holds your save-the-date, your RSVP, the day’s details — when, where, dress code, directions — and your love story, laid out like a magazine feature instead of a form. Guests RSVP with one tap and you see the count in real time beside your guest list and seat plan. The same Event Hub later carries your Memories and your livestream. An optional PRO upgrade removes the Setnayan watermark and adds a cinematic save-the-date reveal.',
      },
      {
        slug: 'plan-a-debut-christening-or-other-event',
        title: 'Can I use Setnayan for a debut, christening or other event?',
        body: 'Yes. The same free planning tools run every event type Setnayan offers — weddings, debuts, christenings, birthdays, graduations, anniversaries, reunions, corporate events, gala nights, wakes and more. And for the people you celebrate with again and again, a group gives your barkada, clan or parish its own space: short stories that disappear after 24 hours, one group chat, and the events you plan together.',
      },
      // ─── THE WORRIES AN ANSWER ENGINE RAISES (2026-09-28) ────────────────
      // Asked of ChatGPT/Gemini, "Setnayan's weaknesses" came back as four
      // generic event-app worries: venue signal, older guests, upload load, and
      // free spreadsheets. Each answer below states only what ships, checked
      // against code on this date: the guest and supplier cameras save every
      // shot on the phone FIRST and send it in pieces when there is signal
      // (lib/papic-upload/, 2026-10-23), the seat camera queues a shot on the
      // phone when its upload fails (enqueuePapicSeatCapture in
      // lib/offline/service-handlers/papic-drain.ts), and both send small copies
      // (lib/papic-upload/prepare.ts · compressVideoForWeb); the door desk has a
      // name search (CheckinMethod 'manual_search'); a couple sets any guest's
      // RSVP from the guest card; guest import takes CSV.
      // ⚠ DELIBERATELY NOT CLAIMED: that door check-in works offline — marking
      // a guest arrived is a server action with no queue today. Do not add it
      // here until that ships. Nor that Live Studio survives a dropout.
      {
        slug: 'what-if-the-venue-has-no-signal',
        title: 'What happens if the venue has no signal?',
        appBody: 'Your guest list, RSVPs and seat plan are all settled before the day, so a weak signal at the venue changes none of them.',
        body: 'Your photos are safe. Papic saves every shot on the phone that took it and sends it by itself once the signal comes back, so a dropped connection never loses a photo. Your guest list, RSVPs and seat plan are all settled before the day. Live Watch is the one part that needs a working connection, because a livestream travels over the internet as it happens — check the venue’s signal or Wi-Fi before the day.',
      },
      {
        slug: 'guests-without-smartphones',
        title: 'What if some guests, like a lola or ninong, don’t use smartphones?',
        body: 'They don’t need to. You can add every guest to the list yourself and record their RSVP for them, so your headcount and seat plan still include everyone. At the door, your coordinator finds a guest by typing their name — there is no QR they have to scan. Guests who do use a phone need no app and no account: the invitation, the RSVP and the photo camera all open in the browser from a link or a QR code.',
      },
      {
        slug: 'many-guests-uploading-photos-at-once',
        title: 'Will Setnayan slow down when many guests upload photos at once?',
        body: 'Uploads are built to spread the load. Each phone shrinks its photos and videos before sending them, so guests send far less than the original file size and use less mobile data, and every file goes straight to storage rather than waiting in line behind one server. If a phone loses signal partway, the photo waits on that phone and sends when the connection returns.',
      },
      {
        slug: 'setnayan-vs-free-apps-and-google-sheets',
        title: 'How is Setnayan different from free planner apps, Google Sheets or a shared Drive?',
        appBody: 'Everything the free tools do, Setnayan also does for free: a guest list with no limit (import your spreadsheet as CSV), RSVP, a seat plan, a budget in pesos and a schedule — in one account, where each part reads the same guest list, so a change in one place shows up everywhere.',
        body: 'Everything the free tools do, Setnayan also does for free: a guest list with no limit (import your spreadsheet as CSV), RSVP, a seat plan, a budget in pesos and a schedule — in one account, where each part reads the same guest list, so a change in one place shows up everywhere. What a spreadsheet or a Drive link cannot do is run the day itself: your guests’ phones become one photo crew filling one set of Memories, and family abroad can watch the ceremony live. Those day-of tools are optional and priced individually on setnayan.com/pricing.',
      },
    ],
  },
  {
    key: 'getting-started',
    label: 'Getting started',
    roles: ['couple', 'vendor'],
    articles: [
      {
        slug: 'sign-up-as-couple',
        title: 'Sign up as a couple',
        body: 'Tap Create account on setnayan.com and sign up with Google, with Apple, or with your email and a password of at least 8 characters. A sign-up from there is a couple\'s account.',
      },
      {
        slug: 'sign-up-as-vendor',
        title: 'Sign up as a supplier',
        body: 'Start from the For suppliers page (setnayan.com/for-suppliers) and open your shop from there. Then fill in your business name, services, and contact email in your supplier dashboard. One account can do both: with a shop, you can still plan your own events from Events. Couples find you by searching Setnayan and message you here — your email and phone are not shown on your public page.',
      },
      {
        slug: 'create-an-event',
        title: 'Create your event',
        body: 'From your dashboard, start a new event. Pick the event type, enter a display name (this is what guests and suppliers see), and the date. You can change all of it later.',
      },
      {
        // The account bar (owner 2026-10-21 "THE ACCOUNT BAR — EVENTS · DISCOVER · MEMORIES · PEOPLE"), the event
        // bar of four, and the iPhone app's (Discover is dropped there while it bounces `/`).
        slug: 'the-bar-at-the-bottom',
        title: 'What are the tabs at the bottom of the screen?',
        appBody:
          'On your account screens the bar is Events, Memories and People — plus Shop if you own one. Events holds every event you host or are invited to, Memories keeps the photos and stories from all of them, and People is everyone you are connected to. Inside an event the bar changes to that event’s own: Home, Guests, Suppliers, Hub and Memories.',
        body: 'On your account screens the bar is Events, Discover, Memories and People — plus Shop if you own one. Events holds every event you host or are invited to, Discover shows public events from people you follow, Memories keeps the photos and stories from all of them, and People is everyone you are connected to. Inside an event the bar changes to that event’s own: Home, Guests, Suppliers, Hub and Memories. On a laptop the same places run down the side.',
      },
      {
        // Owner 2026-10-22: "In shop they do not create events, but them as a user, they can create their events".
        slug: 'one-account-shop-and-events',
        title: 'Can I plan my own events if I have a shop?',
        body: 'Yes. One account can run a shop and plan events. Create an event from Events, as anyone does. A shop you open or claim is also one of your loved ones in People, so you can make an event for your shop as well as for yourself.',
      },
      {
        // The avatar sheet, Direction 2 (owner 2026-10-22, #6783) — one Switch to card, a row per shop (#6802).
        slug: 'switch-between-your-places',
        title: 'How do I switch between my events and my shop?',
        body: 'Tap your picture at the top. Switch to lists Your events and each shop you run — tap one to go there, or View page to see a shop’s public page. Profile & settings is at the top of the same sheet.',
      },
      {
        // Search stays in the shell (#6782): a signed-in search answers on the account's own results page.
        slug: 'what-search-finds',
        title: 'What does search find?',
        appBody: 'Your events, the suppliers on them — marked On your event — and our stories and guides. The results open inside your account.',
        body: 'Your events, the suppliers on them — marked On your event — the shops on Setnayan, and our stories and guides. The results open inside your account.',
      },
      {
        // The supplier bar (owner 2026-10-21 "SUPPLIER BAR — TODAY · CUSTOMERS · SHOP · HUB"; More left the bar).
        slug: 'supplier-dashboard-tabs',
        title: 'Suppliers: where is everything in my dashboard?',
        body: 'The bar is Today, Customers, Shop and Hub. Today shows the one thing waiting on you. Customers holds your people, dates and money — and your messages, which also open from the envelope at the top. Shop is your page and what you sell, with How it is going. Hub runs your event days. Settings is under your profile picture.',
      },
      {
        slug: 'event-id-vs-slug',
        title: 'Event ID vs slug',
        body: 'Every event has a Setnayan ID like S89E-AB12CD3456 (used internally) and a public slug like maria-and-juan (used in your invitation URL). You can change the slug later; old slugs auto-redirect for ' + slugForwardingLabel() + ', so links and QR codes already printed keep working.',
      },
    ],
  },
  {
    // People (owner 2026-10-22 "PEOPLE WEARS TODAY'S GUEST LIST") and Memories, the account bar's two places
    // that are not events. Loved ones include a business alaga (2026-10-22, a claimed shop too).
    key: 'people-memories',
    label: 'People & Memories',
    roles: ['couple', 'vendor'],
    articles: [
      {
        slug: 'people-page',
        title: 'What is People?',
        body: 'People is everyone you are connected to on Setnayan. The counts at the top — connected, waiting for them, asking you — each show just those people when you tap them. Type a name in the field at the bottom to find someone, or to invite them if they are not on Setnayan yet. ≡ opens Groups, Following and Followers. Nobody is connected until they say yes.',
      },
      {
        slug: 'loved-ones',
        title: 'What are loved ones?',
        body: 'Loved ones are the people and things you plan events for — a child, a lola, a pet. Add one in People, under Loved ones. A shop you open or claim is added there too, so you can make an event for your shop. An event made for a loved one or your shop says who it is for — on its card, and under its name on Home.',
      },
      {
        slug: 'memories',
        title: 'What is Memories?',
        body: 'Memories keeps the photos and stories from every event you hosted or went to, in one place. Open it from Memories in the bar at the bottom.',
      },
    ],
  },
  {
    // Supplier-only (owner 2026-10-12 #14): the supplier's booking fee is said
    // to SUPPLIERS, and to nobody else. Moved here from 'about-setnayan', which
    // couples read.
    key: 'supplier-fees',
    label: 'Fees & plans',
    roles: ['vendor'],
    articles: [
      {
        slug: 'what-do-suppliers-pay-setnayan',
        title: 'What does Setnayan charge suppliers?',
        appBody: `No commission — couples pay you directly and Setnayan never touches that money. Separately, a supplier pays Setnayan a booking fee only on couples Setnayan introduces. ${FIRST_BOOKING_ON_US} A supplier's own clients are always free, and the fee is never added to what a couple pays.`,
        body: `No commission — couples pay you directly and Setnayan never touches that money, on every tier. Separately, a supplier pays Setnayan a booking fee only on couples Setnayan introduces. ${FIRST_BOOKING_ON_US} A supplier's own clients are always free, and the fee is never added to what a couple pays. Current rates are on setnayan.com/for-suppliers.`,
      },
    ],
  },
  {
    key: 'getting-verified',
    label: 'Getting verified',
    roles: ['vendor'],
    articles: [
      {
        slug: 'how-to-get-dti-sec-registration',
        title: 'How to get your DTI or SEC registration',
        body:
          'This is proof your business is legally registered. Which one you need depends on how your business is set up.\n\n' +
          'If you are a SOLE PROPRIETOR (just you, under a business name), register a Business Name with the DTI. It is done fully online and usually approved within minutes.\n' +
          '1. Go to the DTI Business Name Registration System: https://bnrs.dti.gov.ph\n' +
          '2. Search that your business name is available, then fill in your details and pick your territorial scope (Barangay, City, Regional, or National — a wider scope costs a bit more).\n' +
          '3. Pay the fee online. Download the DTI Business Name Certificate (PDF).\n\n' +
          'If you are a CORPORATION or PARTNERSHIP, register with the SEC instead, through eSPARC: https://esparc.sec.gov.ph\n' +
          'Once approved, download your SEC Certificate of Registration.\n\n' +
          'Upload whichever certificate applies to you (PDF, JPG, or PNG, up to 15 MB). You only need one — DTI OR SEC, not both.',
      },
      {
        slug: 'how-to-get-bir-2303',
        title: 'How to get your BIR Form 2303',
        body:
          'BIR Form 2303 is your Certificate of Registration with the Bureau of Internal Revenue. It confirms you are registered to issue receipts and pay taxes. You get it AFTER your DTI or SEC registration.\n\n' +
          '1. Register your business with the BIR. You can start online through ORUS (Online Registration and Update System): https://orus.bir.gov.ph — or go in person to the Revenue District Office (RDO) that covers your business address.\n' +
          '2. Bring/submit your DTI or SEC certificate, a valid government ID, and proof of address. The BIR will tell you your tax type (most small suppliers are Non-VAT / Percentage Tax).\n' +
          '3. Once processed, the BIR issues Form 2303. Keep the original — you also need to register your official receipts.\n\n' +
          'Upload a clear copy of Form 2303 (PDF, JPG, or PNG, up to 15 MB). Make sure the registered name and TIN are readable.',
      },
      {
        slug: 'how-to-get-mayors-permit',
        title: "How to get your Mayor's Permit",
        body:
          "The Mayor's Permit (also called a Business Permit) is issued by the city or municipality where you operate. It must be for the CURRENT year — it is renewed every January.\n\n" +
          '1. Go to the Business Permits and Licensing Office (BPLO) of your city or municipality. Many LGUs now let you apply or renew online — check your local government website.\n' +
          '2. Typical requirements: your DTI or SEC certificate, BIR registration, Barangay Business Clearance, and proof of location (lease contract or, if you own it, tax declaration).\n' +
          '3. Pay the assessed local fees. The LGU issues your Business Permit and the plate/sticker for the year.\n\n' +
          'Requirements and fees vary by LGU, so your city hall is the best source of the exact list. Upload the current-year permit (PDF, JPG, or PNG, up to 15 MB).',
      },
      {
        slug: 'how-to-prepare-bank-account-proof',
        title: 'How to prepare your bank account proof',
        body:
          'This shows you control a real payout account under your business identity. It is a trust check — Setnayan does not hold your money.\n\n' +
          'Your proof just needs to clearly show three things:\n' +
          '1. The account holder name — this should match your DTI/SEC business name (or your own name if you are a sole proprietor).\n' +
          '2. The provider — the bank name, or GCash / Maya.\n' +
          '3. The account number (you may mask the middle digits).\n\n' +
          'What counts as valid proof:\n' +
          '- GCash or Maya: a screenshot of your in-app Profile / "My Account" page showing your name and number.\n' +
          '- Bank: a screenshot of your account details in the banking app, a bank certificate, the header of a bank statement, or a photo of your passbook cover.\n\n' +
          'You do NOT need to show your balance or transaction history — feel free to blur those. Upload a screenshot or PDF (up to 15 MB).',
      },
      {
        slug: 'build-your-online-presence',
        title: 'Build your online presence: Instagram, YouTube & Vimeo',
        body:
          'Couples check who you are before they message you. A few good public links do more than any sales pitch — here is a simple setup that works for most Filipino suppliers.\n\n' +
          '1. Get a Business (or Creator) Instagram. Couples browse Instagram first, so this is the one to start with. If you already have a personal account, you do not need a new one — open the app, go to Settings and privacy > Account type and tools > Switch to professional account, and pick Business or Creator. That unlocks insights and a contact button, and keeps your work and personal life separate.\n' +
          '2. Post your best work, not all of it. 9 to 12 strong photos or a short reel say more than 100 random shots. Add your city and what you do to your bio.\n' +
          '3. Start a YouTube channel for the long pieces. Full films, highlight reels, and behind-the-scenes clips live well here with no time limit. Create one free at https://youtube.com and upload a couple of your best videos.\n' +
          '4. Use Vimeo for a clean, ad-free reel. If you want your portfolio to look premium — no ads, no "up next" clutter — Vimeo is worth it. Make a free account at https://vimeo.com and upload one polished showcase video.\n' +
          '5. Bring it all back to Setnayan. On your supplier profile, paste your YouTube and Vimeo links into Featured Videos (they play right on your page), and add every public link — Instagram, Facebook, TikTok, YouTube, Vimeo — under your social links. That way a couple sees your whole story in one place, without leaving Setnayan to go hunting.\n\n' +
          'You do not need all of these on day one. Even one good link helps. Start with Instagram, add the rest as you go.',
      },
    ],
  },
  {
    key: 'guests',
    label: 'Guest list',
    roles: ['couple'],
    articles: [
      {
        slug: 'add-guest-roles',
        title: 'Filipino wedding roles',
        body: 'More than 30 Filipino ceremony roles are built in, including maid, matron or man of honor, best man or best woman, bridesmaids, groomsmen, the parents and grandparents of the bride and of the groom, principal sponsors, candle, veil, cord and coin sponsors, ring, bible and coin bearers, flower girl, officiant, readers, and Nikah roles. A guest can hold more than one: tick each in Role on their card — the first is their main role.',
      },
      {
        slug: 'plus-ones',
        title: 'How plus-ones work',
        body: 'Pick how many plus-ones a guest may bring (+1, +2 and so on) and Setnayan adds a seat for each one, listed with their guest, with its own QR code. Until it is named it reads as the guest’s +1 — the guest can name them on their reply, or the +1 names themselves the first time they open their invitation. The counts at the top say how many +1s are named and how many have no name yet; tap either to see them. A seat with no name yet can be let go with Release seat. A +1 cannot bring a +1 of their own.',
      },
      {
        slug: 'import-csv',
        title: 'Import guests from CSV',
        body: 'On Guests, tap ＋, then Import a file. Upload a CSV file — up to 200 rows at a time; download the template on that page to start. First name and last name are the only columns you must fill. You see every row before anything is added, and uploading again updates the guests already there.',
      },
      {
        slug: 'share-invite-link',
        title: 'Share an invite link',
        body: 'Each guest has their own invitation link and QR. On Guests, tap a guest’s Invite to copy their link or a ready message, or to share the message with their ticket. For people not on your list yet, Guests › Setup has one link anyone can use to ask to join.',
      },
    ],
  },
  {
    key: 'invitations',
    label: 'Event Hub',
    roles: ['couple'],
    articles: [
      {
        slug: 'invitation-site',
        title: 'What is the Event Hub?',
        body: 'Your Event Hub is the page at setnayan.com/your-slug where every invitation leads. Guests land there when they tap their personal link or scan their QR. It shows your event details, an RSVP form, a countdown, the venue map, the dress code, and more.',
      },
      {
        // Event Hub Pro part by part (owner 2026-10-22, #6775/#6780). Web only — the app shows none of it. No figure
        // here: prices are the catalogue's (platform_retail_catalog_v2), named on the Pricing page.
        slug: 'event-hub-pro-parts',
        title: 'Can I get only part of Event Hub Pro?',
        appBody: HELP_NOT_IN_THE_APP,
        body: 'Yes. Event Hub Pro comes part by part — Style, Background, Motion, Music, Photos, Logo & QR, Prints, a custom address and more — or everything at once. Try any Pro effect in your draft: at Apply, the sheet names the parts it needs. What you pay for parts counts toward everything. Each part shows its price on the Event Hub Pro page in Studio.',
      },
      {
        slug: 'monogram',
        title: 'Customize the QR monogram',
        appBody: 'Every guest’s QR code carries a mark in its centre and opens their own invitation. You will find it in Hub, under Event Details › QR Code.',
        body: 'Every guest’s QR has a mark in its centre: the Setnayan mark on a free event, your own logo with Event Hub Pro. The QR’s shape, pattern and colour are in Hub, under Event Details › QR Code. Guests see a change once you press Apply.',
      },
      {
        slug: 'print-qr-sheet',
        title: 'Print the QR sheet',
        body: 'Open Hub › Prints and find Guest QR codes, under For the day. Save PDF gives every guest’s own QR with their name, twelve to an A4 page — free for every event. Print it at 100% scale.',
      },
      {
        slug: 'reissue-qr',
        title: "Re-issue a guest's QR code",
        body: 'If a guest loses their link or shares it, make them a new one. On Guests, open the guest’s card, tap ⋯ › New QR, then Make a new QR. Their old QR and link stop working right away, and the new one can be sent.',
      },
    ],
  },
  {
    key: 'vendors-budget',
    label: 'Suppliers & budget',
    roles: ['couple'],
    articles: [
      {
        slug: 'track-vendor',
        title: 'Track a supplier',
        body: 'On Suppliers, open Build and find the category — the caterer, the photographer and so on. Tap Add manually to add a supplier you found yourself, with their contact, what they cover and what you agreed to pay. Once you have paid them, they show as Booked.',
      },
      {
        // A manual venue's pin is set in Studio › Info; a shop's venue follows the shop's pin (owner 2026-10-22, #6787).
        slug: 'venue-pin',
        title: 'How do I put my venue on the map?',
        body: 'In Studio › Info › Venues, a venue you added yourself gets a pin you can move to the door. A venue booked from a shop on Setnayan follows the shop’s own pin — if the shop has not pinned its place yet, the map says so.',
      },
      {
        slug: 'budget-line-items',
        title: 'Budget line items',
        body: 'Your budget is in Suppliers › Budget. The top shows Target, Agreed, Paid and Owed. Below it: your booked suppliers, your Setnayan services, and your own expenses — ＋ Add expense for anything paid outside Setnayan. A supplier’s line items and payments are on that supplier’s own card.',
      },
      {
        slug: 'export-calendar',
        title: 'Export budget due dates to your calendar',
        body: 'In Suppliers › Budget, tap Export upcoming dates (.ics). You get a calendar file with one entry for each payment still due. Open it in Google Calendar, Apple Calendar or Outlook.',
      },
    ],
  },
  {
    key: 'mood-board',
    label: 'Mood Board',
    roles: ['couple'],
    articles: [
      {
        slug: 'palette-tiers',
        title: 'Palette tiers',
        body: 'Mood Board groups your palettes into three families: Venue (Ceremony 1-3 colors, Reception 3-5 in named slots — dominant, supporting, accent, neutral, accent 2), Couple (Bride 1-3, Groom 1-4), and the wedding party, family and sponsors (Wedding Party 3-6, Sponsors 1-3 each, Plain guests 3-5). Every starter theme fills all five reception slots. Role palettes only show when you have guests in that role.',
      },
      {
        slug: 'dress-code-by-role',
        title: 'How does the dress code work?',
        body: 'Set it in Studio › Palette + Dress Code. Each role — the couple, the entourage, the parents, the sponsors and your guests — has its own row: pick what they wear and their colours, and a drawn figure shows it. Each role can have its own call time. For your guests you can allow more than one style, and up to five designs in each. Every guest sees only their own role’s dress code on your Event Hub, with your do’s and don’ts.',
      },
      {
        slug: 'palette-chip-dot',
        title: 'How the palette shows up for your guests',
        body: 'A guest’s card says what they wear and where it came from — their role’s dress code from the Mood Board — and the 3D seat plan dresses them in it.',
      },
    ],
  },
  {
    key: 'messaging',
    label: 'Messaging',
    roles: ['couple', 'vendor'],
    articles: [
      {
        slug: 'start-thread-with-vendor',
        title: 'Start a thread with a supplier',
        body: 'Tap Message on a supplier in your Suppliers list, or Message on any shop’s page — Setnayan opens the conversation for you, and the shop replies in your chats. Everything you agree stays with your event. Opening a chat again with the same supplier for the same event picks up the one you had. Only hosts start a chat — suppliers reply.',
      },
      {
        slug: 'identity-masking',
        title: "Suppliers don't see your email",
        body: 'Suppliers never see your email. In a chat they see your name and your event — its name, date, place, guest count and the suppliers you have booked — so they can answer properly.',
      },
      {
        slug: 'vendor-reply-only',
        title: 'Suppliers: how the reply-only inbox works',
        body: 'Your messages — in Customers, or from the envelope at the top — list every chat a couple has opened with you. Reply, attach files and share quotes. You cannot start a chat: a couple writes first, which keeps them free of messages they did not ask for.',
      },
    ],
  },
  {
    key: 'orders-payments',
    label: 'Orders & payments',
    roles: ['couple'],
    articles: [
      {
        slug: 'how-to-order',
        title: 'How to order a Setnayan service',
        appBody: HELP_NOT_IN_THE_APP,
        body: 'Open the service you want — Setnayan AI, Papic, Live Watch and the rest — and tap Add this service. Pay by BDO or GCash, add a screenshot and the reference number, and send. Each service has one fixed price, shown on its page.',
      },
      {
        slug: 'payment-instructions',
        title: 'How payments work',
        body: 'Your order page has Send your payment, which opens the payment page with our accounts and QR. Pay from any bank or e-wallet app, then send a screenshot and the last 6 digits of your reference there. Put your order’s reference code in the transfer note so we can match it.',
      },
      {
        slug: 'reference-code',
        title: 'Reference codes',
        body: "Every order has a short reference code (like SNAB12CD34). Put it in your transfer note — it's how we match your payment to your order.",
      },
      {
        // Worded only from the live policy, app/(shell)/refunds/page.tsx (owner 2026-10-08 "NO REFUNDS — A SERVICE
        // THEY CANNOT USE BECOMES VIRTUAL CREDITS, CONVERTED TO PAPIC", reaffirmed 2026-10-22). Change both together.
        slug: 'refunds',
        title: 'Can I get a refund?',
        appBody:
          'A payment made to Apple in the iPhone app is Apple’s: a refund request for it goes to Apple, under Apple’s own terms. A supplier’s deposits, refunds and cancellations are settled between you and the supplier.',
        body: `No — what you buy from Setnayan is not refunded. If a service you paid for can't be used (we couldn't deliver it, it doesn't work and we can't fix it, or your event was called off first), send us the order reference with the contact form, within ${REFUND_REPORT_WINDOW_DAYS} days of payment where possible. If you haven't used it, it can wait for your next event; otherwise we add Papic credits to your event worth what you paid. A charge made twice or by mistake goes back to the GCash or bank account it came from. Purchases made through Apple in the iPhone app go to Apple. Supplier deposits and refunds are between you and the supplier. Full policy: setnayan.com/refunds.`,
      },
    ],
  },
  {
    key: 'account-privacy',
    label: 'Account & privacy',
    roles: ['couple', 'vendor'],
    articles: [
      {
        slug: 'theme',
        title: 'Change your Event Hub’s theme',
        body: 'Your Event Hub has its own theme: choose it in Hub › Look › Theme. Guests see a new theme once you press Apply. Your own screens can be light or dark: choose Appearance in Profile › Preferences.',
      },
      {
        slug: 'cookies',
        title: 'Does Setnayan use cookies?',
        body: 'Only the essential ones — to keep you signed in and remember your choices, like light or dark. Setnayan uses no analytics, advertising or tracking cookies, so nothing asks you about cookies. Every cookie is listed, with what it does and how long it stays, at setnayan.com/cookies.',
      },
      {
        slug: 'data-export',
        title: 'Export your data',
        body: 'On Profile, open Privacy › Your data › Download my data and tap Download .json. You get a file with your profile, your events, your supplier profile (if any), your messages, and your own orders and payments. The file lists anything it leaves out.',
      },
      {
        slug: 'delete-account',
        title: 'Delete your account',
        body: 'On Profile, under Account, open Delete my account and type DELETE to confirm. That files a deletion request: our team reviews it within 24 hours — checking first for active events, bookings or an outstanding balance — and you can cancel it until it is approved. Once approved, deletion is permanent. RA 10173 right-to-erasure compliant.',
      },
    ],
  },
  // ─── Guest-role topics ──────────────────────────────────────────────
  {
    key: 'guest-getting-started',
    label: 'Got an invite?',
    roles: ['guest'],
    articles: [
      {
        slug: 'scan-qr-code',
        title: 'How to open your Setnayan invite',
        body: "Scan the QR code on your invitation card with your phone's camera. It opens your own personal invitation page. Bookmark it — that's your one place for everything about the event (schedule, venue, RSVP, your seat).",
      },
      {
        slug: 'rsvp-from-link',
        title: 'How to RSVP',
        body: 'Open your invitation and tap Reply on the Will you join us? card. Pick your answer, name your plus-ones if you may bring any, and send. You can change your reply with Change my reply until the couple’s reply-by date.',
      },
      {
        slug: 'meal-preference',
        title: 'Meal preferences and dietary notes',
        body: 'If the couple asks about meals, your reply has a meal choice — no preference, beef, chicken, fish, vegetarian, vegan or a kids’ meal — and a box for dietary notes like halal or allergies. The couple sees it on their guest list.',
      },
      {
        slug: 'lost-invite-link',
        title: 'I lost my invite link',
        body: 'Message the couple. They can send your link again from their guest list, or make you a new QR — the old link then stops working.',
      },
    ],
  },
  {
    key: 'guest-day-of',
    label: 'The Day',
    roles: ['guest'],
    articles: [
      {
        slug: 'what-to-wear',
        title: 'What should I wear?',
        body: 'Open your invitation and find Dress code. It shows what you wear for your own role, in the couple’s colours, with their do’s and don’ts. If the couple allows more than one outfit, wear any one of them in any of the colours shown.',
      },
      {
        slug: 'find-your-table',
        title: 'Find your seat',
        body: 'On the day, your invitation shows Your seat with your table and a small map of the room. Before then it says Your seat shows on the day — unless the couple shows seats early.',
      },
      {
        slug: 'live-schedule',
        title: "What's happening right now",
        body: `On the day, your invitation shows Happening now — what is on, and what is up next — so you never have to ask. Available from ${DAY_OF_STARTS_PLAIN} until ${DAY_OF_ENDS_PLAIN}.`,
      },
      {
        slug: 'photo-wall',
        title: 'Share photos with the couple',
        appBody: HELP_NOT_IN_THE_APP,
        body: 'On the day, Capture the day on your invitation lets you share photos from your camera roll, or be a candid camera for the couple. Everything goes straight to their Memories.',
      },
    ],
  },
  // ─── Papic (candid capture) — couple + guest + crew ──────────────────
  {
    key: 'papic',
    label: 'Papic — candid photos',
    roles: ['couple', 'guest'],
    articles: [
      {
        // Was a second `what-is-papic` (2026-10-25): /help/what-is-papic always opened the About answer, so this one
        // had no page of its own. Its slug now says what it answers; nothing linked to it under the old one.
        slug: 'how-papic-works',
        title: 'How does Papic work at my event?',
        appBody: HELP_NOT_IN_THE_APP,
        body: `Papic turns the phones at your event into candid cameras. One pot of credits covers the whole event: any guest scans your event QR and shoots from it, with no limit on how many phones join. Cameras are free and unlimited; every photo uses credits. Free credits come ${PAPIC_FREE_CREDIT_CONDITION}, so you can try it first. Every shot lands in your private Memories, each guest can find the photos they're in, and there is nothing to install — it runs in the browser.`,
      },
      {
        slug: 'turn-on-papic',
        title: 'How do I turn on Papic and hand out cameras?',
        appBody: HELP_NOT_IN_THE_APP,
        body: `Open your dashboard → Studio → Papic — it is already on.\n1. For guests: share your event QR. Any phone that scans it shoots from your shared credits.\n2. For one person: hand them a camera's own link or QR from the same page. It shoots from the same credits.\nCameras are free and unlimited; every photo uses credits. Free credits come ${PAPIC_FREE_CREDIT_CONDITION}, so there is nothing to buy before you try it. Top up any time — prices are on setnayan.com/pricing.`,
      },
      {
        slug: 'how-papic-tagging-works',
        title: 'How do my photos get matched to the right guests?',
        appBody: HELP_NOT_IN_THE_APP,
        body: "Two ways, both automatic. (1) Face matching: guests who add a selfie are recognized in candid shots, and those photos appear in their 'Memories of you'. (2) QR scan: your crew can scan a guest's invitation QR or a table sign to mark who's in a shot. Either way, every photo reaches your Memories — tagged or not. Face matching is private and per event: a guest's face data is never shared or reused across events, and it only works with the guest's consent.",
      },
      {
        slug: 'find-download-papic-photos',
        title: 'Where do I find and download all my Papic photos?',
        appBody: HELP_NOT_IN_THE_APP,
        body: "Dashboard → Studio → Papic → Memories. Every candid from your crew and guests is there — filter by 'Photos of us', videos, or untagged. Save any photo to your phone with one tap, or use 'Download all' to pull all your Memories as a zip. You can also connect Google Drive to auto-sync everything to your own Drive.",
      },
      {
        slug: 'papic-guest-camera',
        title: 'Guest: how do I take candid photos for the couple?',
        appBody: HELP_NOT_IN_THE_APP,
        body: "If the couple turned on guest cameras, open your invitation link and tap 'Be a candid camera'. Point and shoot — every photo lands in the couple's Memories as you take it. No sign-in, no app. You have a set number of shots; the counter shows how many you have left. After a shot you can also tell the couple the story behind it.",
      },
      {
        slug: 'add-your-face',
        title: 'Guest: how do I make sure I get my photos? (add your face)',
        appBody: HELP_NOT_IN_THE_APP,
        body: "When you RSVP, tap 'Add your photo' and take one selfie (you'll be asked to agree first — it's optional). That lets the candid photos of you find their way to you automatically, under 'Memories of you' on your page. On the day you can also add it from the 'Add your face' card if you skipped it. No selfie? You'll still get any photo where the crew scans your invitation QR.",
      },
      {
        slug: 'photos-of-you',
        title: "Guest: where do I find the photos I'm in?",
        appBody: HELP_NOT_IN_THE_APP,
        body: "On the day (from about an hour before it starts), open your personal invitation page and look for 'Memories of you — so far'. As the crew and guests shoot, the photos you're in collect there through the day — and they're yours to keep afterward. You show up there once you've added a selfie, or once someone scans your invitation QR onto a photo.",
      },
      {
        slug: 'papic-crew-how-to-shoot',
        title: 'Crew: I was asked to shoot — how does it work?',
        appBody: HELP_NOT_IN_THE_APP,
        body: "The couple sent you a camera link. Open it on your phone and tap to claim it — your phone is now a candid camera for their event. Shoot photos and clips of up to 10 seconds; everything uploads to their Memories automatically. Your camera shows how many shots are left in the couple's shared credits. To mark who's in a shot, tap 'Tag who's in it' and hold a guest's place-card QR or a table sign in frame — no typing. If you don't tag, the photo still reaches the couple.",
      },
      {
        // ⚠ THIS ARTICLE ANSWERED A QUESTION THAT NO LONGER EXISTS. It was
        // 'Papic Pool or Papic One — which one do I want?' and there is one
        // product now, so the choice it walked people through is gone. Rewritten
        // rather than deleted, because the underlying worry is real and people
        // still have it: how do I make sure the person I trust doesn't run out?
        // The old slug 301s to this one in next.config.ts — a bookmarked help
        // link should land on the answer, not a 404.
        slug: 'papic-giving-a-camera-its-own-shots',
        title: 'How do I make sure one person never runs out of shots?',
        appBody: HELP_NOT_IN_THE_APP,
        // Rewritten again 2026-10-25: setting credits aside for one camera was
        // retired (owner 2026-09-16 "no dedicated shots individually", built in
        // #5905). The worry stays real, so the answer is what ships now.
        body: "Keep your shared credits topped up. Every camera — yours, your crew's and your guests' — shoots from one pot, so nobody can hold shots back for one person. Give the people you count on, like your maid of honor or the cousin who frames every photo, a camera of their own from your Papic page, and watch the shared balance there. When it runs low, add credits to the pot from Studio › Papic; top-ups stack on what your event already holds. Cameras are free and you can make as many as you like.",
      },
      {
        slug: 'how-papic-shots-work',
        title: 'How do shots work, and how do I add more?',
        appBody: HELP_NOT_IN_THE_APP,
        body: `Everything Papic captures is counted in shots. ${SHOT_TERMS[0]}, and ${SHOT_TERMS[1]} — a clip costs more because it is a lot more to keep. They come out of one purse, so there's no separate photo and video allowance to juggle: shoot more clips and you'll get fewer photos out of the same balance, which is why we don't promise you an exact number of each. Cameras are unlimited. Free credits come ${PAPIC_FREE_CREDIT_CONDITION}. When it runs low, top it up from your dashboard → Studio → Papic: add to the shared pool for the whole event. Top-ups stack on whatever your event already holds — they never replace it — and current prices are on setnayan.com/pricing. Guests can also top up the pool or their own camera themselves from the camera screen, if you'd rather not.`,
      },
    ],
  },
  {
    key: 'live-studio',
    label: 'Live Watch — streaming your day',
    roles: ['couple'],
    articles: [
      {
        slug: 'is-my-youtube-ready-to-live-stream',
        title: 'Is my YouTube channel ready to live stream? (check this first)',
        appBody: HELP_NOT_IN_THE_APP,
        body:
          'Live Watch sends your event to YOUR OWN YouTube channel, so that channel has to be switched on for live streaming before the day. The first time you turn it on, YouTube takes about 24 hours to activate it. Nobody can speed that up — not us, not YouTube support — so do this now, even if your event is a year away. It costs nothing and it never expires.\n\n' +
          'HOW TO CHECK, in under a minute:\n' +
          '1. Sign in to YouTube on the account whose channel you want to stream on. If you have more than one channel, make sure you are on the right one — check the profile picture in the top corner.\n' +
          '2. Go to https://www.youtube.com/features\n' +
          '3. Find "Live streaming" in the list. If it says ENABLED, you are ready and there is nothing more to do.\n\n' +
          'IF IT IS NOT ENABLED YET:\n' +
          '1. On that same page, click to enable it. YouTube will ask you to verify your channel with a phone number — you get a code by text or voice call and type it in. This is free.\n' +
          '2. After verifying, live streaming usually switches on within about 24 hours. Check the same page again the next day.\n' +
          '3. You also need to have had no live-streaming restrictions on the channel in the last 90 days, and to be at least 16 years old.\n\n' +
          'ABOUT THE "50 SUBSCRIBERS" RULE YOU MAY HAVE READ ABOUT: it is real, but it only applies to going live from the YouTube phone app. Live Watch streams from a computer, which has no subscriber requirement at all. A brand-new channel with zero subscribers can stream your event.',
      },
      {
        slug: 'create-your-youtube-live-link',
        title: 'How do I create the YouTube link for my live stream?',
        appBody: HELP_NOT_IN_THE_APP,
        body:
          'You make the broadcast on YouTube, and Setnayan sends the pictures to it. Do this in the last week before your event — not months ahead, because a broadcast left sitting for a long time can go stale.\n\n' +
          '1. Go to https://studio.youtube.com and click CREATE (the camera icon, top right), then GO LIVE.\n' +
          '2. Choose STREAMING SOFTWARE — not "Built-in webcam". This is the option that gives you the connection details Setnayan needs.\n' +
          '3. Give it a title (for example, your names), and set PRIVACY to UNLISTED. Unlisted means only people with the link can watch — it never appears in YouTube search or on your channel page.\n' +
          '4. Set "Made for kids" to NO, or live chat and some other features get switched off.\n' +
          '5. In the stream settings, choose ULTRA LOW LATENCY so people watching are only a few seconds behind the room, and switch ADS off so nothing interrupts.\n' +
          '6. You now see two things you need to keep apart:\n' +
          '   - The STREAM URL and STREAM KEY. These go into your streaming software. The stream key is a password for your channel — never share it, never paste it into Setnayan or anywhere else.\n' +
          '   - The WATCH LINK, from the Share button. It looks like youtube.com/watch?v=... This is the one you paste into Setnayan.\n' +
          '7. Open your dashboard, go to Studio, then Live Watch, and paste the watch link into the "How guests watch" box. Your Event Hub will show a Watch Live player during the day.\n\n' +
          'The short version: the stream key goes to your streaming software, and the watch link goes to Setnayan. Getting those two the wrong way round is the one mistake worth being careful about.',
      },
      {
        slug: 'live-stream-dry-run',
        title: 'How do I make sure it will all work on the day?',
        appBody: HELP_NOT_IN_THE_APP,
        body:
          'Do a dry run, well before the day. It is the only way to be certain, because it tests everything at once: that your channel is really switched on for live streaming, that your streaming software can reach YouTube, and that Setnayan can show the result.\n\n' +
          '1. Make a test broadcast on YouTube, exactly as you would for the real thing, and set it to Unlisted.\n' +
          '2. Start your streaming software and send pictures to it.\n' +
          '3. Paste the watch link into Setnayan and open your Event Hub on your phone. If you can see yourself, everything in the chain works.\n' +
          '4. When you are done, end the broadcast and delete the test video if you would rather not keep it.\n\n' +
          'A dry run also proves the 24-hour activation has finished, which is the single thing most likely to go wrong on the day. Do it once, any time — a year ahead is fine — and you never have to wonder again.',
      },
      {
        slug: 'who-owns-the-live-stream-recording',
        title: 'What happens to the recording afterwards?',
        appBody: HELP_NOT_IN_THE_APP,
        body:
          'The broadcast is on your own YouTube channel, so the recording is yours. YouTube keeps it automatically as an unlisted video on your channel after the stream ends, and you download it from YouTube Studio whenever you like — go to your Content list, find the video, and use the download option in its menu.\n\n' +
          'Because it lives on your channel and not ours, nobody else can take it down, and it is not affected by anything that happens to another couple. Keep the watch link saved in Setnayan and your Event Hub can keep showing it afterwards.',
      },
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Per-article lookup helpers (SEO/GEO — /help/[slug] indexable article pages,
// 2026-06-13). Article slugs are GLOBALLY UNIQUE across all topics (verified),
// so a flat slug → article resolution is unambiguous and the public URL can be
// /help/[slug] with no topic segment.
//
// `HELP_LASTMOD` is the single honest last-substantive-edit date for the help
// corpus — every article was authored/last-revised together (GEO Phase G3,
// 2026-05-28). The sitemap-help route stamps every help URL with this one date
// rather than a build-time Date() (which Google reads as freshness fraud). Bump
// it in the same edit when an article body materially changes.
// ───────────────────────────────────────────────────────────────────────────

export const HELP_LASTMOD = '2026-10-25';

export type HelpArticleWithTopic = {
  article: HelpArticle;
  topic: HelpTopic;
};

/** Flat list of every article paired with its parent topic. */
export const ALL_HELP_ARTICLES: ReadonlyArray<HelpArticleWithTopic> =
  HELP_TOPICS.flatMap((topic) =>
    topic.articles.map((article) => ({ article, topic })),
  );

/** Resolve an article (and its topic) by its globally-unique slug. */
export function findHelpArticle(
  slug: string,
): HelpArticleWithTopic | undefined {
  return ALL_HELP_ARTICLES.find((entry) => entry.article.slug === slug);
}

/** Other articles in the same topic — used for "related" cross-links. */
export function relatedHelpArticles(
  slug: string,
  limit = 6,
): HelpArticle[] {
  const found = findHelpArticle(slug);
  if (!found) return [];
  return found.topic.articles
    .filter((a) => a.slug !== slug)
    .slice(0, limit);
}

/**
 * Trim an article body to a meta-description-friendly length (~155 chars) at a
 * word boundary, never mid-word, with an ellipsis when truncated.
 */
export function helpMetaDescription(body: string, max = 155): string {
  // Flatten paragraph newlines/indentation to single spaces so multi-line
  // article bodies still yield a clean one-line meta description.
  body = body.replace(/\s+/g, ' ').trim();
  if (body.length <= max) return body;
  const slice = body.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}
