/**
 * Specialty RECOMMENDATIONS — the first consumer of the captured per-type
 * signature signals (events.signature_details → Brief `specialty.fields`).
 *
 * Under Rule 1 this is deterministic authored intelligence: per-type rules read
 * what the couple/host actually captured (the debut's cotillion + 18 Candles, the
 * christening's godparents, the anniversary's tribute, the gender-reveal's secret
 * keeper…) and SUGGEST + RECOMMEND concrete next steps. It never acts — it only
 * recommends. Output is checklist-SHAPED (key/title/reason/category/dueOffsetDays)
 * so the checklist surface can adopt it as suggested tasks without re-modelling.
 *
 * Pure in/out, no I/O, no LLM — the same captured bag always yields the same
 * recommendations. Empty/absent signals → [] (we never invent a recommendation we
 * can't back with a captured signal).
 *
 * CONSUMPTION SURFACE (coordinated next step): feed these into the DB-seeded
 * checklist (`event_checklist_items` via checklist-actions `ensureSeeded`/sync)
 * as suggested items, keyed by `key` so they de-dupe against the static template.
 * The nudge-template engine (the parallel workstream's intended consumer) can read
 * the same recommendations — both surfaces, one deterministic source.
 */

/** A recommended next step, shaped to drop into the checklist as a suggested task. */
export type SpecialtyRecommendation = {
  /** Stable de-dupe key (prefix by type). */
  key: string;
  /** The recommended action, in the couple's voice. */
  title: string;
  /** Why we're recommending it — grounded in a captured signal. */
  reason: string;
  /** Checklist category (matches ChecklistTemplateItem.category). */
  category: 'foundations' | 'vendors' | 'paperwork' | 'logistics' | 'attire' | 'guests';
  /** Lead time before the event (days), for scheduling the suggestion. */
  dueOffsetDays: number;
};

type Sig = Record<string, unknown>;

const rows = (sig: Sig, k: string): unknown[] => (Array.isArray(sig[k]) ? (sig[k] as unknown[]) : []);
const str = (sig: Sig, k: string): string => (typeof sig[k] === 'string' ? (sig[k] as string).trim() : '');
const truthy = (sig: Sig, k: string): boolean => {
  const v = sig[k];
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  return v === true || (typeof v === 'number' && Number.isFinite(v));
};

const RULES: Record<string, (sig: Sig) => SpecialtyRecommendation[]> = {
  debut(sig) {
    const out: SpecialtyRecommendation[] = [];
    if (rows(sig, 'cotillion').length > 0 || str(sig, 'debut_variant').includes('cotillion')) {
      out.push({
        key: 'debut_cotillion_rehearsals',
        title: 'Confirm your cotillion court & schedule rehearsals',
        reason: "You're planning a cotillion — lock the court and start the 4–8 weeks of rehearsals early.",
        category: 'vendors',
        dueOffsetDays: 110,
      });
    }
    const candles = rows(sig, 'eighteen_candles').length;
    if (candles > 0) {
      out.push({
        key: 'debut_collect_candle_messages',
        title: 'Collect a message from each of your 18 Candles',
        reason: `You've named ${candles} of your 18 Candles — gather their messages before the program.`,
        category: 'logistics',
        dueOffsetDays: 30,
      });
    }
    if (rows(sig, 'eighteen_treasures').length > 0) {
      out.push({
        key: 'debut_confirm_treasures',
        title: 'Coordinate the 18 Treasures gifts',
        reason: 'Make sure each treasure-giver knows the gift they’re bringing.',
        category: 'logistics',
        dueOffsetDays: 30,
      });
    }
    const peg = str(sig, 'theme_peg');
    if (peg) {
      out.push({
        key: 'debut_brief_stylist_peg',
        title: `Brief your stylist on your “${peg}” peg`,
        reason: 'Share your peg so the styling and décor match your vision.',
        category: 'vendors',
        dueOffsetDays: 120,
      });
    }
    return out;
  },

  christening(sig) {
    const out: SpecialtyRecommendation[] = [];
    const sponsors = rows(sig, 'godparents_principal').length + rows(sig, 'godparents_secondary').length;
    if (sponsors > 0) {
      out.push({
        key: 'christening_collect_sponsor_certs',
        title: 'Collect each godparent’s confirmation certificate',
        reason: `You've listed ${sponsors} ninong/ninang — the parish needs each sponsor’s confirmation cert.`,
        category: 'paperwork',
        dueOffsetDays: 60,
      });
    }
    const parish = str(sig, 'officiant_parish');
    if (parish) {
      out.push({
        key: 'christening_seminar',
        title: 'Book the pre-baptism seminar with your sponsors',
        reason: `${parish} will require the pre-baptism seminar before the rite — schedule it early.`,
        category: 'paperwork',
        dueOffsetDays: 45,
      });
    }
    return out;
  },

  anniversary(sig) {
    const out: SpecialtyRecommendation[] = [];
    if (truthy(sig, 'tribute_program') || truthy(sig, 'original_event_date')) {
      out.push({
        key: 'anniversary_gather_photos',
        title: 'Start gathering old photos for your tribute video',
        reason: 'The “then & now” retrospective is the long pole — start collecting from relatives now.',
        category: 'logistics',
        dueOffsetDays: 60,
      });
    }
    if (truthy(sig, 'renewal_of_vows')) {
      out.push({
        key: 'anniversary_renewal',
        title: 'Coordinate your renewal-of-vows ceremony',
        reason: 'You’re renewing your vows — line up the officiant and the program.',
        category: 'paperwork',
        dueOffsetDays: 60,
      });
    }
    return out;
  },

  birthday(sig) {
    const out: SpecialtyRecommendation[] = [];
    if (truthy(sig, 'palabunutan') || rows(sig, 'palabunutan_prizes').length > 0) {
      out.push({
        key: 'birthday_palabunutan',
        title: 'Prepare your palabunutan prizes',
        reason: 'You’re doing a palabunutan — line up the prizes and the draw.',
        category: 'logistics',
        dueOffsetDays: 21,
      });
    }
    const milestone = str(sig, 'milestone_type');
    if (milestone) {
      out.push({
        key: 'birthday_milestone_program',
        title: 'Plan your milestone program (tribute AVP + messages)',
        reason: `A ${milestone} calls for a program — plan the tribute video and the messages.`,
        category: 'logistics',
        dueOffsetDays: 45,
      });
    }
    return out;
  },

  gender_reveal(sig) {
    const out: SpecialtyRecommendation[] = [];
    const keeper = str(sig, 'secret_keeper');
    if (keeper) {
      out.push({
        key: 'reveal_confirm_secret_keeper',
        title: 'Confirm your secret-keeper has the sealed result',
        reason: `${keeper} is holding the secret — double-check they have it sealed and ready for the reveal.`,
        category: 'logistics',
        dueOffsetDays: 14,
      });
    }
    const method = str(sig, 'reveal_method');
    if (method) {
      out.push({
        key: 'reveal_book_supplier',
        title: `Book your reveal supplier for the ${method}`,
        reason: `You picked a ${method} reveal — book the supplier and the reaction capture (the #1 keepsake).`,
        category: 'vendors',
        dueOffsetDays: 30,
      });
    }
    if (truthy(sig, 'guessing_game')) {
      out.push({
        key: 'reveal_team_game',
        title: 'Set up your Team Pink vs Team Blue guessing game',
        reason: 'You’re running a guessing game — prep the voting so guests are in on the reveal.',
        category: 'logistics',
        dueOffsetDays: 14,
      });
    }
    return out;
  },

  reunion(sig) {
    const out: SpecialtyRecommendation[] = [];
    if (truthy(sig, 'reunion_shirt')) {
      out.push({
        key: 'reunion_shirts',
        title: 'Collect shirt sizes & place your print order',
        reason: 'You’re doing matching reunion shirts — gather sizes early so they’re ready for the group photo.',
        category: 'logistics',
        dueOffsetDays: 30,
      });
    }
    if (rows(sig, 'balikbayan_honorees').length > 0) {
      out.push({
        key: 'reunion_lock_date',
        title: 'Confirm the balikbayan’s travel dates & lock the reunion date',
        reason: 'Your reunion is built around a returning relative — lock the date to their trip first.',
        category: 'foundations',
        dueOffsetDays: 60,
      });
    }
    return out;
  },

  graduation(sig) {
    const out: SpecialtyRecommendation[] = [];
    if (str(sig, 'celebration_type').includes('mass') || truthy(sig, 'school_alma_mater')) {
      out.push({
        key: 'graduation_thanksgiving_mass',
        title: 'Book your thanksgiving Mass',
        reason: 'A graduation thanksgiving is a Mass first — reserve the church around the ceremony date.',
        category: 'paperwork',
        dueOffsetDays: 45,
      });
    }
    return out;
  },

  corporate(sig) {
    const out: SpecialtyRecommendation[] = [];
    if (truthy(sig, 'blessing_ceremony')) {
      out.push({
        key: 'corporate_blessing',
        title: 'Arrange the blessing ceremony',
        reason: 'You’re opening with a blessing — book the officiant and slot it into the program.',
        category: 'logistics',
        dueOffsetDays: 30,
      });
    }
    return out;
  },
};

/**
 * Deterministic per-type recommendations from the captured signature signals.
 * Returns [] for an unknown type or when nothing was captured to recommend on.
 */
export function specialtyRecommendations(
  eventType: string | null | undefined,
  signatureDetails: Sig | null | undefined,
): SpecialtyRecommendation[] {
  if (!eventType || !signatureDetails) return [];
  const rule = RULES[eventType];
  return rule ? rule(signatureDetails) : [];
}
