/**
 * Per-religion wedding traditions & process guide.
 *
 * Owner-directed 2026-06-03 ("create onboarding that follows the traditions of
 * each religion"). Companion to lib/paperwork.ts: where paperwork.ts is the
 * document + deadline engine (already religion-aware via
 * DOCUMENTS_BY_CEREMONY_TYPE), this module is the human-readable "what makes a
 * {religion} wedding" overview the couple sees — keyed by the same
 * events.ceremony_type. Surfaced on /dashboard/[eventId]/paperwork above the
 * document checklist.
 *
 * The owner's framing: most vendors are multi-religion; the religion-specific
 * dimensions are the ceremonial rite, the officiant, and the food. Each guide
 * therefore tags its items by those dimensions (+ custom + paperwork).
 *
 * ⚠️ CONTENT IS STARTER GUIDANCE — NEEDS OWNER/CLERGY VALIDATION before it's
 * treated as authoritative, especially INC, Muslim, Cultural, and Chinese.
 * It is intentionally general ("confirm with your officiant"); traditions vary
 * by family, parish, region, and community. Keep it editable. A future pass
 * can move this into an admin-editable table (mirrors the planning_deadlines
 * pattern) once the copy is validated.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CeremonyType } from './paperwork';

// Chinese is coming-soon (no couple can hold ceremony_type='chinese' yet), but
// we seed its guide now so activating it later is a flag flip, not new content.
export type TraditionGuideKey = CeremonyType | 'chinese' | 'unknown';

export type TraditionDimension =
  | 'officiant'
  | 'ceremonial'
  | 'food'
  | 'custom'
  | 'paperwork';

export const DIMENSION_LABEL: Record<TraditionDimension, string> = {
  officiant: 'Officiant',
  ceremonial: 'Ceremony',
  food: 'Food',
  custom: 'Custom',
  paperwork: 'Paperwork',
};

export type TraditionItem = {
  dimension: TraditionDimension;
  label: string;
  note: string;
};

export type WeddingTraditionGuide = {
  /** Host-facing religion label. */
  label: string;
  /** One- or two-sentence overview of what defines this religion's wedding. */
  overview: string;
  /** Signature elements, tagged by dimension. */
  items: TraditionItem[];
  /** Who the couple should confirm the specifics with (empty for unknown). */
  confirmWith: string;
};

export const WEDDING_TRADITIONS_GUIDE: Record<TraditionGuideKey, WeddingTraditionGuide> = {
  catholic: {
    label: 'Catholic',
    overview:
      'A sacramental Mass at a Catholic church led by a priest, with principal and secondary sponsors (ninong/ninang) and the cord, veil, and arrhae (coins) traditions.',
    items: [
      { dimension: 'officiant', label: 'Catholic priest', note: 'Booked through your ceremony parish — reserve early, especially for popular dates.' },
      { dimension: 'ceremonial', label: 'Church Mass', note: 'Includes the cord, veil, and arrhae (13 coins), unity candle, and your sponsors.' },
      { dimension: 'custom', label: 'Pre-Cana seminar', note: 'Most parishes require this marriage-prep seminar 60–90 days before — book a slot early.' },
      { dimension: 'paperwork', label: 'Canonical bundle', note: 'Baptismal + confirmation certificates and banns posted for three Sundays, plus the civil license (tracked below).' },
      { dimension: 'food', label: 'Reception catering', note: 'No religious restriction — your menu is open.' },
    ],
    confirmWith: 'your ceremony parish priest',
  },
  civil: {
    label: 'Civil',
    overview:
      'The simplest path — a marriage license and an authorized solemnizing officer, with no religious requirements.',
    items: [
      { dimension: 'officiant', label: 'Judge, mayor, or registrar', note: 'Any officer authorized under the Family Code can solemnize.' },
      { dimension: 'ceremonial', label: 'Brief ceremony', note: 'At city hall or a venue of your choice, with at least two witnesses.' },
      { dimension: 'paperwork', label: '10-day posting', note: 'Your marriage license is posted for 10 days before issuance.' },
      { dimension: 'food', label: 'Reception catering', note: 'No restriction.' },
    ],
    confirmWith: 'your local civil registrar',
  },
  christian: {
    label: 'Christian',
    overview:
      'A pastor-led ceremony — Born Again, Evangelical, or other Christian — centered on worship, vows, and Scripture.',
    items: [
      { dimension: 'officiant', label: 'Pastor or minister', note: 'From your church or fellowship.' },
      { dimension: 'ceremonial', label: 'Church or venue ceremony', note: 'Worship, vows, and a message; the format varies by congregation.' },
      { dimension: 'custom', label: 'Premarital counseling', note: 'Most churches ask couples to complete pastor-led counseling first.' },
      { dimension: 'food', label: 'Reception catering', note: 'No restriction.' },
    ],
    confirmWith: 'your pastor',
  },
  inc: {
    label: 'INC (Iglesia ni Cristo)',
    overview:
      'Held in an INC chapel and officiated by an INC minister, for members of the church.',
    items: [
      { dimension: 'officiant', label: 'INC minister', note: 'Only an INC minister officiates — coordinate through your local congregation.' },
      { dimension: 'ceremonial', label: 'INC chapel', note: 'Held in a Kapilya, following the church’s order of service.' },
      { dimension: 'custom', label: 'Counseling + membership', note: 'Couples complete the church’s marriage counseling; both are typically members.' },
      { dimension: 'food', label: 'Reception catering', note: 'Receptions are usually alcohol-free — confirm with your congregation.' },
    ],
    confirmWith: 'the minister at your local INC congregation',
  },
  muslim: {
    label: 'Muslim',
    overview:
      'A Nikah led by an imam, with a dowry (mahr), a guardian (wali), and witnesses — often registered under the Code of Muslim Personal Laws.',
    items: [
      { dimension: 'officiant', label: 'Imam', note: 'Leads the Nikah; coordinate the documentary requirements with your community imam.' },
      { dimension: 'ceremonial', label: 'Nikah', note: 'Includes the mahr (dowry), the bride’s wali (guardian), and witnesses.' },
      { dimension: 'food', label: 'Halal catering', note: 'Your menu and caterer should be halal-certified.' },
      { dimension: 'paperwork', label: 'Sharia registration', note: 'Registered under PD 1083 via the Sharia District Court (in place of the LGU license in many cases).' },
    ],
    confirmWith: 'your community imam',
  },
  cultural: {
    label: 'Cultural',
    overview:
      'An indigenous Filipino wedding follows your community’s customary rites — these vary widely by tribe (Igorot, Maranao, Tausug, and others).',
    items: [
      { dimension: 'officiant', label: 'Tribal elder or leader', note: 'The rite is led by a recognized elder or community leader.' },
      { dimension: 'ceremonial', label: 'Customary rites', note: 'Specific to your tradition — exchanges, blessings, and attire vary by community.' },
      { dimension: 'custom', label: 'Customary exchanges', note: 'Dowry or gift customs differ by tribe; your elders will guide the specifics.' },
      { dimension: 'paperwork', label: 'Civil registration', note: 'Most couples also register the marriage civilly (license tracked below).' },
    ],
    confirmWith: 'your community elders',
  },
  chinese: {
    label: 'Chinese',
    overview:
      'A Chinese (Tsinoy) wedding centers on the tea ceremony honoring elders, and is often paired with a church or civil rite for the legal marriage.',
    items: [
      { dimension: 'ceremonial', label: 'Tea ceremony', note: 'The couple serves tea to parents and elders, who give blessings and gifts.' },
      { dimension: 'officiant', label: 'Paired ceremony', note: 'The legal/religious rite uses its own officiant; the tea ceremony is led by family.' },
      { dimension: 'food', label: 'Chinese banquet (lauriat)', note: 'A multi-course banquet of symbolic dishes — book a lauriat-capable caterer or restaurant.' },
      { dimension: 'custom', label: 'Betrothal gifts (guo da li)', note: 'A traditional gift exchange between families before the wedding.' },
    ],
    confirmWith: 'your family elders (and the officiant for your paired ceremony)',
  },
  mixed: {
    label: 'Mixed-faith',
    overview:
      'Two traditions blended into one day. Review both partners’ ceremony guides and confirm the order of the day with both officiants.',
    items: [
      { dimension: 'officiant', label: 'Two officiants', note: 'Each tradition’s rite has its own officiant — coordinate timing carefully.' },
      { dimension: 'ceremonial', label: 'Two rites', note: 'E.g. a church ceremony plus a cultural or tea ceremony; sequence them with both sides.' },
      { dimension: 'paperwork', label: 'Combined requirements', note: 'You’ll satisfy the documents for both traditions — the checklist below reflects this.' },
    ],
    confirmWith: 'both officiants',
  },
  unknown: {
    label: 'your',
    overview:
      'Pick your ceremony type on your event to see the traditions, process, and document checklist tailored to your wedding.',
    items: [],
    confirmWith: '',
  },
};

/**
 * DB row shape for an admin-editable tradition item
 * (table `wedding_tradition_items`, migration 20260807000000).
 */
export type TraditionItemRow = {
  item_id: string;
  ceremony_type: string;
  dimension: TraditionDimension;
  label: string;
  note: string;
  sort_order: number;
  is_active: boolean;
};

/**
 * Active tradition items for a religion, from the admin-editable table, ordered
 * by sort_order. Returns null when the table is empty, absent (pre-migration),
 * or unreadable — so the caller (the /paperwork guide) falls back to the code
 * defaults in WEDDING_TRADITIONS_GUIDE. The deploy is therefore safe before the
 * migration is pushed and before an admin loads the starter content.
 */
export async function fetchTraditionItems(
  supabase: SupabaseClient,
  ceremonyType: string,
): Promise<TraditionItem[] | null> {
  const { data, error } = await supabase
    .from('wedding_tradition_items')
    .select('dimension, label, note, sort_order, is_active')
    .eq('ceremony_type', ceremonyType)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data || data.length === 0) return null;
  return data.map((r) => ({
    dimension: r.dimension as TraditionDimension,
    label: r.label as string,
    note: (r.note as string | null) ?? '',
  }));
}
