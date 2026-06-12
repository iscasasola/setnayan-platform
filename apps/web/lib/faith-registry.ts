/**
 * Faith registry — the single TS source for every couple-facing faith list.
 *
 * Why this exists (events×faiths audit 2026-06-11 → owner batch 2026-06-12):
 * faith pickers/labels/copy lived in ~17 independent hardcoded maps, so the
 * 2026-06-12 worldwide expansion (8 new faiths in faith_vocab) reached the DB,
 * the marketplace maps, and the matching layer — but NOT the onboarding layer,
 * meaning a faith flipped 'active' in /admin/wedding-types would never grow a
 * chip. Every UI list now derives from this registry; adding a faith = one DB
 * row + ONE entry here.
 *
 * Division of labor (deliberate — don't collapse further):
 *  - `wedding_type_launch_status` (DB) decides which faiths are LIVE — pickers
 *    read it at runtime; `defaultSoon` below is only the offline/error fallback.
 *  - `faith_vocab` (DB) is the marketplace taxonomy authority; `faithCol` here
 *    MUST mirror its Title-Case keys exactly (NEVER lowercase — the
 *    marketplace `[Faith:]` filter is a case-sensitive `===`).
 *  - `CEREMONY_TYPE_TO_FAITH` (lib/taxonomy-filters.ts) stays the tested,
 *    load-bearing matching map; a unit invariant pins this registry to it.
 */

/**
 * The literal key tuple — the compile-time spine. `OnboardingFaith` derives
 * from this, so every exhaustive `Record<OnboardingFaith, …>` in the app
 * FAILS typecheck until it covers a newly added faith (that's the point).
 */
export const FAITH_KEY_TUPLE = [
  'catholic',
  'muslim',
  'inc',
  'chinese',
  'born_again',
  'christian',
  'cultural',
  'jewish',
  'aglipayan',
  'lds',
  'sda',
  'jw',
  'hindu',
  'sikh',
  'buddhist',
  'orthodox',
] as const;

export type FaithKey = (typeof FAITH_KEY_TUPLE)[number];

export type FaithRegistryEntry = {
  /** events.ceremony_type key — lowercase, matches the DB CHECK + launch rows. */
  key: FaithKey;
  /** Title-Case marketplace faith key (faith_vocab / `[Faith:]` tags). */
  faithCol: string;
  /** Chip + recap display label. */
  label: string;
  /** One-liner under the option in the conversational intro. */
  desc: string;
  /** The intro's warm reaction line after the couple picks this faith. */
  react: string;
  /** Hero photo (existing asset key — new faiths reuse the closest scene). */
  photoImg: string;
  /** Hero caption. */
  photoCap: string;
  /**
   * Fallback "coming soon" flag used ONLY when the launch-status read fails;
   * the live answer always comes from wedding_type_launch_status.
   */
  defaultSoon: boolean;
};

/**
 * Order = chip display order: the 8 original faiths keep their shipped order,
 * the 2026-06-12 worldwide additions follow.
 */
export const FAITH_REGISTRY: readonly FaithRegistryEntry[] = [
  {
    key: 'catholic',
    faithCol: 'Catholic',
    label: 'Catholic',
    desc: 'The country’s largest tradition — about 1 in 3 weddings.',
    react:
      'A Catholic ceremony — we’ll line up your canonical interview, seminar and papers so nothing slips.',
    photoImg: 'wed_catholic',
    photoCap: 'A Catholic wedding',
    defaultSoon: false,
  },
  {
    key: 'muslim',
    faithCol: 'Muslim',
    label: 'Muslim',
    desc: 'A Nikah ceremony.',
    react: 'Maligayang bati. We’ll quietly pre-set halal catering and your Nikah customs.',
    photoImg: 'wed_muslim',
    photoCap: 'A Muslim wedding',
    defaultSoon: false,
  },
  {
    key: 'inc',
    faithCol: 'INC',
    label: 'INC',
    desc: 'Iglesia ni Cristo.',
    react: 'We’ll respect every INC protocol — your reception comes pre-set alcohol-free.',
    photoImg: 'wed_inc',
    photoCap: 'An INC wedding',
    defaultSoon: false,
  },
  {
    key: 'chinese',
    faithCol: 'Chinese',
    label: 'Chinese',
    desc: 'Tea ceremony & double-happiness traditions.',
    react: 'Wonderful — we’ll weave in your tea ceremony and double-happiness details.',
    photoImg: 'wed_chinese',
    photoCap: 'A Chinese wedding',
    defaultSoon: false,
  },
  {
    key: 'born_again',
    faithCol: 'Born Again',
    label: 'Born Again',
    desc: 'Born-again Christian churches.',
    react: 'Beautiful — we’ll match a pastor and worship team who fit your church.',
    photoImg: 'wed_bornagain',
    photoCap: 'A Born Again wedding',
    defaultSoon: false,
  },
  {
    key: 'christian',
    faithCol: 'Christian',
    label: 'Christian',
    desc: 'Evangelical, Protestant & born-again churches.',
    react: 'Beautiful. We’ll match a church and an officiant who fit your congregation.',
    photoImg: 'wed_christian',
    photoCap: 'A garden Christian wedding',
    defaultSoon: false,
  },
  {
    key: 'cultural',
    faithCol: 'Cultural',
    label: 'Cultural',
    desc: 'Indigenous & tribal rites.',
    react: 'How meaningful. We’ll honor your community’s traditions, step by step.',
    photoImg: 'wed_cultural',
    photoCap: 'A traditional Filipino wedding',
    defaultSoon: false,
  },
  {
    key: 'jewish',
    faithCol: 'Jewish',
    label: 'Jewish',
    desc: 'A chuppah ceremony.',
    react: 'Mazel tov! We’ll line up your rabbi and your chuppah.',
    photoImg: 'wed_jewish',
    photoCap: 'A Jewish wedding',
    defaultSoon: false,
  },
  // ── 2026-06-12 worldwide expansion (coming_soon until the owner flips each
  // active in /admin/wedding-types; photos reuse the closest existing scene
  // until per-faith imagery is produced) ──
  {
    key: 'aglipayan',
    faithCol: 'Aglipayan',
    label: 'Aglipayan',
    desc: 'Iglesia Filipina Independiente.',
    react: 'A proudly Filipino church — we’ll match an IFI priest and parish.',
    photoImg: 'wed_catholic',
    photoCap: 'An Aglipayan wedding',
    defaultSoon: true,
  },
  {
    key: 'lds',
    faithCol: 'LDS',
    label: 'LDS',
    desc: 'Latter-day Saints.',
    react: 'We’ll plan with care around your temple and chapel guidelines.',
    photoImg: 'wed_christian',
    photoCap: 'An LDS wedding',
    defaultSoon: true,
  },
  {
    key: 'sda',
    faithCol: 'SDA',
    label: 'Adventist',
    desc: 'Seventh-day Adventist.',
    react: 'We’ll plan around the Sabbath and your church’s guidance.',
    photoImg: 'wed_christian',
    photoCap: 'An Adventist wedding',
    defaultSoon: true,
  },
  {
    key: 'jw',
    faithCol: 'JW',
    label: 'Jehovah’s Witnesses',
    desc: 'A Kingdom Hall ceremony.',
    react: 'We’ll keep your Kingdom Hall ceremony simple and faithful.',
    photoImg: 'wed_christian',
    photoCap: 'A Kingdom Hall wedding',
    defaultSoon: true,
  },
  {
    key: 'hindu',
    faithCol: 'Hindu',
    label: 'Hindu',
    desc: 'Mandap, mehndi & multi-day rites.',
    react: 'Shubh vivah! We’ll plan your mandap, mehndi and every rite.',
    photoImg: 'wed_cultural',
    photoCap: 'A Hindu wedding',
    defaultSoon: true,
  },
  {
    key: 'sikh',
    faithCol: 'Sikh',
    label: 'Sikh',
    desc: 'An Anand Karaj ceremony.',
    react: 'We’ll honor your Anand Karaj at the gurdwara.',
    photoImg: 'wed_cultural',
    photoCap: 'A Sikh wedding',
    defaultSoon: true,
  },
  {
    key: 'buddhist',
    faithCol: 'Buddhist',
    label: 'Buddhist',
    desc: 'A temple blessing ceremony.',
    react: 'We’ll arrange a serene temple blessing for you both.',
    photoImg: 'wed_cultural',
    photoCap: 'A Buddhist wedding',
    defaultSoon: true,
  },
  {
    key: 'orthodox',
    faithCol: 'Orthodox',
    label: 'Orthodox',
    desc: 'The Orthodox crowning rite.',
    react: 'We’ll honor the crowning rite and your parish traditions.',
    photoImg: 'wed_catholic',
    photoCap: 'An Orthodox wedding',
    defaultSoon: true,
  },
] as const;

/** Ceremony keys in display order (mirrors FAITH_KEY_TUPLE; a test pins them). */
export const FAITH_KEYS: readonly FaithKey[] = FAITH_REGISTRY.map((e) => e.key);

/** key → entry lookup. */
export const FAITH_BY_KEY: ReadonlyMap<string, FaithRegistryEntry> = new Map(
  FAITH_REGISTRY.map((e) => [e.key, e]),
);

/** key → display label (recaps, readiness panels, admin rows). */
export const FAITH_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  FAITH_REGISTRY.map((e) => [e.key, e.label]),
);

/**
 * The ceremony values a wedding commit may carry: every registry faith plus
 * the two non-faith ceremony forms. Both commit actions validate against this
 * (the picker already only EMITS launch-status-active keys; this is the
 * server-side belt to that suspender).
 */
export const ALLOWED_CEREMONY_VALUES: readonly string[] = [
  ...FAITH_REGISTRY.map((e) => e.key),
  'civil',
  'mixed',
];
