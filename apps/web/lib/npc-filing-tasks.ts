/**
 * NPC pre-filing readiness — the code catalog + DB read.
 *
 * The completeness audit (NPC_Submission_Completeness_Audit_2026-07-16.md)
 * deduped to 15 Tier 0-3 tasks the owner + DPO work down before lodging with the
 * National Privacy Commission. This mirrors the Data Privacy board
 * (lib/data-privacy-controls.ts) — catalog in code, DB rows overlaid on top —
 * EXCEPT there is deliberately NO gate function: nothing reads task status to
 * flip a capability. This is a worklist, not a switch. Committing the catalog to
 * code is itself the durability fix the audit flags (W6).
 *
 * Anti-false-assurance lives in the action (app/admin/npc-readiness/actions.ts),
 * not here: counsel-gated tasks can't resolve without a written counsel
 * reference, and the FILE task (t3-13) is fenced behind the counsel-review task
 * (t0-1). The page header never renders a terminal "ready to file" state.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type NpcTaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked_on_counsel'
  | 'resolved'
  | 'not_applicable';

export type NpcTaskKind = 'counsel' | 'document' | 'reconciliation' | 'remediation';
export type NpcTaskSeverity = 'blocking' | 'weakening' | 'normal';

/** The task that gates the whole filing (external counsel review). */
export const COUNSEL_REVIEW_TASK = 't0-1';
/** The task that actually files the DPS — fenced behind COUNSEL_REVIEW_TASK. */
export const FILE_DPS_TASK = 't3-13';

export type NpcTaskDef = {
  key: string;
  title: string;
  detail: string;
  tier: 0 | 1 | 2 | 3;
  kind: NpcTaskKind;
  severity: NpcTaskSeverity;
  counselGated: boolean;
  sourceRefs: string[];
  /** Soft link to a data_privacy_controls.control_key (deep-link, no FK). */
  relatedControlKey?: string;
  sortOrder: number;
};

export const NPC_FILING_TASKS: readonly NpcTaskDef[] = [
  { key: 't0-1', tier: 0, kind: 'counsel', severity: 'blocking', counselGated: true, sortOrder: 10, sourceRefs: ['t0-1'],
    title: 'Route the full packet to external PH counsel',
    detail: 'The terminal gate. Send the whole set to external Philippine data-privacy counsel with specific asks: the §3(l)/minors cluster, the vendor AMLC/PEP + government-ID basis, the NPC registration threshold, and the automated-decision provisions. Resolved = written counsel review received (name + memo date in the note).' },
  { key: 't0-2', tier: 0, kind: 'reconciliation', severity: 'blocking', counselGated: false, sortOrder: 20, sourceRefs: ['t0-2', 'B4', 'W7'],
    title: 'Pick ONE authoritative filing backbone + fix the SPI under-declaration',
    detail: 'Use the NPC_Compliance pack as the backbone, demote the executive dossier to a summary, and make the dossier’s SPI declaration match the pack — restore vendor gov-ID + AMLC/PEP. Reconcile the two RoPAs (11-12-system pack vs 18-category dossier) to ONE authoritative version.' },
  { key: 't0-3', tier: 0, kind: 'reconciliation', severity: 'normal', counselGated: false, sortOrder: 30, sourceRefs: ['t0-3', 'W1', 'W2', 'W3', 'W6'],
    title: 'Reconcile single-source conflicts + commit the untracked canonical docs',
    detail: 'One DPO email (dpo@setnayan.com vs iscasasolaii@gmail.com), one DSR SLA (7 vs 15 days), one device-fingerprint live/off state. Commit the 3 untracked canonical docs (dossier, retention schedule, fingerprint one-pager) so the master isn’t the least durable file (W6).' },
  { key: 't1-4', tier: 1, kind: 'document', severity: 'blocking', counselGated: true, sortOrder: 40, sourceRefs: ['t1-4', 'm-6', 'm-8', 'B2'],
    title: 'Publish the Anti-Fraud disclosure + record its LIA + document an appeal path',
    detail: 'The anti-fraud identity-clustering + automated vendor suspension shipped to prod 2026-07-07 with no notice, no legitimate-interest assessment, no counsel review. Publish the disclosure, record the LIA, and document a formal §16(c)/§34 automated-decision contest/appeal procedure.' },
  { key: 't1-5', tier: 1, kind: 'document', severity: 'blocking', counselGated: true, sortOrder: 50, sourceRefs: ['t1-5', 'm-4', 'm-5', 'm-13', 'B3'], relatedControlKey: 'faith_religion_graph',
    title: 'Publish the faith / minors / e-gift / device-fingerprint disclosures + fix the biometric denial',
    detail: 'Add the faith/minors/e-gift/device-fingerprint disclosures to the public privacy notice with matching RoPA rows; FIX the biometric “we do not collect” denial; publish the Person-Graph + Anti-Fraud policy amendments; add the just-in-time consent templates.' },
  { key: 't1-6', tier: 1, kind: 'remediation', severity: 'blocking', counselGated: true, sortOrder: 60, sourceRefs: ['t1-6', 'm-5', 'B3'], relatedControlKey: 'home_activity_signals',
    title: 'Gate or consent-instrument the events.signature_details honoree SPI',
    detail: 'The honoree fields (child DOB/gender for christening, pregnancy due-date for gender-reveal) collect sensitive data with no flag, no consent, no timestamp. Gate behind a flag or add a per-field consent stamp before filing.' },
  { key: 't1-7', tier: 1, kind: 'remediation', severity: 'normal', counselGated: false, sortOrder: 70, sourceRefs: ['t1-7'], relatedControlKey: 'dependent_minor_profiles',
    title: 'Confirm the true prod flag state of the dependent + e-gift routes',
    detail: 'Confirm whether NEXT_PUBLIC_DEPENDENT_PEOPLE and PABUYA_PUBLIC_ROUTE_ENABLED are ON in production. If ON, add the live SPI + minors and financial-PI processing activities to the RoPA.' },
  { key: 't2-8', tier: 2, kind: 'document', severity: 'blocking', counselGated: false, sortOrder: 80, sourceRefs: ['t2-8', 'm-3', 'B5'],
    title: 'Execute DPAs / SCCs for every named sub-processor',
    detail: 'The single biggest evidentiary hole: every “DPA on file” is [confirm]. Obtain/execute DPAs or SCCs for Supabase, Vercel, Cloudflare, Resend, Sentry, PostHog, Anthropic, Persona, Google, TikTok, Suno; attach the executed references. Underpins the §21 cross-border-transfer basis.' },
  { key: 't2-9', tier: 2, kind: 'document', severity: 'normal', counselGated: true, sortOrder: 90, sourceRefs: ['t2-9', 'm-7'], relatedControlKey: 'dependent_minor_profiles',
    title: 'Write the outstanding DPIAs',
    detail: 'R-03 Vendor Verification (HIGH — gov-ID/liveness/AMLC/PEP, and processing is LIVE) and R-05 Minors & Legacy (HIGH — counsel-first, before any build). Decide whether R-04 Payments / R-06 Contract Intelligence / R-07 Chat are standalone or folded.' },
  { key: 't2-10', tier: 2, kind: 'document', severity: 'normal', counselGated: false, sortOrder: 100, sourceRefs: ['t2-10', 'm-6'],
    title: 'Record the Device-Fingerprint LIA + DPO sign-off before flipping the flag',
    detail: 'The device-fingerprint fraud processing relies on §12(f) legitimate interest and needs a documented LIA/balancing test. Record it and get the DPO sign-off before the flag flips on.' },
  { key: 't2-11', tier: 2, kind: 'document', severity: 'normal', counselGated: false, sortOrder: 110, sourceRefs: ['t2-11', 'm-9'],
    title: 'Adopt light NDA / privacy-training / device-hygiene notes',
    detail: 'Organizational-measure evidence for the 2-person team: personnel confidentiality undertakings, a privacy-training record, and a device/endpoint policy (all [TO CONFIRM] in the manual today).' },
  { key: 't3-12', tier: 3, kind: 'document', severity: 'blocking', counselGated: true, sortOrder: 120, sourceRefs: ['t3-12', 'm-1', 'm-12', 'B1'],
    title: 'Sign + date the governance instruments',
    detail: 'Sign and date the DPO Designation (with the DPO’s written acceptance), the Privacy Manual, the Breach Policy, and the three completed DPIAs; set effectivity dates. Nothing in the set is currently signed/adopted — the filing has no executed backbone.' },
  { key: 't3-13', tier: 3, kind: 'document', severity: 'normal', counselGated: false, sortOrder: 130, sourceRefs: ['t3-13', 'm-2', 'm-11'],
    title: 'File the DPS via NPCRS + capture the registration number',
    detail: 'Resolve the remaining [TO CONFIRM] NPCRS fields (business address, DPO title/phone, BIR TIN / Form 2303) and FILE the Data Processing System registration via NPCRS. Resolved = DPS filed and the acknowledgement/registration number captured in evidence. Cannot be resolved before t0-1 (counsel review).' },
  { key: 't3-14', tier: 3, kind: 'reconciliation', severity: 'normal', counselGated: false, sortOrder: 140, sourceRefs: ['t3-14', 'W4', 'W5'],
    title: 'Reconcile the binding policy retention + stand up enforcement',
    detail: 'Add the 10-year floor + the vendor-verification retention class to the binding Privacy & Security Policy §4, and stand up retention ENFORCEMENT (R2 lifecycle rules, the retention sweep, fix the chat-message-PII residue left by account hard-delete).' },
  { key: 't3-15', tier: 3, kind: 'document', severity: 'normal', counselGated: false, sortOrder: 150, sourceRefs: ['t3-15', 'm-10'],
    title: 'Initiate the operational breach-management records',
    detail: 'Templates exist; the operational records do not. Stand up the breach register (live), run the first table-top drill, and set the annual NPC breach-summary cadence.' },
];

const BY_KEY: Record<string, NpcTaskDef> = Object.fromEntries(
  NPC_FILING_TASKS.map((t) => [t.key, t]),
);

export function getNpcTask(key: string): NpcTaskDef | null {
  return BY_KEY[key] ?? null;
}

export type NpcTaskRow = NpcTaskDef & {
  status: NpcTaskStatus;
  note: string | null;
  evidence: string | null;
  resolvedAt: string | null;
  updatedAt: string | null;
};

export const NPC_TASK_STATUS_LABEL: Record<NpcTaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked_on_counsel: 'Blocked on counsel',
  resolved: 'Resolved',
  not_applicable: 'N/A',
};

export const NPC_TASK_KIND_LABEL: Record<NpcTaskKind, string> = {
  counsel: 'Counsel',
  document: 'Document',
  reconciliation: 'Reconciliation',
  remediation: 'Product fix',
};

export const NPC_TIER_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Tier 0 · Engage counsel & freeze the story',
  1: 'Tier 1 · Close the live-processing exposure',
  2: 'Tier 2 · Execute the missing artifacts',
  3: 'Tier 3 · Adopt & file',
};

/**
 * Read the tasks (admin surface). Merges DB rows over the code catalog by
 * task_key so a not-yet-seeded task still renders (as not_started). Defensive:
 * a pre-migration DB returns the full catalog, all not_started. Sorted by
 * sort_order.
 */
export async function fetchNpcFilingTasks(
  supabase: SupabaseClient,
): Promise<NpcTaskRow[]> {
  const byKey = new Map<string, Record<string, unknown>>();
  const { data } = await supabase
    .from('npc_filing_tasks')
    .select('task_key,status,note,evidence,resolved_at,updated_at');
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const k = r.task_key as string | undefined;
    if (k) byKey.set(k, r);
  }
  return NPC_FILING_TASKS.map((t) => {
    const row = byKey.get(t.key);
    return {
      ...t,
      status: (row?.status as NpcTaskStatus) ?? 'not_started',
      note: (row?.note as string | null) ?? null,
      evidence: (row?.evidence as string | null) ?? null,
      resolvedAt: (row?.resolved_at as string | null) ?? null,
      updatedAt: (row?.updated_at as string | null) ?? null,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Is the whole filing still gated? TRUE until the counsel-review task resolves. */
export function isFilingCounselGated(tasks: readonly NpcTaskRow[]): boolean {
  const t01 = tasks.find((t) => t.key === COUNSEL_REVIEW_TASK);
  return (t01?.status ?? 'not_started') !== 'resolved';
}
