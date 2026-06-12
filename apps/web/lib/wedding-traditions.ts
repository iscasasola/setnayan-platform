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
      { dimension: 'officiant', label: 'Catholic priest', note: 'Booked through the ceremony parish — reserve early; some parishes ask you to belong to the parish or to secure a permit if you marry elsewhere.' },
      { dimension: 'ceremonial', label: 'Nuptial Mass', note: 'Includes the veil and cord (yugal) draped over the couple, the arrhae (13 coins), a unity candle, and the principal + secondary sponsors.' },
      { dimension: 'custom', label: 'Pre-Cana + canonical interview', note: 'Most parishes require a marriage-preparation seminar (Pre-Cana) plus a one-on-one canonical interview with the priest — arrange 2–3 months ahead.' },
      { dimension: 'paperwork', label: 'Canonical documents', note: 'Recent baptismal + confirmation certificates annotated “for marriage purposes,” banns posted three Sundays in each home parish, plus the civil marriage license (tracked below).' },
      { dimension: 'food', label: 'Reception', note: 'No religious restriction on the menu.' },
    ],
    confirmWith: 'your ceremony parish priest',
  },
  civil: {
    label: 'Civil',
    overview:
      'The simplest path — a marriage license and an authorized solemnizing officer, with no religious requirements.',
    items: [
      { dimension: 'officiant', label: 'Judge, mayor, or registrar', note: 'Any officer authorized under the Family Code (judge, mayor, consul, or a registered solemnizing officer) may officiate.' },
      { dimension: 'ceremonial', label: 'Brief ceremony', note: 'At city hall or a venue of your choice, with at least two witnesses of legal age.' },
      { dimension: 'custom', label: 'Pre-marriage counseling', note: 'Many LGUs require a marriage-counseling / family-planning seminar before releasing the license.' },
      { dimension: 'paperwork', label: 'Marriage license', note: 'Applied for at the local civil registrar; posted 10 days before issuance, then valid 120 days nationwide.' },
      { dimension: 'food', label: 'Reception', note: 'No restriction.' },
    ],
    confirmWith: 'your local civil registrar',
  },
  christian: {
    label: 'Christian',
    overview:
      'A pastor-led ceremony — Born Again, Evangelical, or other Protestant — centered on worship, vows, and Scripture.',
    items: [
      { dimension: 'officiant', label: 'Pastor or minister', note: 'From your church or fellowship; for the marriage to be legal the officiant must be a solemnizing officer registered with the civil registrar.' },
      { dimension: 'ceremonial', label: 'Church or venue ceremony', note: 'Worship, exchange of vows, and a message; the order of service varies by congregation.' },
      { dimension: 'custom', label: 'Premarital counseling', note: 'Most churches ask the couple to complete pastor-led counseling first.' },
      { dimension: 'paperwork', label: 'Marriage license', note: 'The civil marriage license still applies (tracked below).' },
      { dimension: 'food', label: 'Reception', note: 'No restriction (some congregations prefer an alcohol-free program — confirm with your church).' },
    ],
    confirmWith: 'your pastor',
  },
  inc: {
    label: 'INC (Iglesia ni Cristo)',
    overview:
      'Held in an Iglesia ni Cristo chapel (Kapilya) and officiated by an INC minister, for members of the Church.',
    items: [
      { dimension: 'officiant', label: 'INC minister', note: 'Only an INC minister officiates — arrange through your local congregation (lokal).' },
      { dimension: 'ceremonial', label: 'INC chapel (Kapilya)', note: 'Held in the chapel following the Church’s order of service; modest, formal attire is expected.' },
      { dimension: 'custom', label: 'Members in good standing', note: 'Both parties are INC members; a non-member partner first studies the doctrine and is baptized into the Church. Pre-marital guidance is given by the ministry.' },
      { dimension: 'food', label: 'Reception', note: 'Receptions are kept alcohol-free, with a wholesome program and music — confirm specifics with your congregation.' },
      { dimension: 'paperwork', label: 'Marriage license', note: 'The civil marriage license applies (tracked below).' },
    ],
    confirmWith: 'the minister at your local INC congregation',
  },
  muslim: {
    label: 'Muslim',
    overview:
      'A Nikah (marriage contract) led by an imam, with a dower (mahr), the bride’s guardian (wali), and witnesses — registered under the Code of Muslim Personal Laws (PD 1083).',
    items: [
      { dimension: 'officiant', label: 'Imam', note: 'Solemnizes the Nikah; coordinate the requirements with your community imam.' },
      { dimension: 'ceremonial', label: 'Nikah (akad)', note: 'The marriage contract: the groom’s mahr (dower) to the bride, the bride’s wali (guardian) giving consent, and two Muslim witnesses.' },
      { dimension: 'custom', label: 'Walima + modesty', note: 'A Walima (wedding feast) is customarily hosted; celebrations often keep separate areas for men and women and observe modest dress.' },
      { dimension: 'food', label: 'Halal catering', note: 'The menu and caterer should be halal-certified — no pork, no alcohol.' },
      { dimension: 'paperwork', label: 'Shari’a registration', note: 'Registered under the Code of Muslim Personal Laws (PD 1083) via the Shari’a Circuit Court / Circuit Registrar, in place of the LGU license in many cases.' },
    ],
    confirmWith: 'your community imam',
  },
  cultural: {
    label: 'Cultural',
    overview:
      'An indigenous Filipino wedding follows your community’s customary rites — which vary widely by people (Igorot/Cordillera, Maranao, Tausug, Manobo, T’boli, and others).',
    items: [
      { dimension: 'officiant', label: 'Elder or community leader', note: 'The rite is led by a recognized elder, datu, or community leader.' },
      { dimension: 'ceremonial', label: 'Customary rites', note: 'Specific to your tradition — the rituals, blessings, and attire differ by community. Your ceremony sub-type captures which one.' },
      { dimension: 'custom', label: 'Bride-price + exchanges', note: 'Many traditions involve a dowry / bride-price and a series of family exchanges; your elders guide the specifics and timing.' },
      { dimension: 'food', label: 'Traditional fare', note: 'Often a community feast with traditional dishes; no fixed restriction.' },
      { dimension: 'paperwork', label: 'Civil registration', note: 'Most couples also register the marriage civilly (license tracked below) so it is legally recognized.' },
    ],
    confirmWith: 'your community elders',
  },
  chinese: {
    label: 'Chinese',
    overview:
      'A Chinese (Tsinoy) wedding centers on the tea ceremony honoring elders, and is usually paired with a church or civil rite for the legal marriage.',
    items: [
      { dimension: 'ceremonial', label: 'Tea ceremony', note: 'The couple serves tea to parents and elders in order of seniority; elders give blessings and gifts (jewelry or ang pao / red envelopes).' },
      { dimension: 'custom', label: 'Auspicious date', note: 'A lucky wedding date and time is chosen (Chinese almanac / a family elder or feng-shui consultant) — settle this early, as it anchors everything.' },
      { dimension: 'custom', label: 'Betrothal gifts (guo da li)', note: 'Gifts are exchanged between the two families before the wedding to formalise the union.' },
      { dimension: 'ceremonial', label: 'Attire', note: 'The bride often wears a red qipao / cheongsam for the tea ceremony (red = luck and joy), and a gown for the paired church or civil rite.' },
      { dimension: 'food', label: 'Lauriat banquet', note: 'A multi-course banquet of symbolic dishes (whole fish, long-life noodles, etc.) — book a lauriat-capable restaurant or caterer.' },
      { dimension: 'officiant', label: 'Paired rite', note: 'The legal/religious ceremony uses its own officiant (priest or registrar); the tea ceremony itself is family-led.' },
    ],
    confirmWith: 'your family elders (and the officiant for your paired ceremony)',
  },
  aglipayan: {
    label: 'Aglipayan (IFI)',
    overview:
      'A liturgical wedding at an Iglesia Filipina Independiente (Aglipayan) parish, led by an IFI priest — the rite closely mirrors the Catholic Mass, including the cord, veil, and arrhae traditions.',
    items: [
      { dimension: 'officiant', label: 'IFI priest', note: 'Booked through your Aglipayan parish; arrange the date with the parish office early.' },
      { dimension: 'ceremonial', label: 'Nuptial liturgy', note: 'Vows, ring exchange, and the familiar Filipino veil, cord, and arrhae traditions with principal sponsors.' },
      { dimension: 'custom', label: 'Marriage preparation', note: 'Most parishes ask for a marriage-preparation session with the priest — confirm the parish’s specific requirements.' },
      { dimension: 'paperwork', label: 'Marriage license', note: 'The civil marriage license applies (tracked below); the parish may also ask for baptismal records.' },
      { dimension: 'food', label: 'Reception', note: 'No religious restriction on the menu.' },
    ],
    confirmWith: 'your IFI parish priest',
  },
  lds: {
    label: 'LDS (Latter-day Saints)',
    overview:
      'A Latter-day Saint chapel ceremony officiated by a bishop or authorized officiant — simple, reverent, and family-centered. (Temple sealings follow separate Church requirements.)',
    items: [
      { dimension: 'officiant', label: 'Bishop or LDS officiant', note: 'Arranged through your ward bishop; he must be a registered solemnizing officer for the marriage to be legally recognized.' },
      { dimension: 'ceremonial', label: 'Chapel ceremony', note: 'A short, reverent service with vows and ring exchange; modest dress is expected.' },
      { dimension: 'custom', label: 'Bishop interviews', note: 'The couple meets with the bishop beforehand; members in good standing may later pursue a temple sealing.' },
      { dimension: 'food', label: 'Reception', note: 'Receptions are alcohol-free, and coffee and tea are not served (Word of Wisdom).' },
      { dimension: 'paperwork', label: 'Marriage license', note: 'The civil marriage license applies (tracked below).' },
    ],
    confirmWith: 'your ward bishop',
  },
  sda: {
    label: 'Seventh-day Adventist',
    overview:
      'A pastor-led Adventist ceremony centered on Scripture, vows, and prayer — typically not held on the Sabbath (Friday sundown to Saturday sundown).',
    items: [
      { dimension: 'officiant', label: 'Adventist pastor', note: 'From your local congregation; the pastor must be a registered solemnizing officer.' },
      { dimension: 'ceremonial', label: 'Church ceremony', note: 'Worship, message, vows, and ring exchange; schedule outside Sabbath hours — Sunday weddings are common.' },
      { dimension: 'custom', label: 'Premarital counseling', note: 'Most congregations ask the couple to complete pastoral counseling first.' },
      { dimension: 'food', label: 'Reception', note: 'Alcohol-free, and many Adventist families keep a vegetarian or at minimum pork-free and shellfish-free table — confirm with both families.' },
      { dimension: 'paperwork', label: 'Marriage license', note: 'The civil marriage license applies (tracked below).' },
    ],
    confirmWith: 'your pastor',
  },
  jw: {
    label: 'Jehovah’s Witnesses',
    overview:
      'A modest Kingdom Hall ceremony built around a Bible-based marriage talk by an elder, followed by the vows and ring exchange.',
    items: [
      { dimension: 'officiant', label: 'Congregation elder', note: 'An approved elder gives the marriage talk and solemnizes; arrange through your congregation and confirm he is a registered solemnizing officer.' },
      { dimension: 'ceremonial', label: 'Kingdom Hall ceremony', note: 'A short, dignified program — song, prayer, the marriage talk, vows, and ring exchange.' },
      { dimension: 'custom', label: 'Modest celebration', note: 'Receptions are kept modest and well-supervised; toasts and certain customs are typically omitted — plan the program with your elders.' },
      { dimension: 'food', label: 'Reception', note: 'No fixed restriction; celebrations emphasize moderation.' },
      { dimension: 'paperwork', label: 'Marriage license', note: 'The civil marriage license applies (tracked below).' },
    ],
    confirmWith: 'the elders at your congregation',
  },
  hindu: {
    label: 'Hindu',
    overview:
      'A mandap ceremony led by a pandit — with the kanyadaan, the sacred fire, the pheras (circumambulations), and the saptapadi (seven steps) at its heart.',
    items: [
      { dimension: 'officiant', label: 'Pandit (priest)', note: 'Conducts the rites in Sanskrit with explanations; for legal recognition in the PH, pair with a registered solemnizing officer or a civil rite.' },
      { dimension: 'ceremonial', label: 'Mandap + pheras', note: 'The couple circles the sacred fire and takes the saptapadi (seven steps); sindoor and mangalsutra mark the union.' },
      { dimension: 'custom', label: 'Mehndi + sangeet', note: 'Pre-wedding mehndi (bridal henna) and sangeet (music night) celebrations are customary; an auspicious date (muhurat) is chosen with the pandit.' },
      { dimension: 'food', label: 'Vegetarian fare', note: 'Many Hindu wedding feasts are vegetarian, and beef is avoided — confirm the menu with both families.' },
      { dimension: 'paperwork', label: 'Civil registration', note: 'Register the marriage civilly (license tracked below) so it is legally recognized.' },
    ],
    confirmWith: 'your pandit',
  },
  sikh: {
    label: 'Sikh',
    overview:
      'The Anand Karaj (“blissful union”) at the gurdwara — the couple circles the Guru Granth Sahib during the four laavan hymns.',
    items: [
      { dimension: 'officiant', label: 'Granthi', note: 'The granthi (reader) conducts the Anand Karaj at the gurdwara; for PH legal recognition, pair with a registered solemnizing officer or a civil rite.' },
      { dimension: 'ceremonial', label: 'Anand Karaj + laavan', note: 'Four laavan rounds around the Guru Granth Sahib; heads are covered and shoes removed in the darbar hall.' },
      { dimension: 'custom', label: 'Palla + karah prasad', note: 'The palla (scarf) joins the couple for the laavan; karah prasad is shared with the congregation after the ardas.' },
      { dimension: 'food', label: 'Langar', note: 'Food served at the gurdwara is vegetarian and alcohol-free; the outside reception menu is the families’ choice.' },
      { dimension: 'paperwork', label: 'Civil registration', note: 'Register the marriage civilly (license tracked below) so it is legally recognized.' },
    ],
    confirmWith: 'the granthi at your gurdwara',
  },
  buddhist: {
    label: 'Buddhist',
    overview:
      'A blessing ceremony with monks — chanting, offerings, and a water blessing — usually paired with a civil rite for the legal marriage.',
    items: [
      { dimension: 'officiant', label: 'Monks (blessing)', note: 'Monks chant and bless the union but typically do not solemnize; pair with a civil rite or registered solemnizing officer for legal effect.' },
      { dimension: 'ceremonial', label: 'Chanting + water blessing', note: 'Offerings to the monks, paritta chanting, and the blessing — often with a sacred thread or water poured over the couple’s hands.' },
      { dimension: 'custom', label: 'Merit-making', note: 'Couples often make merit (dana — offering a meal or alms to the monks) on or before the wedding day; an auspicious date may be chosen.' },
      { dimension: 'food', label: 'Reception', note: 'No fixed restriction; vegetarian options are appreciated and monks are served before noon.' },
      { dimension: 'paperwork', label: 'Civil registration', note: 'Register the marriage civilly (license tracked below) so it is legally recognized.' },
    ],
    confirmWith: 'your temple’s monks',
  },
  orthodox: {
    label: 'Orthodox Christian',
    overview:
      'The crowning ceremony (the Mystery of Crowning) at an Orthodox church — betrothal with rings, crowns held over the couple, the common cup, and the Dance of Isaiah.',
    items: [
      { dimension: 'officiant', label: 'Orthodox priest', note: 'Arrange with the Orthodox parish; at least one partner is typically an Orthodox Christian in good standing — the priest advises on mixed marriages.' },
      { dimension: 'ceremonial', label: 'Betrothal + crowning', note: 'Ring exchange at the betrothal, crowns (stefana) over the couple, the shared common cup, and the procession around the table (Dance of Isaiah).' },
      { dimension: 'custom', label: 'Fasting seasons', note: 'Weddings are not celebrated during major fasting seasons (e.g., Great Lent) — set the date with the priest before booking anything.' },
      { dimension: 'food', label: 'Reception', note: 'No religious restriction on the menu, though fasting-season dates affect scheduling more than food.' },
      { dimension: 'paperwork', label: 'Marriage license', note: 'The civil marriage license applies (tracked below); the parish may ask for baptismal records.' },
    ],
    confirmWith: 'your Orthodox parish priest',
  },
  mixed: {
    label: 'Mixed-faith',
    overview:
      'Two traditions blended into one celebration. Review both partners’ ceremony guides and confirm the order of the day with both officiants.',
    items: [
      { dimension: 'officiant', label: 'Two officiants', note: 'Each tradition’s rite has its own officiant — coordinate sequence and timing carefully.' },
      { dimension: 'ceremonial', label: 'Two rites', note: 'E.g. a church ceremony plus a cultural or tea ceremony; agree the order with both families.' },
      { dimension: 'paperwork', label: 'One legal marriage', note: 'The marriage is legally registered once (a single civil license); the second rite is ceremonial. You’ll satisfy both traditions’ requirements — the checklist below reflects this.' },
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
