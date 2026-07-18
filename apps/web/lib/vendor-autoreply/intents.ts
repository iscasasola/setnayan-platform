// lib/vendor-autoreply/intents.ts
//
// Deterministic intent classification (Phase 2). Keyword/pattern matching over
// English + Taglish. No LLM. Handoff intents (booking / customization) take
// precedence over factual ones so the bot never auto-answers a message that
// really needs the vendor ("how much for a CUSTOM package" -> customization).

import type { Intent } from './types';

type Rule = { intent: Intent; strong: RegExp[]; weak?: RegExp[] };

// --- Handoff intents (checked first; they win outright) -------------------
// Booking is matched by SPECIFIC phrasings, not a bare "booking" — because
// "may booking pa ba kayo?" ("do you have an opening?") is an AVAILABILITY
// question, not a booking intent. The weak-match handoff (see engine gate) is
// the backstop for any booking phrasing that slips through here.
const BOOKING: RegExp[] = [
  /\bbook\b/i, // the verb ("to book", "we book")
  /\b(make|making) (a |the )?booking\b/i,
  /\ba booking (for|with|na)\b/i,
  /\b(want|wanting|like|ready) to book\b/i,
  /\bbook na\b/i,
  /\balready booked\b/i,
  /\breserv(e|es|ing|ed|ation)\b/i, // reserve / reserving / reserved / reservation
  /\bdown\s?payment\b/i,
  /\bdeposit\b/i,
  /\bproceed with\b/i,
  /\bhow do we (proceed|start|book|pay)\b/i,
  /\b(mag-?book|magpa-?reserve|kunin na)\b/i,
  /\b(lock in|secure)\b[^.?!]{0,24}\b(date|slot|booking|reservation)\b/i,
];

const CUSTOMIZATION: RegExp[] = [
  /\bcustom(ize|ise|ization|isation|ized|ised)?\b/i,
  /\bspecial request\b/i,
  /\b(can|could)\b[^.?!]*\b(adjust|change|modify|tweak|tailor)\b/i,
  // Taglish: bridge the intervening particles (po/ba/bang) with [^.?!]*.
  /\bpwede\b[^.?!]*\b(i-?adjust|adjust|palit|dagdag|bawas|baba|mura)\b/i,
  /\b(mag-?bawas|bawasan)\b[^.?!]*\b(oras|presyo|budget|price)\b/i,
  /\b(bespoke|made to order)\b/i,
  /\b(negotiate|negotiable)\b/i,
  /\b(lower|cheaper)\b[^.?!]*\b(price|rate|cost)\b/i,
  /\bpa-?tawad\b/i,
];

// --- Factual intents (priority = array order) -----------------------------
const FACTUAL: Rule[] = [
  {
    intent: 'availability',
    strong: [
      /\b(are|r) you (free|available)\b/i,
      /\b(available|availabilit)\w*\b[^.?!]*\b(on|for|date|kami|kayo)\b/i,
      /\b(may|meron)\b[^.?!]*\b(booking|slot|available|opening)\b/i,
      /\bopen (on|for|ba|kayo|pa)\b/i,
      /\bfree (on|ba|pa)\b/i,
      /\bfully booked\b/i,
      /\b(any|open) (date|dates|slot|slots)\b/i,
    ],
    weak: [/\b(slot|schedule|calendar)\b/i],
  },
  {
    intent: 'price',
    strong: [
      /\bhow much\b/i,
      /\bmagkano\b/i,
      /\b(price|presyo|rate|rates|quote|quotation)\b/i,
      /\bpackage (price|rate|cost)\b/i,
    ],
    weak: [/\b(cost|budget|pricing)\b/i],
  },
  {
    intent: 'inclusions',
    strong: [
      /\bwhat('| i)?s? included\b/i,
      /\binclusion(s)?\b/i,
      /\b(ano|anong)\b[^.?!]*\bkasama\b/i,
      /\bkasama ba\b/i,
      /\bcomes? with\b/i,
    ],
    weak: [/\binclude(d|s)?\b/i],
  },
  {
    intent: 'coverage',
    strong: [
      /\b(do|can) you (cover|serve|travel to)\b/i,
      /\bavailable in\b/i,
      /\bpwede\b(?:\s+(?:po|ba|bang|na))*\s+sa\b/i, // "pwede po ba sa …"
      /\bcoverage\b/i,
      /\bbased in\b/i,
    ],
    weak: [/\b(area|areas|location|reach)\b/i],
  },
  {
    intent: 'lead_time',
    strong: [
      /\b(this|next|coming) (week|weekend|saturday|sunday|month)\b/i,
      /\blast[- ]?minute\b/i,
      /\b(rush|asap|urgent|urgently)\b/i,
      /\bkailangan\b[^.?!]*\bagad\b/i,
    ],
    weak: [/\bsoon\b/i],
  },
  {
    intent: 'discount',
    strong: [/\bdiscount(s)?\b/i, /\bpromo(s|tion)?\b/i, /\b(may )?sale\b/i, /\bdeal(s)?\b/i],
    weak: [/\bvoucher\b/i],
  },
  {
    intent: 'social_proof',
    strong: [
      /\b(review|reviews|testimonial|testimonials|feedback)\b/i,
      /\b(portfolio|sample|samples)\b/i,
      /\bpast (work|clients|events|weddings)\b/i,
      /\bshow\b[^.?!]*\b(photos|work|portfolio)\b/i,
    ],
    weak: [],
  },
  {
    intent: 'capability',
    strong: [
      /\bdo you (do|offer|have|provide)\b/i,
      /\b(gawa|meron|offer) ba kayo\b/i,
      /\bcan you do\b/i,
    ],
    weak: [/\b(offer|service|services)\b/i],
  },
];

export type Classification = { intent: Intent; confidence: number };

const CONF_STRONG = 0.9;
const CONF_WEAK = 0.6;
const CONF_HANDOFF = 0.95;

function anyMatch(patterns: RegExp[] | undefined, text: string): boolean {
  return !!patterns && patterns.some((re) => re.test(text));
}

export function classifyIntent(rawText: string): Classification {
  const text = (rawText ?? '').toLowerCase();
  if (!text.trim()) return { intent: 'unknown', confidence: 0 };

  // 1) Handoff intents win outright.
  if (anyMatch(BOOKING, text)) return { intent: 'booking', confidence: CONF_HANDOFF };
  if (anyMatch(CUSTOMIZATION, text)) return { intent: 'customization', confidence: CONF_HANDOFF };

  // 2) Factual intents: strong matches first (by priority), then weak.
  for (const rule of FACTUAL) {
    if (anyMatch(rule.strong, text)) return { intent: rule.intent, confidence: CONF_STRONG };
  }
  for (const rule of FACTUAL) {
    if (anyMatch(rule.weak, text)) return { intent: rule.intent, confidence: CONF_WEAK };
  }

  return { intent: 'unknown', confidence: 0 };
}
