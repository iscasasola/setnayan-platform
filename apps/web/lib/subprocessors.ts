/**
 * subprocessors.ts — the ONE list of outside companies that handle data for us.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * There were two lists and NOTHING compared them. The public `/privacy` page
 * named companies the internal compliance record did not, and the internal
 * record named companies that are not used at all. Neither list was wrong on
 * purpose; they simply drifted, because adding a processor to one is a different
 * commit from adding it to the other, and no test ever read both.
 *
 * Owner ruling 2026-08-06 (as DPO), after checking what actually runs:
 *   · ADD **Sentry** — genuinely wired (`@sentry/nextjs`) and receiving crash
 *     reports today. The clear-cut omission.
 *   · ADD **Google** and **TikTok**, with roles SCOPED to "only when the user
 *     connects their own account". Over-disclosure is the safer side for a DPO,
 *     and naming them stops this drifting again.
 *   · REMOVE **Persona / Veriff / Onfido** — verified NOT USED. Only webhook
 *     stubs exist, and `/privacy` already says they are "not currently active".
 *     A vendor's documents are read by an admin, by hand. Listing a company that
 *     handles your data when it does not is its own inaccuracy.
 *   · REMOVE **SendGrid** — not wired. It appeared once, in a sentence on an
 *     internal page describing a fallback nobody built.
 *   · CORRECT **Cloudflare's** role: it is media storage AND the relay that
 *     carries live call video in transit.
 *
 * ⚠ `dpa_on_file` is FALSE on every entry, and that is not an oversight in this
 * file — it is the live state. There is no signed data-processing agreement with
 * any of them. Chasing those is its own job; recording the truth is this one.
 */

export type Subprocessor = {
  /** EXACT string stored in the compliance record's JSONB — the join key. */
  name: string;
  role: string;
  jurisdiction: string;
  personal_data: boolean;
  dpa_on_file: boolean;
  /**
   * Named on the public page. FALSE only for in-house work, which is not a third
   * party and would mislead a reader if listed as one.
   */
  publicListed: boolean;
};

export const SUBPROCESSORS: readonly Subprocessor[] = [
  { name: 'Vercel', role: 'App hosting', jurisdiction: 'United States', personal_data: true, dpa_on_file: false, publicListed: true },
  { name: 'Supabase', role: 'Database + auth', jurisdiction: 'Singapore (ap-southeast-1)', personal_data: true, dpa_on_file: false, publicListed: true },
  {
    name: 'Cloudflare',
    // Corrected 2026-08-06: the record said "Media storage" only, while the
    // public page already disclosed the call relay. The relay is a transient
    // processor of call CONTENT even though we store none of it.
    role: 'Media storage (R2, APAC) + CDN + TURN relay carrying live call and camera video in transit (never stored)',
    jurisdiction: 'APAC',
    personal_data: true,
    dpa_on_file: false,
    publicListed: true,
  },
  { name: 'Resend', role: 'Transactional email', jurisdiction: 'United States', personal_data: true, dpa_on_file: false, publicListed: true },
  { name: 'Sentry', role: 'Server-side error monitoring — stack traces only', jurisdiction: 'United States', personal_data: true, dpa_on_file: false, publicListed: true },
  { name: 'PostHog', role: 'Product analytics — opt-out available', jurisdiction: 'US/EU cloud — confirm instance', personal_data: true, dpa_on_file: false, publicListed: true },
  { name: 'Anthropic', role: 'AI features, including vendor Deep Search — never trained on your data', jurisdiction: 'United States', personal_data: true, dpa_on_file: false, publicListed: true },
  { name: 'Suno', role: 'AI music generation — no guest or personal data is sent', jurisdiction: 'United States', personal_data: false, dpa_on_file: false, publicListed: true },
  {
    name: 'Google',
    role: 'ONLY when the user connects their own account — YouTube Data API for a broadcast, Drive API for photo delivery, plus the public STUN server contacted when starting a call',
    jurisdiction: 'United States',
    personal_data: true,
    dpa_on_file: false,
    publicListed: true,
  },
  {
    name: 'TikTok',
    role: 'ONLY when the user connects their own account — Personal-tier Patiktok posting',
    jurisdiction: 'Singapore / United States',
    personal_data: true,
    dpa_on_file: false,
    publicListed: true,
  },
  {
    name: 'Face matching (in-house)',
    role: 'On-device in the browser; vectors stored in Supabase Singapore. No third party.',
    jurisdiction: 'In-house',
    personal_data: true,
    dpa_on_file: false,
    // Deliberately absent from the public list: it is OUR OWN processing, and
    // naming it among third parties would tell a reader we send faces somewhere.
    publicListed: false,
  },
];

/** What the compliance record should hold — the internal shape, minus our flag. */
export function complianceRecordShape(): Omit<Subprocessor, 'publicListed'>[] {
  return SUBPROCESSORS.map(({ publicListed: _publicListed, ...rest }) => rest);
}

/** Companies that must be named on the public page. */
export const PUBLIC_SUBPROCESSOR_NAMES: readonly string[] = SUBPROCESSORS.filter(
  (s) => s.publicListed,
).map((s) => s.name);

/**
 * Names that must NOT appear as active processors anywhere — verified unused.
 * Kept as data so the check cannot quietly lose one.
 */
export const RETIRED_SUBPROCESSOR_NAMES: readonly string[] = [
  'Persona',
  'Veriff',
  'Onfido',
  'SendGrid',
];
