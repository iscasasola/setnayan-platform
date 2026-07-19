/**
 * NPC submission document manifest.
 *
 * The DPO-prepared NPC (National Privacy Commission) filing set, rendered to PDF
 * and bundled under `apps/web/assets/npc-docs/` (traced into the route bundle via
 * `outputFileTracingIncludes` in next.config.ts). Served admin-only through
 * /admin/data-privacy/documents/[doc] — these are internal compliance documents
 * and must never be public.
 *
 * The `key` is the URL-safe download id; `file` is the exact bundled filename.
 * Keep this in sync with the corpus generator (NPC_Submission_PDF_2026-07-16/).
 */

export type NpcDocGroup = 'packet' | 'executive' | 'pack' | 'companion' | 'audit';

export type NpcDocument = {
  key: string;
  file: string;
  title: string;
  group: NpcDocGroup;
};

/** Ordered manifest — rendered as the download list. */
export const NPC_DOCUMENTS: readonly NpcDocument[] = [
  {
    key: 'complete-packet',
    file: 'Setnayan_NPC_Submission_Complete_2026-07-16.pdf',
    title: 'Complete submission packet (all documents, merged)',
    group: 'packet',
  },
  { key: 'executive-dossier', file: '00_Executive_Dossier.pdf', title: 'Privacy Compliance Dossier (executive submission)', group: 'executive' },
  { key: 'readme-pack', file: '01_README_Compliance_Pack.pdf', title: 'NPC Compliance Pack — README', group: 'pack' },
  { key: 'privacy-manual', file: '02_Privacy_Manual.pdf', title: 'Privacy Manual', group: 'pack' },
  { key: 'ropa', file: '03_Records_of_Processing_Activities.pdf', title: 'Records of Processing Activities (ROPA)', group: 'pack' },
  { key: 'dpo-designation', file: '04_DPO_Designation_and_NPC_Registration_Sheet.pdf', title: 'DPO Designation & NPC Registration Sheet', group: 'pack' },
  { key: 'breach-policy', file: '05_Data_Breach_Management_Policy.pdf', title: 'Data Breach Management Policy', group: 'pack' },
  { key: 'dpia-register', file: '06_DPIA_Register.pdf', title: 'DPIA Register', group: 'pack' },
  { key: 'dpia-face-vectors', file: '07_DPIA_Face_Vectors.pdf', title: 'DPIA — Face Vectors', group: 'pack' },
  { key: 'compliance-facts', file: '08_Compliance_Facts_Register.pdf', title: 'Compliance Facts Register', group: 'pack' },
  { key: 'dpia-antifraud', file: '09_DPIA_AntiFraud_Trust_Integrity.pdf', title: 'DPIA — Anti-Fraud, Trust & Integrity', group: 'pack' },
  { key: 'retention-schedule', file: '10_Data_Retention_Schedule.pdf', title: 'Data Retention Schedule', group: 'companion' },
  { key: 'privacy-reconciliation', file: '11_Privacy_Reconciliation.pdf', title: 'Privacy Reconciliation — Home & Data Flows', group: 'companion' },
  { key: 'device-fingerprint-review', file: '12_Device_Fingerprint_DPO_Review.pdf', title: 'Device-Fingerprint Data Use — DPO Review', group: 'companion' },
  { key: 'completeness-audit', file: '13_Completeness_Audit_INTERNAL.pdf', title: 'Completeness Audit — pre-filing checklist (INTERNAL, not a submission doc)', group: 'audit' },
];

const BY_KEY: Record<string, NpcDocument> = Object.fromEntries(
  NPC_DOCUMENTS.map((d) => [d.key, d]),
);

export function getNpcDocument(key: string): NpcDocument | null {
  return BY_KEY[key] ?? null;
}

export const NPC_DOC_GROUP_LABEL: Record<NpcDocGroup, string> = {
  packet: 'Full packet',
  executive: 'Executive submission',
  pack: 'NPC compliance pack',
  companion: 'Companion documents',
  audit: 'Completeness audit',
};
