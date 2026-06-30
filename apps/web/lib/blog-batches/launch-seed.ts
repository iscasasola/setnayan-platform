import type { BlogArticle } from '@/lib/blog';

// Launch-seed Journal articles (owner "seed it", 2026-07-01). Three net-new
// angles that don't duplicate an existing slug: a step-by-step budget build,
// the questions that apply to EVERY vendor (not just photographers), and a
// cross-faith ceremony chooser that hubs the per-faith deep-dives in the
// regional-faith batch. Same BlogArticle shape as every other batch; type-only
// import keeps this module cycle-free. Covers reuse existing /public/blog art.
//
// ─── STAGED, NOT PUBLISHED (owner-safety) ────────────────────────────────────
// publishedAt is set to a far-future sentinel (2099-01-01) ON PURPOSE. Both the
// public surface (publishedBlogArticles → /blog index + sitemap-blog) and the
// Facebook auto-syndication sweep (lib/social/flush.ts · sweepJournalArticles)
// gate on `publishedAt <= today`, so while the date is in the future these three
// articles are:
//   • NOT shown on /blog, NOT in the sitemap, NOT in "Keep reading"/category chips
//   • NOT auto-posted to the Setnayan Facebook page (no FB link-card fires)
// They ARE still pre-rendered (generateStaticParams reads ALL_BLOG_ARTICLES) and
// fully reachable by direct slug, so the loader/renderer + JSON-LD are proven and
// type-checked — they're just unlisted. To GO LIVE, the owner changes each
// publishedAt to the intended launch date (e.g. today); the next social sweep
// then posts each to Facebook, drip-throttled at ≤3/day. Do NOT bulk-publish all
// three on the same back-dated day if you want them spaced on FB.
export const ARTICLES_LAUNCH_SEED: BlogArticle[] = [
  {
    slug: 'how-to-budget-a-philippine-wedding-step-by-step',
    cover: '/blog/budget.webp',
    coverAlt:
      'Gold wedding rings, a letterpress invitation suite and a sprig of eucalyptus arranged on a softly lit table',
    title: 'How to budget a Philippine wedding, step by step',
    excerpt:
      'Build your wedding number from zero — the four steps that turn a scary question into a plan you can actually keep.',
    category: 'planning',
    author: 'Setnayan Editorial',
    // STAGED — far-future sentinel keeps this unlisted + un-posted until the
    // owner sets the real launch date. See the file header note.
    publishedAt: '2099-01-01',
    blocks: [
      {
        type: 'p',
        text: 'Almost every Filipino engagement begins with the same quiet question, usually somewhere near midnight: how much is this going to cost, and can we really afford it? It is a fair fear, because a wedding budget rarely arrives as one number — it sneaks up as a hundred small ones. The good news is that budgeting a wedding is not a talent you are born with. It is four steps, done in order, and anyone can do them. Here is how to build your number from zero and, more importantly, how to keep it.',
      },
      {
        type: 'h2',
        text: 'Step 1 — Decide the total before you fall in love with anything',
      },
      {
        type: 'p',
        text: 'Most couples plan the wedding they dream of and then go looking for the money. Do the opposite. Before you browse a single venue, agree on one figure you can comfortably reach — from your own savings, what family has genuinely committed, and the months you have left to set money aside. Count only what you actually have or will reliably save. Loans and "maybe" contributions do not belong in this number. Pick a total that still lets you sleep at night, and let that figure quietly lead every choice that follows.',
      },
      {
        type: 'quote',
        text: 'A wedding paid for in full is a far better start to married life than a beautiful one you are still paying off a year later.',
      },
      {
        type: 'h2',
        text: 'Step 2 — Split the total the way real weddings split',
      },
      {
        type: 'p',
        text: 'Once you have your number, divide it by what genuinely costs the most. In the Philippines, catering and venue almost always take the largest share — frequently more than half the entire budget — because they scale directly with your guest count. That makes your guest list the single biggest lever you control: trim the list and you free up money everywhere else. Photo and video is usually the next serious line, and the one spend that outlives the day itself. Attire, florals, styling, hair and makeup, and music fill the middle; stationery, the cake, the host, transport, fees, and gifts for sponsors round out the rest.',
      },
      {
        type: 'ul',
        items: [
          'Reception venue and catering: plan these first — they move the total more than anything else, and they follow your headcount.',
          'Photo and video: the memory you keep long after the flowers are gone.',
          'Attire, florals, styling, hair and makeup, music: the middle tier that shapes how the day looks and feels.',
          'Stationery, cake, host, transport, licence and church fees, sponsor gifts: the small items that quietly add up.',
        ],
      },
      {
        type: 'h2',
        text: 'Step 3 — Protect a buffer you promise not to touch',
      },
      {
        type: 'p',
        text: 'The budgets that break are the ones planned to the last peso. Overtime, corkage, a few extra guests, an extra hour of coverage, and small fees you never thought to ask about are not "if" — they are "when". Set aside a contingency of about 10 to 15 percent of your total and treat it as untouchable until the final weeks. If you never need it, it simply becomes the start of your honeymoon fund. The couples who stay calm in the last month are almost never the ones with the most money. They are the ones who always know exactly how much is left.',
      },
      {
        type: 'h2',
        text: 'Step 4 — Track every peso against the plan',
      },
      {
        type: 'p',
        text: 'A budget is only real if you can see it. From the day you pay your first deposit, record every payment against your total so the number on the screen always matches the money in the bank. This is also where booking through a marketplace that takes zero commission on vendor bookings quietly protects you: the price you agree with a supplier is the price you pay, with no hidden platform cut eating into the total you worked so carefully to set. When something has to give later, you trim from the areas you already agreed matter least — calmly, not in a panic three months out.',
      },
      {
        type: 'cta',
        text: 'Build your budget line by line and log every payment against it — the budget tracker is free with your Setnayan workspace.',
        href: '/signup',
        label: 'Start your budget free',
      },
      {
        type: 'p',
        text: 'Four steps: decide the total, split it by what matters, guard a buffer, and watch every peso. Do them in that order and the midnight question answers itself. The wedding becomes the easy part — set na ’yan.',
      },
    ],
  },
  {
    slug: 'questions-to-ask-every-wedding-vendor',
    cover: '/blog/photo.webp',
    coverAlt:
      'A wedding photographer reviewing shots on the back of a camera at a softly lit reception',
    title: 'The questions to ask every wedding vendor before you book',
    excerpt:
      'Ten questions that apply to every supplier — photographer, caterer, florist, or host — so the same headline price never hides two very different deals.',
    category: 'vendors',
    author: 'Setnayan Editorial',
    // STAGED — far-future sentinel keeps this unlisted + un-posted until the
    // owner sets the real launch date. See the file header note.
    publishedAt: '2099-01-01',
    blocks: [
      {
        type: 'p',
        text: 'Here is the trap almost every couple falls into: two suppliers quote the same headline price, you assume they are offering the same thing, and you only discover the difference on your wedding day. Every category has its own specialist questions, but a surprising number cut across all of them. Ask these ten of every vendor you meet — photographer, caterer, florist, host, stylist, or coordinator — and you will compare like with like, avoid the costs that ambush couples later, and book with your eyes open.',
      },
      {
        type: 'h2',
        text: 'Before you book — what you are actually paying for',
      },
      {
        type: 'ul',
        items: [
          'What exactly is included in this price, in writing? An itemised inclusions list, not just a package name, is the only way to compare two quotes honestly.',
          'How many hours of coverage or service does this cover, and what is the overtime rate? Weddings run long — know the price of the extra hour before you need it.',
          'How many people from your team will actually be there on the day? "A photo-and-video team" can mean two people or six.',
          'Is our date available and can you confirm a hold? A verbal "probably" is not a booking.',
          'Do you take more than one event a day? The suppliers who only take one — photo-and-video, coordinator, host — are the ones to lock first.',
        ],
      },
      {
        type: 'quote',
        text: 'The same headline price can hide two completely different deals. The inclusions list, in writing, is where the truth lives.',
      },
      {
        type: 'h2',
        text: 'The money questions couples forget to ask',
      },
      {
        type: 'ul',
        items: [
          'What is the payment schedule, and what does each milestone unlock? Know when money is due and what it secures before you pay a deposit.',
          'What is your cancellation and rescheduling policy? Dates move and storms happen — understand the terms while everyone is still relaxed.',
          'Are there costs that are not in this quote — travel, corkage, meals for your crew, equipment, taxes? These "extras" are where budgets quietly blow out.',
        ],
      },
      {
        type: 'h2',
        text: 'The questions that protect your wedding day',
      },
      {
        type: 'ul',
        items: [
          'What is your backup plan if you or a key team member cannot make it? A professional has an answer to this; an amateur is surprised by the question.',
          'Can we see full, recent work from a wedding like ours — not just the highlight reel? A whole real event tells you far more than a curated five photos.',
        ],
      },
      {
        type: 'p',
        text: 'A good supplier will welcome every one of these. Clear answers, given calmly and put in writing, are themselves a sign you are dealing with a professional. Vagueness, pressure to decide today, or irritation at being asked are all quiet warnings worth listening to.',
      },
      {
        type: 'cta',
        text: 'Browse verified Filipino wedding suppliers by city, category, and the styles they specialise in — then bring these questions to your shortlist.',
        href: '/explore',
        label: 'Explore the vendor marketplace',
      },
      {
        type: 'p',
        text: 'Get answers to these ten and the rest of the conversation becomes specific — the shot list with your photographer, the menu with your caterer, the palette with your florist. The general questions clear the fog; then the fun part begins.',
      },
    ],
  },
  {
    slug: 'choosing-your-ceremony-by-faith-philippines',
    cover: '/blog/ceremony.webp',
    coverAlt:
      'The veil-and-cord rite draped over a kneeling couple in a sunlit Filipino church',
    title: 'Choosing your ceremony by faith: a Filipino couple’s guide',
    excerpt:
      'Catholic, Christian, INC, Muslim, civil, or mixed — how the faith you choose shapes your requirements, timeline, and the feel of the day.',
    category: 'culture',
    author: 'Setnayan Editorial',
    // STAGED — far-future sentinel keeps this unlisted + un-posted until the
    // owner sets the real launch date. See the file header note.
    publishedAt: '2099-01-01',
    blocks: [
      {
        type: 'p',
        text: 'The Philippines is one of the most quietly diverse places in the world to get married. Catholic and Christian rites, Iglesia ni Cristo and Aglipayan ceremonies, Muslim weddings in the south, Chinese-Filipino tea ceremonies layered over a church Mass, and simple civil signings all happen here, often within the same family. The faith you choose shapes three things: the requirements you gather, how early you must start, and the feel of the day itself. Here is how to think it through — and where to read deeper on each path.',
      },
      {
        type: 'h2',
        text: 'What every ceremony shares',
      },
      {
        type: 'p',
        text: 'Whatever your faith, a legal wedding in the Philippines needs a marriage licence from the civil registrar where either of you resides. It carries a 10-day posting period before release and is valid for 120 days from issue, anywhere in the country. Faith decides the ceremony; the licence is the law underneath all of them. Begin there, then layer your tradition on top.',
      },
      {
        type: 'quote',
        text: 'Faith shapes the ceremony; the marriage licence is the law beneath all of them. Start with the licence, then layer your tradition on top.',
      },
      {
        type: 'h2',
        text: 'The Catholic and Christian path',
      },
      {
        type: 'p',
        text: 'For many Filipino families this is the emotional heart of the day — and it asks for the most lead time. A Catholic wedding typically requires recently issued baptismal and confirmation certificates annotated "for marriage", a Pre-Cana seminar, a canonical interview, and marriage banns posted in your parishes. Other Christian denominations have their own counselling and membership requirements. Start six to twelve months out: popular churches book their calendars far ahead and the seminars run on their own schedule.',
      },
      {
        type: 'h2',
        text: 'INC, Aglipayan, and Born-Again ceremonies',
      },
      {
        type: 'p',
        text: 'Iglesia ni Cristo weddings are held within the church and generally ask that both partners are members in good standing, so the timeline is shaped by membership and counselling rather than outside certificates. Aglipayan (Philippine Independent Church) ceremonies feel familiar to anyone raised Catholic but follow their own parish requirements. Born-Again and other evangelical weddings centre on the pastor’s premarital counselling and the local congregation’s guidance. In each case, the single best first step is the same: talk to your minister early and ask for their checklist in writing.',
      },
      {
        type: 'h2',
        text: 'Muslim, civil, and mixed-faith weddings',
      },
      {
        type: 'p',
        text: 'A Muslim (nikah) wedding follows Islamic rites and, in parts of Mindanao, the Code of Muslim Personal Laws, with its own solemnising officers and customs. A civil wedding — officiated by a judge or mayor — is the simplest and fastest path, ideal for couples who want to be married now and celebrate later, or who prefer a small, private moment. And many Filipino couples are mixed-faith: the gentlest approach is usually to honour both, whether through one ceremony that blends traditions or two distinct celebrations. None of these is a lesser choice; each is simply a different shape for the same promise.',
      },
      {
        type: 'ul',
        items: [
          'Catholic: most documents, longest lead time, deeply traditional — start 6–12 months out.',
          'Christian / INC / Aglipayan / Born-Again: counselling and membership-led — ask your minister for the checklist first.',
          'Muslim (nikah): Islamic rites and, in some regions, Muslim personal law — confirm with your solemnising officer.',
          'Civil: fastest and simplest — arrangeable within weeks once the licence is ready.',
          'Mixed-faith: honour both, in one blended ceremony or two — decide early so every supplier briefs correctly.',
        ],
      },
      {
        type: 'p',
        text: 'Choose the path that is true to who you are and to the families standing with you. There is no wrong answer — only the one that will feel right when you look back on it.',
      },
      {
        type: 'cta',
        text: 'Setnayan adapts your plan to your ceremony — Catholic, civil, INC, Christian, Muslim, cultural, or mixed — with the right deadlines for each.',
        href: '/how-it-works',
        label: 'See how planning adapts',
      },
    ],
  },
];

// Facebook curiosity-hook captions (optional — falls back to excerpt if absent).
// Benefit-led, opens a gap the article closes, no quoted prices. These only ever
// reach Facebook once the matching article's publishedAt arrives (it's staged in
// the future today — see ARTICLES_LAUNCH_SEED header).
export const HOOKS_LAUNCH_SEED: Record<string, string> = {
  'how-to-budget-a-philippine-wedding-step-by-step':
    "The midnight question every engaged couple Googles: how much will this actually cost? Here’s how to build your number from zero — and keep it. 💍",
  'questions-to-ask-every-wedding-vendor':
    "Two suppliers, the same price, two completely different deals. The 10 questions that reveal the difference — before you book, not on the day. 📋",
  'choosing-your-ceremony-by-faith-philippines':
    "Catholic, civil, INC, Muslim, or mixed-faith? The path you choose quietly shapes your timeline, your paperwork, and the feel of the day. Here’s how to choose. ⛪🕊️",
};
