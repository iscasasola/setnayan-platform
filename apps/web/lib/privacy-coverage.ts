import type { PrivacyControlKey } from '@/lib/data-privacy-controls';

/**
 * Privacy coverage map — the bridge between the live Data Privacy control board
 * and the NPC filing (lib/npc-documents.ts). Answers "is every active control
 * declared to the regulator, and is every declared activity actually gated?"
 *
 * ⚠ HAND-AUTHORED map the DPO maintains: it encodes which NPC filing document(s)
 * declare each control, plus the two drift lists. The drift LOGIC (a control
 * with no declaration · an activity with no control) is derived deterministically
 * from it; the mapping itself is a judgment to keep current as the controls and
 * the filing evolve. `declaredIn` values are NpcDocument.key (lib/npc-documents).
 *
 * `Record<PrivacyControlKey, …>` is exhaustive on purpose: adding a new control
 * won't typecheck until its coverage is declared here — so coverage can't drift
 * silently behind the catalog.
 */

export type ControlCoverage = {
  /** A genuine privacy-sensitive activity (vs a plain activation switch)? */
  privacySensitive: boolean;
  /** NpcDocument.key[] that declare this activity. Empty = not in the filing. */
  declaredIn: string[];
  note?: string;
};

export const CONTROL_COVERAGE: Record<PrivacyControlKey, ControlCoverage> = {
  vendor_papic_capture: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Guest media collected by a third-party vendor — a ROPA processing activity.',
  },
  vendor_guest_delivery: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Vendor↔guest delivery link over the couple’s guest list — ROPA activity.',
  },
  face_enrollment: {
    privacySensitive: true,
    declaredIn: ['dpia-face-vectors', 'dpia-register', 'ropa'],
    note: 'Biometric (sensitive PI) — has a dedicated DPIA.',
  },
  papic_geo_metadata: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Papic capture geo-stamp (ROPA DPS-05) — the capture path is now built and fail-closed behind this control, which ships OFF. The public /privacy "Photos and videos — location data" section already discloses it; activate after the DPO ruling.',
  },
  cross_event_vendor_recall: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Cross-event linkage of a person’s data — verify the ROPA states a purpose + opt-out.',
  },
  faith_religion_graph: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Sensitive PI (religion) — verify a dedicated lawful basis is stated.',
  },
  dependent_minor_profiles: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Minors’ data is high-risk — a dedicated DPIA is expected, but the register lists none for minors.',
  },
  home_activity_signals: {
    privacySensitive: true,
    declaredIn: ['privacy-reconciliation', 'ropa'],
    note: 'Onboarding/Home SPI+PI signals — covered by the Privacy Reconciliation companion.',
  },
  coordinator_consent_money: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Declared: ROPA DPS-14 (Coordinator Delegated Access) + the public /privacy "Coordinators you invite" section. Money scopes are opt-in and keep the platform-wide "Setnayan never holds/moves money" stance; confirm the DPO ruling before activating.',
  },
  coordinator_prep_release: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Declared: ROPA DPS-14 (Coordinator Delegated Access) — the prep-then-release staged-schedule access + the public /privacy "Coordinators you invite" section.',
  },
  coordinator_run_of_show: {
    privacySensitive: false,
    declaredIn: [],
    note: 'Activation switch, not privacy-sensitive — no filing declaration needed.',
  },
  coordinator_day_of_broadcast: {
    privacySensitive: false,
    declaredIn: [],
    note: 'Activation switch, not privacy-sensitive — no filing declaration needed.',
  },
  coordinator_requests_inbox: {
    privacySensitive: false,
    declaredIn: [],
    note: 'Activation switch, not privacy-sensitive — no filing declaration needed. The day-of requests stream carries operational text between people already on the event (couple, hosts, booked suppliers, coordinator); it collects no new category of personal data, and a supplier reads only their own reports. Author-entered free text inherits the same do-not-paste-PII guidance as chat, and rows the author wrote are purged on erasure (lib/erasure/coverage.ts).',
  },
  vendor_ai_autoreply: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Declared: ROPA DPS-13 (Vendor AI Assistant) + the public /privacy "Vendor AI assistant (automated replies)" section (§34 automated-processing basis, "⚡ AI auto-reply" label). Held fail-closed by the control until DPO sign-off.',
  },
  vendor_deep_search: {
    privacySensitive: true,
    declaredIn: ['ropa'],
    note: 'Declared: ROPA DPS-13 (Vendor AI Assistant) + the public /privacy "Vendor Deep Search" section (Anthropic web_search subprocessor, 180-day dossier TTL, §12(f)). Held fail-closed by the control until DPO sign-off.',
  },
  antifraud_trust_signals: {
    privacySensitive: true,
    declaredIn: ['dpia-antifraud', 'ropa'],
    note: 'Automated vendor suspension — an RA 10173 automated decision with a filed DPIA (09_DPIA_AntiFraud). Before relying on it, confirm the published disclosure + legitimate-interest assessment + contest/appeal path land (NPC task t1-4).',
  },
  device_fingerprint: {
    privacySensitive: true,
    declaredIn: ['device-fingerprint-review', 'ropa'],
    note: 'Coarse per-browser device id for fraud. DPO review on file (12_Device_Fingerprint_DPO_Review); a documented LIA is still owed (NPC task t2-10). Held OFF (control inactive AND env flag) until DPO sign-off.',
  },
  guest_columns: {
    privacySensitive: true,
    declaredIn: [],
    note: 'NOT IN THE FILING YET (honest drift — declaredIn stays empty on purpose). Guest-authored columns publish guest text + a roster-name byline to the open web after couple approval. ✅ The /privacy disclosure LANDED 2026-07-30 ("Guest-written columns on an event page"). ⏳ Still owed: the ROPA activity is now DRAFTED as DPS-15 in NPC_Compliance/02_Records_of_Processing_Activities (2026-08-02) — `declaredIn` deliberately stays EMPTY until the bundled ROPA **PDF** is regenerated from that doc, because this field claims declaration in the filing artifact the app ships, not in a markdown draft. Regeneration + lodging remain JANUARY 2027 per the owner ("we will do everything on january 2027 but let this run truthfully until then"). ⚠ The control itself is ACTIVE in prod since 2026-07-27 — the old wording here claimed "held fail-closed (control inactive)", which was untrue; GUEST_COLUMNS_ENABLED is the only remaining gate, so verify that env flag before assuming this is dark.',
  },
  papic_pool_gallery: {
    privacySensitive: true,
    declaredIn: [],
    note: 'NOT IN THE FILING YET (honest drift — declaredIn stays empty on purpose). The shared pool exposes every guest’s clean-screened captures (web copies) to all session guests of that event, plus self-link tagging. ✅ The /privacy disclosure LANDED 2026-07-30 ("The shared pool: other guests at the same event can see your shots", under Photos and videos). ⏳ Still owed: the ROPA activity is now DRAFTED as DPS-16 (2026-08-02), and DPS-05 was amended the same day to name the two facts it had never stated — that the dominant capture source is the GUESTS’ OWN PHONES, and that delivery is by face match (DPO gates 0d). `declaredIn` stays EMPTY until the ROPA PDF is regenerated; lodging is JANUARY 2027 per the owner. ⚠ The control itself is ACTIVE in prod since 2026-07-27 — the old wording here claimed "held fail-closed (control inactive)", which was untrue; NEXT_PUBLIC_PAPIC_POOL_GALLERY and the couple’s per-event toggle are the remaining gates.',
  },
  same_date_demand: {
    privacySensitive: true,
    declaredIn: [],
    note: 'NOT DECLARED YET (on purpose — honest drift). The only CROSS-COUPLE disclosure on the marketplace: couple A is told how many OTHER couples inquired with the same vendor for the same exact date. Two mitigations are already in the resolver — inquiry-only (a mere save counts zero, per the 2026-06-02 manufactured-scarcity ruling) and a server-side min-3 floor (n=1 on a solo vendor for an exact date in a small municipality is functionally re-identifying) — but there is NO per-couple opt-out: a couple cannot exclude their own inquiry from other couples’ counts, and that is the gap a DPO ruling has to speak to. ✅ CORRECTION 2026-08-02: the "/privacy paragraph owed" claim was STALE — §"Vendor interest counts (what other couples can see)" already disclosed the aggregate, the inquiry-only rule, the min-3 floor, the exact-date rule and the no-scarcity commitment. The audit added the one thing it omitted: that there is NO opt-out, stated plainly. ⏳ ROPA activity now DRAFTED as DPS-17, which also records the missing opt-out as the question for the DPO; `declaredIn` stays EMPTY until the ROPA PDF is regenerated (JANUARY 2027). Held fail-closed (control seeded inactive AND the Explore-replan flag AND a min-3 floor that prod cannot currently reach — 0 chat_threads).',
  },
};

export type FilingActivityGap = { docKey: string; activity: string; note: string };

/** Processing activities the NPC filing declares (via a DPIA/review) that have
 *  NO live control on the board — the reverse drift. Both prior gaps (anti-fraud,
 *  device-fingerprint) now have controls on the board, so this list is empty; a
 *  new filed-but-ungated activity would reappear here. */
export const FILING_ACTIVITIES_WITHOUT_CONTROL: readonly FilingActivityGap[] = [];

export type CandidateFlow = { name: string; note: string };

/** App data flows that look privacy-relevant but are NOT on the board yet —
 *  candidates to add (or to consciously exclude as base-contract processing).
 *  A starting list from the corpus, NOT an exhaustive codebase audit. */
export const CANDIDATE_UNLISTED_FLOWS: readonly CandidateFlow[] = [
  {
    name: 'Guest RSVP consent + guest PII collection',
    note: 'Guests submit name/contact at RSVP. Confirm a control, or that it is base-contract processing declared in the ROPA.',
  },
  {
    name: 'Marketing-share consents (social sharing program)',
    note: '`marketing_share_consents` — the couple’s grant for Setnayan to feature their creation. Not represented on the board.',
  },
  {
    name: 'Payment proof uploads',
    note: 'Customers upload bank/GCash screenshots (may contain PII) at checkout. Not on the board.',
  },
  {
    name: 'Planning-style / taste personalization',
    note: 'Behavioral taste profile — corpus-flagged as counsel-gated; not built. Add a control when it ships.',
  },
];

export type PrivacyCoverageReport = {
  privacySensitiveTotal: number;
  declaredCount: number;
  /** Privacy-sensitive controls with no filing declaration. */
  undeclared: PrivacyControlKey[];
  /** …of those, the ones currently ACTIVE — the sharpest drift (live but undeclared). */
  undeclaredActive: PrivacyControlKey[];
};

/**
 * Derive the coverage report from the set of currently-active control keys.
 * `retiredKeys` are excluded from the privacy-sensitive denominator — a retired
 * control gates no live processing, so it shouldn't count against declaration
 * coverage (nor can it be "undeclared-active" — it isn't active).
 */
export function computePrivacyCoverage(
  activeKeys: ReadonlySet<string>,
  retiredKeys: ReadonlySet<string> = new Set(),
): PrivacyCoverageReport {
  const sensitive = (Object.keys(CONTROL_COVERAGE) as PrivacyControlKey[]).filter(
    (k) => CONTROL_COVERAGE[k].privacySensitive && !retiredKeys.has(k),
  );
  const undeclared = sensitive.filter((k) => CONTROL_COVERAGE[k].declaredIn.length === 0);
  return {
    privacySensitiveTotal: sensitive.length,
    declaredCount: sensitive.length - undeclared.length,
    undeclared,
    undeclaredActive: undeclared.filter((k) => activeKeys.has(k)),
  };
}
