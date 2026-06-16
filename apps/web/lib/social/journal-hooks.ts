import 'server-only';

/**
 * Teaser captions for the Journal → Facebook auto-syndication sweep
 * (lib/social/flush.ts · sweepJournalArticles). One curiosity-hook line per
 * published /blog article — used verbatim as the Facebook post body.
 *
 * How the post renders: the article URL rides as the post's `link_url`, so
 * Facebook attaches its native LINK CARD (the article's OpenGraph cover +
 * title + description) beneath this caption. The hook's only job is to earn
 * the tap — it should open a curiosity gap the article closes, never restate
 * the title. No quoted prices (they drift · public-surface hygiene); benefit-
 * led, Filipino-wedding voice.
 *
 * Keyed by BlogArticle.slug. An article with no entry here falls back to its
 * own `excerpt` (still a clean one-liner) — so a new daily article posts fine
 * even before a bespoke hook is written. To give a future article a hook,
 * add its slug here.
 */
export const JOURNAL_SOCIAL_HOOKS: Record<string, string> = {
  'free-printable-wedding-checklist-philippines':
    "Planning a Filipino wedding and not sure where to begin? We made a free, printable checklist that takes you from “yes” to “I do” — every step, none of the overwhelm. ✨",
  'what-to-do-12-months-before-your-philippine-wedding':
    "12 months out and quietly panicking? Here’s exactly what to lock in first — and what can happily wait. Save yourself the 2am spiral. 👇",
  'how-much-do-wedding-suppliers-cost-philippines':
    "The honest answer to the question every couple Googles at midnight: how much do wedding suppliers in the Philippines actually cost? Real ranges, no surprises.",
  'civil-vs-church-wedding-philippines':
    "Civil or church? It’s not only about faith — it’s timelines, paperwork, and a few things you can’t undo later. The honest trade-offs, before you decide. ⛪",
  'filipino-wedding-entourage-guide-ninong-ninang-sponsors':
    "Ninong, ninang, secondary sponsors, the cord, the veil, the coins… who does what — and how many do you really need? The entourage, finally explained. 🤍",
  'wedding-budget-breakdown-philippines':
    "Ever wonder where your wedding budget actually disappears to? Here’s the real breakdown — plus the line items couples almost always forget. 📊",
  'marriage-license-requirements-philippines':
    "The marriage licence trips up nearly every couple. Here’s the step-by-step — where to go, what to bring, and how long it really takes. 📋",
  'how-to-choose-a-wedding-venue-philippines':
    "Your venue quietly decides almost everything else. Here’s how to choose the right one — beyond just the view and the date. 📍",
  'catholic-wedding-requirements-philippines':
    "Getting married in the Church? There’s a checklist most couples don’t see until it’s late. Everything you’ll need — and when to start. ⛪",
  'filipino-wedding-traditions-explained':
    "From the cord and veil to the money dance and the doves — the meaning behind every Filipino wedding tradition, in one read. 🕊️",
};
