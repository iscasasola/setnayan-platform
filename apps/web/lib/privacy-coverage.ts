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
    note: 'Location data on captures — ROPA activity.',
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
    declaredIn: [],
    note: 'NEW (2026-07-21) — not yet in the filing. Add a ROPA activity for coordinator access to guest PII + money authority.',
  },
  coordinator_prep_release: {
    privacySensitive: true,
    declaredIn: [],
    note: 'NEW (2026-07-21) — not yet in the filing. Add a ROPA line for a coordinator’s staged access to planning data.',
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
    declaredIn: [],
    note: 'Automated processing of couple chat + Event Brief on the vendor’s behalf. NOT yet declared — needs a /privacy Vendor-AI section + a ROPA entry + DPO sign-off. Held fail-closed by the data-privacy control until then.',
  },
  vendor_deep_search: {
    privacySensitive: true,
    declaredIn: [],
    note: 'AI web-research (Anthropic web_search subprocessor) + dossier storage. NOT yet declared — needs a /privacy Deep-Search section, a retention limit (180-day TTL), + a ROPA entry + DPO review. Held fail-closed by the data-privacy control until then.',
  },
};

export type FilingActivityGap = { docKey: string; activity: string; note: string };

/** Processing activities the NPC filing declares (via a DPIA/review) that have
 *  NO live control on the board — the reverse drift. */
export const FILING_ACTIVITIES_WITHOUT_CONTROL: readonly FilingActivityGap[] = [
  {
    docKey: 'dpia-antifraud',
    activity: 'Anti-fraud, trust & integrity signals',
    note: 'A DPIA is filed for this, but no live control gates it on the board.',
  },
  {
    docKey: 'device-fingerprint-review',
    activity: 'Device-fingerprint data use',
    note: 'A DPO review is filed, but no live control gates it on the board.',
  },
];

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

/** Derive the coverage report from the set of currently-active control keys. */
export function computePrivacyCoverage(
  activeKeys: ReadonlySet<string>,
): PrivacyCoverageReport {
  const sensitive = (Object.keys(CONTROL_COVERAGE) as PrivacyControlKey[]).filter(
    (k) => CONTROL_COVERAGE[k].privacySensitive,
  );
  const undeclared = sensitive.filter((k) => CONTROL_COVERAGE[k].declaredIn.length === 0);
  return {
    privacySensitiveTotal: sensitive.length,
    declaredCount: sensitive.length - undeclared.length,
    undeclared,
    undeclaredActive: undeclared.filter((k) => activeKeys.has(k)),
  };
}
