// Setnayan Journal — the public editorial/blog surface (iteration 0038, first
// slice). Mirrors lib/help.ts exactly: content is an in-code typed constant
// (no DB, no CMS vendor, no markdown-renderer dependency), so the /blog routes
// pre-render every slug with generateStaticParams + dynamicParams=false and
// 404 anything else at the routing layer — same soft-404-proof shape as
// /help/[slug] (SEO/GEO, 2026-06-13).
//
// Why structured blocks instead of a markdown string: the repo ships no
// markdown renderer (help-center bodies are plain prose in a <p>), and
// long-form articles need headings + lists + internal-link CTAs. A small typed
// block union keeps it dependency-free, server-rendered, and lets us flatten to
// plain text for the JSON-LD `articleBody` + meta description.
//
// Editorial scope (0038 § 1): pre-purchase research traffic — "how much",
// "what to do", "civil vs church", Filipino-custom explainers. Benefits only,
// never implementation detail (public-surface hygiene). No quoted Setnayan SKU
// prices inside article bodies (they drift); the only Setnayan money facts used
// are the durable ones — free planning workspace, 0% commission.

// Scheduled editorial drip (2026-H2). 78 future-dated articles, authored in
// per-theme batch modules and concatenated into BLOG_ARTICLES below. Each
// module only `import type`s from this file, so there is no runtime import
// cycle (the type import is erased at compile time).
import { ARTICLES_CAPTURE } from '@/lib/blog-batches/capture-coverage';
import { ARTICLES_STYLING } from '@/lib/blog-batches/food-styling';
import { ARTICLES_GUESTS } from '@/lib/blog-batches/guests-paper';
import { ARTICLES_MONEY } from '@/lib/blog-batches/money-legal';
import { ARTICLES_RITUALS } from '@/lib/blog-batches/rituals-symbols';
import { ARTICLES_REGIONAL } from '@/lib/blog-batches/regional-faith';
import { ARTICLES_SEASON } from '@/lib/blog-batches/seasonal-rainy';
import { ARTICLES_DECNEWS } from '@/lib/blog-batches/december-news';

export type BlogCategoryKey =
  | 'planning'
  | 'vendors'
  | 'culture'
  | 'real-weddings'
  | 'news';

export type BlogCategory = { key: BlogCategoryKey; label: string };

// Fixed roster (0038 § 2.1). The index only renders chips for categories that
// actually have ≥1 published article, so empty categories never show a dead
// filter — see blogCategoriesInUse().
export const BLOG_CATEGORIES: ReadonlyArray<BlogCategory> = [
  { key: 'planning', label: 'Planning' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'culture', label: 'Culture' },
  { key: 'real-weddings', label: 'Real Weddings' },
  { key: 'news', label: 'Setnayan News' },
];

export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  // Editorial pull-quote — a bite-size "nugget" the magazine reader renders as
  // a gold-ruled standout between sections.
  | { type: 'quote'; text: string }
  // Inline editorial figure — public-path image with alt + optional caption.
  | { type: 'image'; src: string; alt: string; caption?: string }
  // Internal-link call-out — hub-and-spoke linking to the rest of the site
  // (SEO playbook §13: no orphan pages). Always an internal href.
  | { type: 'cta'; text: string; href: string; label: string }
  // Downloadable asset (e.g. the printable checklist PDF in /public/blog). Renders
  // a prominent download button; `href` is a static /public path, `download`
  // forces save-as. Carries `.text` so blogPlainText's fallback stays type-safe.
  | { type: 'download'; text: string; href: string; label: string };

export type BlogArticle = {
  slug: string;
  title: string;
  /** ~120-char card summary + meta-description seed. */
  excerpt: string;
  category: BlogCategoryKey;
  /** Byline. 'Setnayan Editorial' unless a named author is set. */
  author: string;
  /** ISO date 'YYYY-MM-DD'. Real per-row date → honest sitemap lastmod. */
  publishedAt: string;
  /** ISO date — set when a body materially changes. */
  updatedAt?: string;
  /** At most one true at a time — pins the index hero. */
  featured?: boolean;
  /** Editorial cover image (public path). AI-generated placeholder for V1
   *  (owner 2026-06-15 — "AI now, swap to real photography later"). Also the
   *  OpenGraph + BlogPosting `image`, so every share/SERP card gets art. */
  cover: string;
  coverAlt: string;
  blocks: BlogBlock[];
};

const CORE_BLOG_ARTICLES: ReadonlyArray<BlogArticle> = [
  {
    slug: 'free-printable-wedding-checklist-philippines',
    cover: '/blog/checklist-cover.webp',
    coverAlt:
      'An open wedding planner with a checklist, a gold pen, a sprig of eucalyptus and a cup of coffee on a soft, sunlit table',
    title: 'A free, printable wedding checklist for Filipino couples',
    excerpt:
      'A printable wedding checklist for Filipino couples — plus the free in-app version that updates every deadline around your date.',
    category: 'planning',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-16',
    featured: true,
    blocks: [
      {
        type: 'p',
        text: 'A wedding is a hundred small decisions made in the right order. A good checklist is what keeps those decisions from arriving all at once. It is the single most useful tool a couple can have — and for couples planning without a full-time coordinator, it is essential. Here is why a checklist matters so much, a printable one you can start using today, and a free in-app version that keeps itself up to date as you plan.',
      },
      {
        type: 'h2',
        text: 'Why a checklist is the DIY couple’s best friend',
      },
      {
        type: 'p',
        text: 'When you plan your own wedding, you are the coordinator. There is no one whose job is to remember that the marriage licence has to be filed months ahead, or that the caterer needs a final headcount two weeks out. A checklist holds all of that for you, so the only thing you have to do is work through it at your own pace.',
      },
      {
        type: 'ul',
        items: [
          'It turns one overwhelming project into a short list of what to do next.',
          'It protects the deadlines that are easy to miss — especially the Philippine legal timeline, which does not bend.',
          'It keeps both partners, and the family helping out, looking at the same plan.',
          'It tells you, at a glance, whether you are on track or falling behind.',
        ],
      },
      {
        type: 'quote',
        text: 'The hardest part of planning is not doing the tasks — it is knowing what you have forgotten. A checklist answers that.',
      },
      {
        type: 'h2',
        text: 'Why some couples still want it on paper',
      },
      {
        type: 'p',
        text: 'There is a reason the paper checklist never goes away. You can pin it to the fridge, bring it to a supplier meeting, scribble a note in the margin, and hand it to your mother to help with. It works at a venue with no signal, and it costs nothing to print. For many couples, writing a task down and crossing it off is its own small satisfaction.',
      },
      {
        type: 'download',
        text: 'We made a printable wedding planner you can fill in by hand — a full countdown from eighteen months out to the day itself, with space for your budget, vendors, guest list, and the Philippine legal requirements. It is free, no sign-up needed.',
        href: '/blog/setnayan-wedding-checklist.pdf',
        label: 'Download the free planner (PDF)',
      },
      {
        type: 'h2',
        text: 'The countdown, at a glance',
      },
      {
        type: 'p',
        text: 'Here is the shape of a Filipino wedding timeline. The printable planner breaks each stage into specific tasks with realistic budgets beside them; this is the bird’s-eye view.',
      },
      {
        type: 'ul',
        items: [
          '18–13 months: agree on your budget and guest-count range, then book the things that run out first — your date, ceremony and reception venues, caterer, and photo-and-video team.',
          '12–10 months: lock your look and the suppliers who shape it — stylist, florist, host, music, hair and makeup.',
          '9–7 months: send save-the-dates, order attire, and confirm your principal sponsors (ninong and ninang).',
          '6–5 months: design invitations, finalise your mood board, and begin the church requirements.',
          '4–3 months: the legal stretch — apply for your marriage licence, send invitations, and settle the paperwork.',
          '2 months to the week of: confirm every supplier, lock the final headcount, finalise seating, and walk the day-of timeline.',
          'The day, and after: be present — then claim your PSA marriage certificate and begin any name-change documents.',
        ],
      },
      {
        type: 'quote',
        text: 'A Philippine marriage licence is valid for 120 days, with a 10-day posting period before release. Time it so it is live on your wedding day — not expired, not issued too late.',
      },
      {
        type: 'cta',
        text: 'Ready to start booking? Browse verified Filipino wedding suppliers by city, category, and the styles they specialise in.',
        href: '/explore',
        label: 'Explore the vendor marketplace',
      },
      {
        type: 'h2',
        text: 'When you want the checklist to keep up with you',
      },
      {
        type: 'p',
        text: 'Paper is wonderful, until your date moves. Push the wedding by a month and every deadline on the page is suddenly wrong. Book your caterer, and you still have to remember to cross it off. This is where a living checklist earns its place.',
      },
      {
        type: 'p',
        text: 'Every Setnayan account comes with the same checklist built in, free — but it does the bookkeeping for you. It works out every due date from your wedding date, so the whole countdown shifts the moment your date changes. It ticks tasks off on its own as you book vendors and settle details in the app. And when a task says “book your caterer”, it takes you straight to caterers. It is the paper planner, kept current for you.',
      },
      {
        type: 'cta',
        text: 'Keep your checklist, guest list, budget, and seating in one place — free with every Setnayan account.',
        href: '/signup',
        label: 'Start planning free',
      },
      {
        type: 'p',
        text: 'However you plan — on paper, in the app, or a little of both — the point is the same: a clear list, in the right order, so nothing important sneaks up on you. Download the planner, print it, and start ticking. Set na ’yan.',
      },
    ],
  },
  {
    slug: 'what-to-do-12-months-before-your-philippine-wedding',
    cover: '/blog/hero.webp',
    coverAlt: 'A Filipino couple walking hand in hand through a garden at golden hour',
    title: 'What to do 12 months before your Philippine wedding',
    excerpt:
      'A month-by-month countdown for Filipino couples — from booking your date and church to the final headcount.',
    category: 'planning',
    author: 'Setnayan Editorial',
    publishedAt: '2026-05-20',
    blocks: [
      {
        type: 'p',
        text: 'A year out is the sweet spot to start planning a Filipino wedding. It is long enough to secure the venues, suppliers, and church dates that book out fastest, and short enough that your budget and guest list stay realistic. Here is a calm, month-by-month way to get from "engaged" to "set na" without the last-minute scramble.',
      },
      {
        type: 'h2',
        text: '12–10 months out: lock the non-negotiables',
      },
      {
        type: 'p',
        text: 'Three things drive every other decision: your date, your ceremony venue, and your reception venue. In the Philippines, popular churches and in-demand reception venues are often booked 9–12 months ahead — sometimes longer for December and the cool, dry months from January to May. Settle these first and the rest of your plan organizes itself around them.',
      },
      {
        type: 'ul',
        items: [
          'Agree on a guest-count range and a total budget before you fall in love with a venue you cannot fill or afford.',
          'Reserve your ceremony date with the church or officiant, and ask about pre-marriage requirements early (Catholic parishes usually require a Pre-Cana seminar and a recent baptismal and confirmation certificate).',
          'Book the reception venue and, with it, your caterer if the venue is not all-in.',
          'Lock the suppliers who only take one event a day and book out first: photo-and-video team, coordinator, and host.',
        ],
      },
      {
        type: 'quote',
        text: 'Book the suppliers who only take one event a day first — they are the first to run out.',
      },
      {
        type: 'cta',
        text: 'Compare verified Filipino wedding vendors by city, category, and the styles they specialize in.',
        href: '/explore',
        label: 'Browse the vendor marketplace',
      },
      {
        type: 'h2',
        text: '9–7 months out: build the look and the team',
      },
      {
        type: 'p',
        text: 'With the big rocks in place, move to the suppliers that shape how the day looks and feels. This is also the moment to settle your motif and palette, because almost every other vendor — florist, stylist, stationery, cake, attire — will ask for it.',
      },
      {
        type: 'image',
        src: '/blog/budget.webp',
        alt: 'Wedding rings, an invitation suite and florals styled together',
        caption: 'Settle your palette early — every other supplier briefs against it.',
      },
      {
        type: 'ul',
        items: [
          'Decide your colour palette and overall feel, then brief your stylist and florist against it.',
          'Order the bride\'s gown and entourage attire — custom gowns commonly need 4–6 months.',
          'Book hair and makeup, the cake, and the mobile bar or food carts you want.',
          'Start the guest list in earnest, including principal sponsors (ninong and ninang), so you can size invitations and seating.',
        ],
      },
      {
        type: 'h2',
        text: '6–4 months out: paper, music, and the legal file',
      },
      {
        type: 'p',
        text: 'Now the details. Send save-the-dates, finalize invitations, and choose your ceremony and reception music. Begin the marriage-licence process with your local civil registrar — a Philippine marriage licence is valid for 120 days from issue, so time it so it is still valid on your wedding day, not expired and not issued too late.',
      },
      {
        type: 'quote',
        text: 'A Philippine marriage licence is valid for 120 days. Time it so it is live on your day — not expired, not issued too late.',
      },
      {
        type: 'ul',
        items: [
          'Apply for your marriage licence (allow for the 10-day posting period before it is released).',
          'Finalize and send invitations with a clear RSVP deadline.',
          'Confirm the program flow with your host and coordinator.',
          'Schedule your gown fittings and a hair-and-makeup trial.',
        ],
      },
      {
        type: 'h2',
        text: '3–1 months out: confirm, count, and rehearse',
      },
      {
        type: 'p',
        text: 'The final stretch is about confirmation, not new decisions. Chase RSVPs, lock the final headcount for your caterer, finalize the seating plan, and walk the day-of timeline with every supplier so call times line up. Then breathe — the planning is done, and the celebration is the easy part.',
      },
      {
        type: 'cta',
        text: 'Keep your guest list, budget, schedule, and seating in one place — free with every Setnayan account.',
        href: '/signup',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'how-much-do-wedding-suppliers-cost-philippines',
    cover: '/blog/budget.webp',
    coverAlt: 'Gold wedding rings, a letterpress invitation suite and eucalyptus on a styled table',
    title: 'How much do wedding suppliers cost in the Philippines?',
    excerpt:
      'Typical 2026 price ranges for the most-booked wedding suppliers — and how to budget for them without surprises.',
    category: 'vendors',
    author: 'Setnayan Editorial',
    publishedAt: '2026-05-27',
    blocks: [
      {
        type: 'p',
        text: 'There is no single answer to "how much does a wedding supplier cost" in the Philippines — rates swing widely by city, season, experience, and how much of the work is included. The ranges below are realistic 2026 starting points to help you build a first budget. Treat them as a compass, not a quote: always ask each supplier for an inclusions list in writing, because the same headline price can mean very different things.',
      },
      {
        type: 'h2',
        text: 'What drives the price',
      },
      {
        type: 'ul',
        items: [
          'Location — Metro Manila, Cebu, and destination spots like Tagaytay and Boracay sit at the higher end; provincial rates are often gentler.',
          'Season and day — December and the January-to-May dry season are peak; weekday and off-peak dates can cost noticeably less.',
          'Inclusions — hours of coverage, number of staff, deliverables, and travel can move a price more than the supplier\'s name.',
          'Experience and demand — sought-after teams book a year ahead and price accordingly.',
        ],
      },
      {
        type: 'h2',
        text: 'Typical starting ranges (2026)',
      },
      {
        type: 'p',
        text: 'These are common ranges Filipino couples encounter for full-wedding coverage. Premium and celebrity-tier suppliers can run well above the top of each band.',
      },
      {
        type: 'ul',
        items: [
          'Photo and video team: roughly ₱45,000–₱180,000 depending on hours, crew size, and deliverables.',
          'Catering: often ₱900–₱2,500 per head, so the total scales directly with your guest count.',
          'Coordination: on-the-day coordination from about ₱25,000; full planning runs higher.',
          'Hair and makeup: around ₱15,000–₱60,000 for the bride plus entourage add-ons.',
          'Florals and styling: from about ₱40,000 for simple setups into the hundreds of thousands for full venue transformations.',
          'Host or emcee: roughly ₱15,000–₱50,000.',
          'Live music (acoustic to full band): about ₱20,000–₱120,000.',
        ],
      },
      {
        type: 'p',
        text: 'A useful rule of thumb: catering and venue together usually take the largest share of a Filipino wedding budget, often more than half. Build those first, then fit the rest around what is left.',
      },
      {
        type: 'h2',
        text: 'How to budget without surprises',
      },
      {
        type: 'ul',
        items: [
          'Get every quote as an itemized inclusions list, not just a package price.',
          'Set aside a 10–15% buffer for the small things that always appear — extra hours, corkage, transport, and overtime.',
          'Confirm the payment schedule and what each milestone covers before you pay a deposit.',
          'Compare at least three suppliers per category so you know where the market actually sits.',
        ],
      },
      {
        type: 'cta',
        text: 'Track every supplier, deposit, and payment milestone in one budget — free with your Setnayan workspace.',
        href: '/signup',
        label: 'Start your budget free',
      },
      {
        type: 'p',
        text: 'When you are ready to shortlist, browsing verified suppliers side by side — with the styles and cities they actually serve — makes the ranges above concrete for your specific date and place.',
      },
      {
        type: 'cta',
        text: 'See verified Filipino wedding vendors filtered by your city and category.',
        href: '/explore',
        label: 'Browse vendors',
      },
    ],
  },
  {
    slug: 'civil-vs-church-wedding-philippines',
    cover: '/blog/ceremony.webp',
    coverAlt: 'The veil-and-cord rite draped over a kneeling couple in a sunlit church',
    title: 'Civil vs. church wedding in the Philippines: which is right for you?',
    excerpt:
      'Requirements, timeline, and cost differences between a civil and a church wedding — and how to choose.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-03',
    blocks: [
      {
        type: 'p',
        text: 'Every Filipino couple faces this early question: civil or church? Both result in a legally married couple — the difference is in the ceremony, the requirements, the timeline, and the feel of the day. Here is a clear comparison to help you decide, whether you want a quiet signing or a full liturgical celebration.',
      },
      {
        type: 'h2',
        text: 'What they share',
      },
      {
        type: 'p',
        text: 'Both a civil and a church wedding require a marriage licence from the local civil registrar where either of you resides. The licence has a 10-day posting period before release and is valid for 120 days from issue, anywhere in the Philippines. Both also need valid government IDs, the licence, and — if either of you is 18 to 25 — a parental consent or advice document.',
      },
      {
        type: 'quote',
        text: 'Both make you legally married. The difference is the ceremony, the requirements, and the feel of the day.',
      },
      {
        type: 'h2',
        text: 'The civil wedding',
      },
      {
        type: 'p',
        text: 'A civil ceremony is officiated by a judge, mayor, or other authorized officer. It is simpler, faster, and far less expensive — often the practical choice for couples who want to be married now and celebrate later, or who prefer a small, private moment.',
      },
      {
        type: 'ul',
        items: [
          'Officiant: judge, mayor, or other authorized solemnizing officer.',
          'Setting: city or municipal hall, or a venue the officer agrees to.',
          'Timeline: can be arranged within weeks once the licence is ready.',
          'Cost: minimal beyond the licence and modest officiant fees.',
        ],
      },
      {
        type: 'h2',
        text: 'The church wedding',
      },
      {
        type: 'p',
        text: 'A church wedding adds the religious sacrament and, for many Filipino families, the emotional heart of the day. It also adds requirements and lead time. A Catholic wedding, for example, typically asks for recent baptismal and confirmation certificates with a "for marriage" annotation, a Pre-Cana or pre-marriage seminar, canonical interviews, and marriage banns posted in your parishes.',
      },
      {
        type: 'ul',
        items: [
          'Officiant: priest, pastor, imam, or minister of your faith.',
          'Setting: your parish or chosen place of worship.',
          'Timeline: start 6–12 months ahead — seminars, certificates, and church calendars take time.',
          'Cost: church and sacristy fees plus the requirements above, on top of the licence.',
        ],
      },
      {
        type: 'h2',
        text: 'How to choose',
      },
      {
        type: 'p',
        text: 'Choose civil if you value simplicity, speed, and lower cost, or if a religious ceremony is not part of your story. Choose church if the sacrament and the tradition matter to you and your families. Many couples do both — a civil wedding for the legal date and a church celebration later — which is perfectly common and entirely up to you.',
      },
      {
        type: 'cta',
        text: 'Setnayan adapts your plan to your ceremony type — Catholic, civil, INC, Christian, Muslim, cultural, or mixed.',
        href: '/how-it-works',
        label: 'See how planning adapts',
      },
    ],
  },
  {
    slug: 'filipino-wedding-entourage-guide-ninong-ninang-sponsors',
    cover: '/blog/nugget.webp',
    coverAlt: 'Thirteen golden arrhae coins resting in an open ceremonial chest',
    title: 'The Filipino wedding entourage, explained: ninong, ninang, and sponsors',
    excerpt:
      'Who stands where and does what — principal sponsors, secondary sponsors, and the bearers in a Filipino wedding.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-09',
    blocks: [
      {
        type: 'p',
        text: 'The Filipino wedding entourage is bigger and more meaningful than in many other traditions. Beyond the couple and their immediate party, it includes principal sponsors who serve as witnesses and lifelong guides, secondary sponsors who perform the candle, veil, and cord rites, and a charming cast of bearers. Here is who is who, and what each role does.',
      },
      {
        type: 'h2',
        text: 'Principal sponsors — ninong and ninang',
      },
      {
        type: 'p',
        text: 'Principal sponsors are the couple\'s most honoured guests: respected married couples — godparents, mentors, or close family friends — chosen to witness the marriage and to guide the newlyweds for life. They sign as official witnesses and are usually seated in places of honour. Couples often invite several pairs, balancing the bride\'s and groom\'s sides.',
      },
      {
        type: 'h2',
        text: 'Secondary sponsors — the three rites',
      },
      {
        type: 'p',
        text: 'Secondary sponsors are typically younger friends or relatives who perform the three symbolic rites during a Catholic or Christian ceremony.',
      },
      {
        type: 'ul',
        items: [
          'Candle sponsors light two candles, symbolizing the light of God\'s presence in the marriage.',
          'Veil sponsors drape a veil over the couple, symbolizing being clothed as one.',
          'Cord sponsors place a figure-eight cord (the yugal) over the couple, symbolizing everlasting union.',
        ],
      },
      {
        type: 'h2',
        text: 'The bearers and the rest of the party',
      },
      {
        type: 'p',
        text: 'The bearers are often the crowd favourites — usually children who walk ahead of the bride.',
      },
      {
        type: 'ul',
        items: [
          'Ring bearer carries the wedding rings.',
          'Coin bearer carries the arrhae — 13 coins blessed and given by the groom as a pledge of provision.',
          'Bible bearer carries the Bible and rosary.',
          'Flower girls scatter petals along the aisle.',
          'Maid or matron of honour and the best man stand closest to the couple, with bridesmaids and groomsmen completing the party.',
        ],
      },
      {
        type: 'h2',
        text: 'Building your list',
      },
      {
        type: 'p',
        text: 'There is no fixed number — your entourage should reflect the people who matter most, balanced against the size of your ceremony space. Decide your principal sponsors early, since they are often the hardest schedules to align, then fill in the secondary sponsors and bearers as your guest list takes shape.',
      },
      {
        type: 'cta',
        text: 'Setnayan\'s guest list includes 20 Filipino role tiers — sponsors, bearers, ninong, ninang, and more — so everyone is placed and counted.',
        href: '/signup',
        label: 'Build your guest list free',
      },
    ],
  },
  {
    slug: 'wedding-budget-breakdown-philippines',
    cover: '/blog/budget.webp',
    coverAlt: 'Wedding rings, invitations and florals styled on a wooden table',
    title: 'Wedding budget breakdown: where the money actually goes',
    excerpt:
      'A realistic percentage breakdown of a Filipino wedding budget — so you know what to spend where before you commit.',
    category: 'planning',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-04',
    blocks: [
      {
        type: 'p',
        text: 'Whatever your total budget, the proportions tend to hold. Knowing roughly how a Filipino wedding budget splits up before you start booking keeps you from overspending early and scrambling later. Here is a realistic breakdown to plan against — adjust the totals to your number, but keep the shape.',
      },
      {
        type: 'h2',
        text: 'The big three (about 60–70%)',
      },
      {
        type: 'p',
        text: 'Venue, catering, and your photo-and-video team almost always take the largest share. Decide these first; everything else fits around what is left.',
      },
      {
        type: 'ul',
        items: [
          'Reception venue: roughly 20–25% (often bundled with catering).',
          'Catering and beverage: roughly 25–35% — it scales straight with your headcount, so the guest list is really a budget lever.',
          'Photo and video: roughly 10–15% — the one spend that outlives the day.',
        ],
      },
      {
        type: 'h2',
        text: 'The middle tier (about 20–25%)',
      },
      {
        type: 'ul',
        items: [
          'Attire (gown, suit, entourage): 5–10%.',
          'Florals, styling, and decor: 8–12%.',
          'Hair and makeup: 3–5%.',
          'Music and entertainment: 3–6%.',
        ],
      },
      {
        type: 'h2',
        text: 'The smaller line items — and the buffer',
      },
      {
        type: 'p',
        text: 'Stationery, the cake, the host, transportation, the marriage licence and church fees, and gifts for sponsors round out the rest. Whatever your total, set aside a 10–15% contingency. Overtime, corkage, extra hours, and last-minute additions are not "if" — they are "when".',
      },
      {
        type: 'cta',
        text: 'Plan every line item and log every payment against it — the budget tool is free with your Setnayan workspace.',
        href: '/signup',
        label: 'Start your budget free',
      },
    ],
  },
  {
    slug: 'marriage-license-requirements-philippines',
    cover: '/blog/hero.webp',
    coverAlt: 'A Filipino couple together at golden hour, planning ahead',
    title: 'Marriage licence in the Philippines: a step-by-step guide',
    excerpt:
      'Where to apply, what to bring, the 10-day wait, and the 120-day validity — the licence process, demystified.',
    category: 'planning',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-06',
    blocks: [
      {
        type: 'p',
        text: 'Every legal wedding in the Philippines — civil or church — needs a marriage licence. The process is straightforward once you know the steps, but it has built-in waiting periods that catch couples off guard. Start it about two to three months before the wedding so it is valid on the day, not expired and not issued too late.',
      },
      {
        type: 'h2',
        text: 'Where to apply',
      },
      {
        type: 'p',
        text: 'Apply at the Office of the Civil Registrar in the city or municipality where either you or your partner resides. Both of you apply together in person.',
      },
      {
        type: 'h2',
        text: 'What to bring',
      },
      {
        type: 'ul',
        items: [
          'PSA-issued birth certificate for each of you.',
          'CENOMAR (Certificate of No Marriage Record) from the PSA.',
          'Valid government-issued IDs.',
          'Parental consent if either of you is 18–20, or parental advice if 21–25.',
          'Certificate of attendance at the required pre-marriage counseling / family planning seminar (given at the registrar or local health office).',
          'For previously married applicants: the death certificate or annulment/nullity decree, as applicable.',
        ],
      },
      {
        type: 'h2',
        text: 'The 10-day posting and 120-day validity',
      },
      {
        type: 'p',
        text: 'After you file, the registrar posts your application for 10 consecutive days before releasing the licence. Once issued, the licence is valid for 120 days anywhere in the Philippines — if you do not marry within that window, it expires and you start over. Plan the timing so the licence is live on your wedding date with room to spare.',
      },
      {
        type: 'cta',
        text: 'Setnayan tracks the statutory deadlines for your date — licence window included — so nothing lapses.',
        href: '/how-it-works',
        label: 'See how planning adapts',
      },
    ],
  },
  {
    slug: 'how-to-choose-a-wedding-venue-philippines',
    cover: '/blog/venue.webp',
    coverAlt: 'A garden wedding reception lit by warm string lights at dusk',
    title: 'How to choose your wedding venue in the Philippines',
    excerpt:
      'Guest count, weather, and the questions to ask before you sign — a practical guide to picking the right venue.',
    category: 'vendors',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-10',
    blocks: [
      {
        type: 'p',
        text: 'The venue sets the tone, the guest count, and a big slice of the budget for your whole wedding — so it is worth choosing deliberately. Here is how to narrow the field and what to confirm before you put down a deposit.',
      },
      {
        type: 'h2',
        text: 'Start with two numbers',
      },
      {
        type: 'p',
        text: 'Your guest count and your venue budget filter out most options immediately. A space that comfortably seats your headcount with room for the program, buffet, and dance floor matters more than raw square metres — ask for the seated-dinner capacity, not the standing capacity.',
      },
      {
        type: 'h2',
        text: 'Indoor, outdoor, or both',
      },
      {
        type: 'p',
        text: 'Outdoor venues — garden, beach, tented — are gorgeous, but the Philippines has a real rainy season (roughly June to November). If your date falls in it, insist on a solid wet-weather plan: a covered alternative on-site, not just "we will figure it out".',
      },
      {
        type: 'h2',
        text: 'Questions to ask every venue',
      },
      {
        type: 'ul',
        items: [
          'What exactly is included — tables, chairs, sound, lighting, air-conditioning, generator backup?',
          'Is catering in-house, or can we bring our own (and is there corkage)?',
          'How many hours does the rate cover, and what is the overtime charge?',
          'Is there a clear wet-weather backup for outdoor setups?',
          'What are the parking, access, and call-time rules for suppliers?',
        ],
      },
      {
        type: 'cta',
        text: 'Browse 100+ real Philippine wedding venues by city, with capacity and day-rate details.',
        href: '/venues',
        label: 'Explore venues',
      },
    ],
  },
  {
    slug: 'catholic-wedding-requirements-philippines',
    cover: '/blog/ceremony.webp',
    coverAlt: 'A church wedding ceremony bathed in warm light through a tall window',
    title: 'Catholic wedding requirements in the Philippines',
    excerpt:
      'Pre-Cana, marriage banns, and the documents your parish will ask for — and how early to start.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-11',
    blocks: [
      {
        type: 'p',
        text: 'A Catholic church wedding is the heart of the day for many Filipino families — and it comes with its own checklist on top of the civil marriage licence. Requirements vary slightly by parish and diocese, so confirm with your specific church early, but this is what most will ask for.',
      },
      {
        type: 'h2',
        text: 'The core documents',
      },
      {
        type: 'ul',
        items: [
          'Recently issued baptismal and confirmation certificates for both — annotated "for marriage purposes".',
          'PSA birth certificates and your civil marriage licence.',
          'CENOMAR (Certificate of No Marriage Record).',
          'Canonical interview with the parish priest.',
          'Marriage banns posted in the home parishes of both partners.',
          'Certificate of permission or transfer if you are marrying outside your home parish.',
        ],
      },
      {
        type: 'h2',
        text: 'Pre-Cana and the pre-marriage seminars',
      },
      {
        type: 'p',
        text: 'Most parishes require a Pre-Cana seminar — a short marriage-preparation program — plus the civil pre-marriage counseling. Slots fill up, especially in peak months, so book yours as soon as you have a date.',
      },
      {
        type: 'h2',
        text: 'How early to start',
      },
      {
        type: 'p',
        text: 'Begin 6–12 months out. Popular churches book their calendars far ahead, certificates take time to gather and annotate, and the seminars run on their own schedule. Starting early turns a stressful checklist into a calm one.',
      },
      {
        type: 'cta',
        text: 'Setnayan adapts your plan to your ceremony — Catholic, civil, INC, Christian, Muslim, cultural, or mixed — with the right deadlines for each.',
        href: '/how-it-works',
        label: 'See how planning adapts',
      },
    ],
  },
  {
    slug: 'filipino-wedding-traditions-explained',
    cover: '/blog/nugget.webp',
    coverAlt: 'Golden arrhae coins in a ceremonial chest, a Filipino wedding tradition',
    title: 'Filipino wedding traditions, explained',
    excerpt:
      'The candle, veil, and cord; the arrhae; the money dance; and the reception customs that make a Filipino wedding ours.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-12',
    blocks: [
      {
        type: 'p',
        text: 'A Filipino wedding is layered with symbolism — some Spanish-Catholic in origin, some uniquely ours, many simply joyful. Whether you are planning your own or attending as a guest, here is what the moments mean.',
      },
      {
        type: 'h2',
        text: 'The ceremony rites',
      },
      {
        type: 'p',
        text: 'During the ceremony, secondary sponsors perform three symbolic acts: candle sponsors light two candles for God\'s presence in the union; veil sponsors drape a veil over the couple to symbolize being clothed as one; and cord sponsors place a figure-eight cord, the yugal, to represent everlasting union. The groom also gives the arrhae — 13 blessed coins — as a pledge to provide for the family.',
      },
      {
        type: 'quote',
        text: 'The yugal — a figure-eight cord — is draped over the couple to symbolise everlasting union.',
      },
      {
        type: 'h2',
        text: 'Reception customs',
      },
      {
        type: 'ul',
        items: [
          'The money dance (or "prosperity dance") — guests pin bills onto the couple as they dance, a shared wish for prosperity.',
          'The release of doves or butterflies — a symbol of harmony and a long life together.',
          'The cake cutting and wine toast — sharing the first sweet and the first drink as a married couple.',
          'Tossing the bouquet and garter — the lighthearted send-off for the next to marry.',
        ],
      },
      {
        type: 'h2',
        text: 'Regional and modern touches',
      },
      {
        type: 'p',
        text: 'Customs vary across regions and faiths, and many couples now blend tradition with their own ideas — a same-day-edit video, a live band for the first dance, a Pakanta song written just for them. The traditions ground the day; the personal touches make it yours.',
      },
      {
        type: 'cta',
        text: 'Planning your own? Setnayan\'s guest list carries the full Filipino entourage — sponsors, bearers, ninong, and ninang.',
        href: '/signup',
        label: 'Start planning free',
      },
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────────
// The single registry every consumer reads. The 10 hand-written core articles
// first, then the 78 scheduled-drip articles (2026-H2 batches, future-dated
// Mon/Wed/Fri 2026-06-22 → 2026-12-18). The Facebook sweep
// (lib/social/flush.ts) and the public surface both gate on publishedAt, so a
// future-dated article stays invisible until its day — see
// publishedBlogArticles() below.
// ───────────────────────────────────────────────────────────────────────────
export const BLOG_ARTICLES: ReadonlyArray<BlogArticle> = [
  ...CORE_BLOG_ARTICLES,
  ...ARTICLES_CAPTURE,
  ...ARTICLES_STYLING,
  ...ARTICLES_GUESTS,
  ...ARTICLES_MONEY,
  ...ARTICLES_RITUALS,
  ...ARTICLES_REGIONAL,
  ...ARTICLES_SEASON,
  ...ARTICLES_DECNEWS,
];

// ───────────────────────────────────────────────────────────────────────────
// Helpers — parallel to lib/help.ts so the routes read the same way.
//
// Unlike the help corpus, blog posts carry real per-article dates, so the
// sitemap stamps each URL with its own updatedAt ?? publishedAt (honest
// per-row lastmod) rather than one shared BLOG_LASTMOD. BLOG_LASTMOD is kept
// only as the index-level "newest content" hint.
// ───────────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────
// Nuggets — bite-size, shareable wisdom lifted from the guides (owner
// 2026-06-15). Each one taps through to its source article, so the strip is a
// low-maintenance discovery layer, never a separate content type to keep fresh.
// ───────────────────────────────────────────────────────────────────────────

export type BlogNugget = {
  /** The wisdom, plain prose — rendered in the editorial serif. */
  text: string;
  category: BlogCategoryKey;
  /** Slug of the guide this nugget is drawn from (the card links to it). */
  sourceSlug: string;
};

export const BLOG_NUGGETS: ReadonlyArray<BlogNugget> = [
  {
    text: 'A Philippine marriage licence is valid for 120 days — time it so it is still live on your wedding day.',
    category: 'planning',
    sourceSlug: 'marriage-license-requirements-philippines',
  },
  {
    text: 'Catering and venue usually take more than half the budget. Build those first, then fit the rest around what is left.',
    category: 'planning',
    sourceSlug: 'wedding-budget-breakdown-philippines',
  },
  {
    text: 'Book the suppliers who only take one event a day first — photo-and-video, coordinator, and host.',
    category: 'vendors',
    sourceSlug: 'what-to-do-12-months-before-your-philippine-wedding',
  },
  {
    text: 'The yugal — a figure-eight cord — is draped over the couple to symbolise everlasting union.',
    category: 'culture',
    sourceSlug: 'filipino-wedding-traditions-explained',
  },
  {
    text: 'The arrhae: 13 blessed coins the groom gives as a pledge to provide for the family.',
    category: 'culture',
    sourceSlug: 'filipino-wedding-entourage-guide-ninong-ninang-sponsors',
  },
  {
    text: 'Custom gowns commonly need 4–6 months. Order early, then relax.',
    category: 'planning',
    sourceSlug: 'what-to-do-12-months-before-your-philippine-wedding',
  },
];

export const BLOG_LASTMOD = '2026-06-13';

export const ALL_BLOG_ARTICLES: ReadonlyArray<BlogArticle> = [...BLOG_ARTICLES].sort(
  (a, b) => (a.publishedAt < b.publishedAt ? 1 : -1),
);

/** Today's date in PH wall-clock (UTC+8, no DST) as 'YYYY-MM-DD' — matches the
 *  +08:00 convention the Facebook sweep uses, so the public blog reveals an
 *  article the same calendar day FB teases it. */
function phToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * The PUBLIC view of the blog: articles whose publishedAt has arrived. The 78
 * scheduled-drip articles carry future dates, so they stay hidden from the
 * /blog index, the sitemap, and the category chips until their day — the blog
 * reveals on schedule and the sitemap never advertises a future lastmod.
 *
 * Evaluated against the current date each call. The /blog index + sitemap
 * render on demand (dynamic / hourly-ISR), so a future article surfaces on its
 * own PH date with no redeploy. (If these routes were ever statically exported,
 * the cutoff would fall back to build time — still correct, just deploy-paced.)
 *
 * Deliberately NOT used by generateStaticParams or findBlogArticle: every slug
 * stays reachable so a Facebook teaser posted on the article's day (the sweep
 * gates on the same publishedAt at runtime) always resolves, never 404s.
 */
export function publishedBlogArticles(): BlogArticle[] {
  const today = phToday();
  return ALL_BLOG_ARTICLES.filter((a) => a.publishedAt <= today);
}

export function findBlogArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}

export function blogCategoryLabel(key: BlogCategoryKey): string {
  return BLOG_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Categories with at least one published article — the index renders only
 *  these as filter chips so an empty category never shows a dead filter. */
export function blogCategoriesInUse(): BlogCategory[] {
  const published = publishedBlogArticles();
  return BLOG_CATEGORIES.filter((c) =>
    published.some((a) => a.category === c.key),
  );
}

/** Same category first, then most-recent others — used for "Keep reading". */
export function relatedBlogArticles(slug: string, limit = 3): BlogArticle[] {
  const current = findBlogArticle(slug);
  if (!current) return [];
  // "Keep reading" only points at already-published articles, so an early-viewed
  // future article never links to an even-more-future one.
  const published = publishedBlogArticles();
  const sameCategory = published.filter(
    (a) => a.slug !== slug && a.category === current.category,
  );
  const others = published.filter(
    (a) => a.slug !== slug && a.category !== current.category,
  );
  return [...sameCategory, ...others].slice(0, limit);
}

/** Flatten blocks to plain text for JSON-LD articleBody + meta description. */
export function blogPlainText(blocks: ReadonlyArray<BlogBlock>): string {
  return blocks
    .map((b) => {
      if (b.type === 'ul') return b.items.join(' ');
      if (b.type === 'image') return b.caption ?? '';
      // p / h2 / quote / cta all carry a `.text` field.
      return b.text;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Estimated reading time in minutes (~200 wpm, floor of 1). */
export function readingMinutes(blocks: ReadonlyArray<BlogBlock>): number {
  const words = blogPlainText(blocks).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Meta description — prefers the curated excerpt, trims at a word boundary. */
export function blogMetaDescription(article: BlogArticle, max = 155): string {
  const source = article.excerpt || blogPlainText(article.blocks);
  if (source.length <= max) return source;
  const slice = source.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}
