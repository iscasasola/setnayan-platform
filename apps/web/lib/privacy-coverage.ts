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
