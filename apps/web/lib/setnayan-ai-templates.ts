/**
 * setnayan-ai-templates.ts — the Setnayan AI template library + renderer.
 *
 * Every message Setnayan AI sends is a TEMPLATE with data slots. The rule engine
 * decides WHICH template fires (a later PR) and pours in values from data the app
 * already stores; `renderTemplate()` resolves terminology + substitutes slots.
 * No language model renders anything → the assistant stays DETERMINISTIC and
 * FREE (cost ≈ storage). The moment any copy is LLM-generated it flips to
 * per-use cost — so this file is, deliberately, pure string substitution.
 *
 * Source of truth for the copy + voice rules: corpus
 * `Setnayan_AI_Template_Library.md` (v1.1). 33 templates × 5 categories
 * (Secretary 9 · Guard 10 · Commend 4 · Inference 5 · Trend 5).
 *
 * FOUNDATION PR — this is the library DATA + the renderer only. Nothing fires
 * yet; the trigger engine, weekly-digest assembly, consent-gated Inference/Trend
 * activation, and term-pass SKUs land in later inert PRs. Client-safe: it imports
 * ONLY a type from event-type-profile (erased at build), so it can run on either
 * side of the boundary.
 */
import type { ProfileTerminology } from './event-type-profile';

export type TemplateCategory =
  | 'secretary'
  | 'guard'
  | 'commend'
  | 'inference'
  | 'trend';

/** Whether the AI may act-then-report, or must ask first (Decision 6, default ask). */
export type TemplateAutonomy = 'ask' | 'act_then_report';

/** Which event types a template applies to (via the 0053 terminology slots). */
export type TemplateEnabled = 'all' | 'wedding_only';

export type SetnayanAiTemplate = {
  id: string;
  category: TemplateCategory;
  enabledFor: TemplateEnabled;
  autonomy: TemplateAutonomy;
  /**
   * Copy variants keyed by name. Most templates have a single `default`; the
   * weekly receipt (SEC-01) has `busy` + `quiet`. Copy uses `{slot}` tokens —
   * terminology slots (resolved from the profile) + data slots (passed in).
   */
  copy: Record<string, string>;
  /** Data slot names the trigger engine must supply (terminology slots excluded). */
  slots: string[];
};

// The two terminology fields the copy actually uses, structurally typed so the
// renderer needs only these (and stays decoupled from the full profile object).
type RenderTerminology = Pick<ProfileTerminology, 'organizerNoun' | 'eventWord'>;

/** Wedding default — used when no profile is threaded (byte-identical to today). */
export const WEDDING_TERMINOLOGY: RenderTerminology = {
  organizerNoun: 'couple',
  eventWord: 'wedding',
};

/** Deterministic English pluralizer for the organizer noun (couple→couples, family→families). */
function pluralize(noun: string): string {
  if (/[^aeiou]y$/i.test(noun)) return noun.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(noun)) return noun + 'es';
  return noun + 's';
}

/** Terminology-derived slots available to every template (from the event-type profile). */
function terminologySlots(t: RenderTerminology): Record<string, string> {
  return {
    organizer: t.organizerNoun,
    organizers: pluralize(t.organizerNoun),
    event: t.eventWord,
    date_label: `${t.eventWord} date`,
  };
}

export class TemplateNotFoundError extends Error {}
export class TemplateVariantError extends Error {}

/**
 * Render a template to its final string. Pure: terminology resolution + slot
 * substitution, no I/O, no model. Unknown `{tokens}` are left intact (surfaced
 * by tests) rather than throwing, so a missing data slot degrades visibly
 * instead of crashing a render.
 */
export function renderTemplate(
  id: string,
  data: Record<string, string | number> = {},
  terminology: RenderTerminology = WEDDING_TERMINOLOGY,
  variant = 'default',
): string {
  const tpl = SETNAYAN_AI_TEMPLATES[id];
  if (!tpl) throw new TemplateNotFoundError(`Unknown template: ${id}`);
  const copy = tpl.copy[variant];
  if (copy === undefined) {
    throw new TemplateVariantError(`Template ${id} has no variant "${variant}"`);
  }
  const slots: Record<string, string> = { ...terminologySlots(terminology) };
  for (const [k, v] of Object.entries(data)) slots[k] = String(v);
  return copy.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = slots[key];
    return value === undefined ? match : value;
  });
}

/** Templates enabled for a given event type (terminology + the enabledFor gate). */
export function templatesForEventType(eventType: string): SetnayanAiTemplate[] {
  const isWedding = eventType === 'wedding';
  return Object.values(SETNAYAN_AI_TEMPLATES).filter(
    (t) => t.enabledFor === 'all' || (t.enabledFor === 'wedding_only' && isWedding),
  );
}

// ============================================================================
// THE LIBRARY — 35 templates. Copy is verbatim from the corpus v1.1 (voice
// micro-rules: warm, plain, inform-never-pressure, praise-only-when-earned).
// ============================================================================

export const SETNAYAN_AI_TEMPLATES: Record<string, SetnayanAiTemplate> = {
  // ---- 1 · SECRETARY -------------------------------------------------------
  'SEC-01': {
    id: 'SEC-01',
    category: 'secretary',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['checked_count', 'on_track_count', 'flags', 'next_task', 'horizon_item'],
    copy: {
      busy:
        'This week I checked {checked_count} things on your {event} — {on_track_count} on track.\n{flags}\nNext up: {next_task}.',
      quiet:
        'Calm week — everything’s on track. One thing on the horizon: {horizon_item}.',
    },
  },
  'SEC-02': {
    id: 'SEC-02',
    category: 'secretary',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['category', 'weeks', 'top2', 'differentiator'],
    copy: {
      default:
        'You’ve been weighing {category} for {weeks} weeks. Based on your budget, {date_label}, and the style you keep picking, I’d look hardest at these two: {top2}. The main difference: {differentiator}.',
    },
  },
  'SEC-03': {
    id: 'SEC-03',
    category: 'secretary',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['category', 'new_count', 'relaxed_filter'],
    copy: {
      default:
        'Still nothing right for {category}? I found {new_count} more if we relax {relaxed_filter} a little. Want to see them?',
    },
  },
  'SEC-04': {
    id: 'SEC-04',
    category: 'secretary',
    enabledFor: 'all',
    autonomy: 'act_then_report',
    slots: ['vendor', 'days', 'service', 'date_label_value'],
    copy: {
      default: '{vendor} hasn’t replied in {days} days. Want me to send a nudge?',
      draft:
        'Hi {vendor}, following up on our inquiry about {service} for {date_label_value}. Are you available, and could you share a quote? Thank you!',
    },
  },
  'SEC-05': {
    id: 'SEC-05',
    category: 'secretary',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'amount', 'inclusions', 'vs_benchmark', 'category'],
    copy: {
      default:
        '{vendor} quoted ₱{amount} ({inclusions}). That’s {vs_benchmark} for {category} in your area. Want to compare it against your shortlist?',
    },
  },
  'SEC-06': {
    id: 'SEC-06',
    category: 'secretary',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['next_task', 'why_now'],
    copy: {
      default:
        'Nice — that’s locked. Next, while there’s time: {next_task} ({why_now}).',
    },
  },
  'SEC-07': {
    id: 'SEC-07',
    category: 'secretary',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['date', 'count', 'category_list'],
    copy: {
      default:
        'Most of your picks ({count} so far) point to {date}. Want me to do a focused search around that date, or stay open to others?',
    },
  },
  'SEC-08': {
    id: 'SEC-08',
    category: 'secretary',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['category', 'found_count', 'suggestion'],
    copy: {
      default:
        'Your {category} options are running thin ({found_count}). I can widen the search by {suggestion} — want me to?',
    },
  },
  'SEC-09': {
    id: 'SEC-09',
    category: 'secretary',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['locked', 'total', 'remaining_highlight'],
    copy: {
      default:
        'You’ve locked {locked} of {total} key categories — solid progress. The big one left: {remaining_highlight}.',
    },
  },

  // ---- 2 · GUARD -----------------------------------------------------------
  'GRD-01': {
    id: 'GRD-01',
    category: 'guard',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'amount', 'due_date', 'days_left'],
    copy: {
      default:
        'Heads up — your {vendor} payment (₱{amount}) is due {due_date}, {days_left} days away.',
    },
  },
  'GRD-02': {
    id: 'GRD-02',
    category: 'guard',
    enabledFor: 'wedding_only',
    autonomy: 'ask',
    slots: ['document', 'deadline', 'days_left'],
    copy: {
      default:
        'Your {document} needs attention — {deadline} ({days_left} days). I’ll remind you again at 30 days.',
    },
  },
  'GRD-03': {
    id: 'GRD-03',
    category: 'guard',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'old_price', 'new_price', 'category'],
    copy: {
      default:
        '{vendor} (on your {category} shortlist) went from ₱{old_price} to ₱{new_price}. Lock it in, or want alternatives?',
    },
  },
  'GRD-04': {
    id: 'GRD-04',
    category: 'guard',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'signal'],
    copy: {
      default:
        'A note on {vendor}: {signal}. Worth a quick check-in before you commit further — want me to draft a message?',
    },
  },
  'GRD-05': {
    id: 'GRD-05',
    category: 'guard',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['over_amount', 'top_driver_category'],
    copy: {
      default:
        'You’re ₱{over_amount} over budget right now — mostly {top_driver_category}. Want me to find a few places to trim, or raise the total?',
    },
  },
  'GRD-06': {
    id: 'GRD-06',
    category: 'guard',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['item_a', 'item_b', 'slot'],
    copy: {
      default:
        'Two things land on {slot}: {item_a} and {item_b}. That’s a clash — want to resolve it now?',
    },
  },
  'GRD-07': {
    id: 'GRD-07',
    category: 'guard',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'window_type', 'deadline'],
    copy: {
      default:
        'Your {window_type} window with {vendor} closes {deadline}. If anything’s uncertain, decide before then — after that, changes may cost.',
    },
  },
  'GRD-08': {
    id: 'GRD-08',
    category: 'guard',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor'],
    copy: {
      default:
        'Quick check — {vendor} isn’t verified on Setnayan yet. Confirm their details before sending money. Want tips on paying safely?',
    },
  },
  'GRD-09': {
    id: 'GRD-09',
    category: 'guard',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'date', 'status'],
    copy: {
      default:
        '{vendor}’s availability for {date} just changed ({status}). If they’re a top pick, lock them soon — want me to reach out?',
    },
  },
  'GRD-10': {
    id: 'GRD-10',
    category: 'guard',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'category', 'date', 'backup_count'],
    copy: {
      default:
        '{vendor} fell through for {category}. I already found {backup_count} open on {date} — want to see them now?',
    },
  },

  // ---- 3 · COMMEND ---------------------------------------------------------
  'CMD-01': {
    id: 'CMD-01',
    category: 'commend',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'review_count', 'avg_stars', 'events_this_month'],
    copy: {
      default:
        'Great choice. {vendor} has {review_count} reviews at {avg_stars}★ and finished {events_this_month} events this month — you’re in good hands.',
    },
  },
  'CMD-02': {
    id: 'CMD-02',
    category: 'commend',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'events_this_month', 'avg_stars'],
    copy: {
      default:
        'For context: {vendor} has done {events_this_month} events this month at {avg_stars}★, and their calendar is filling for your date.',
    },
  },
  'CMD-03': {
    id: 'CMD-03',
    category: 'commend',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['ahead_descriptor'],
    copy: {
      default:
        'You’re {ahead_descriptor} for your timeline — genuinely ahead of the curve. Nicely done.',
    },
  },
  'CMD-04': {
    id: 'CMD-04',
    category: 'commend',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['vendor', 'category', 'below_amount'],
    copy: {
      default:
        'Good eye — you booked {vendor} about ₱{below_amount} under what {organizers} like you typically pay for {category}.',
    },
  },

  // ---- 4 · INFERENCE (consent-gated activation; data here is inert) --------
  'INF-01': {
    id: 'INF-01',
    category: 'inference',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['attribute', 'value'],
    copy: {
      default:
        'I noticed you keep looking at {value} {attribute}. Want me to lean that way across your shortlist — or are you still exploring?',
    },
  },
  'INF-02': {
    id: 'INF-02',
    category: 'inference',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['service', 'existing_vendor'],
    copy: {
      default:
        'You’re looking at {service} — {existing_vendor}, who you’ve already booked, also offers it. Add it with them instead of hiring separately?',
    },
  },
  'INF-03': {
    id: 'INF-03',
    category: 'inference',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['direction', 'category'],
    copy: {
      default:
        'Your {category} picks keep landing {direction} your stated budget. Want me to update the budget, or re-filter to it?',
    },
  },
  'INF-04': {
    id: 'INF-04',
    category: 'inference',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['area'],
    copy: {
      default:
        'Your vendors cluster around {area}. Want me to anchor proximity there for the rest of your search?',
    },
  },
  'INF-05': {
    id: 'INF-05',
    category: 'inference',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['category', 'days'],
    copy: {
      default:
        'You’ve been browsing {category} for {days} days without reaching out. Stuck on something? I can narrow it down or send inquiries for you.',
    },
  },

  // ---- 5 · TREND (aggregate, min-N gated; consent-gated activation) --------
  'TRD-01': {
    id: 'TRD-01',
    category: 'trend',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['percent', 'cohort_descriptor', 'service'],
    copy: {
      default:
        '{percent}% of {organizers} like you ({cohort_descriptor}) added {service}. Worth a look for yours?',
    },
  },
  'TRD-02': {
    id: 'TRD-02',
    category: 'trend',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['category', 'median_spend', 'cohort_descriptor'],
    copy: {
      default:
        'For reference, {organizers} like you ({cohort_descriptor}) spent around ₱{median_spend} on {category}.',
    },
  },
  'TRD-03': {
    id: 'TRD-03',
    category: 'trend',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['category', 'typical_timing', 'cohort_descriptor'],
    copy: {
      default:
        'Most {organizers} like you book {category} by {typical_timing}. You’ve got room, but it’s worth starting soon.',
    },
  },
  'TRD-04': {
    id: 'TRD-04',
    category: 'trend',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['a', 'b', 'percent'],
    copy: {
      default:
        '{percent}% of {organizers} who booked {a} also arranged {b} — want me to check your options?',
    },
  },
  'TRD-05': {
    id: 'TRD-05',
    category: 'trend',
    enabledFor: 'all',
    autonomy: 'ask',
    slots: ['category', 'date', 'availability_signal'],
    copy: {
      default:
        'A heads-up grounded in real bookings: {category} availability for {date} is {availability_signal}. No rush, but earlier is easier.',
    },
  },
};

/** Count guard for tests + sanity: the library is exactly 33 templates. */
export const SETNAYAN_AI_TEMPLATE_COUNT = Object.keys(SETNAYAN_AI_TEMPLATES).length;
