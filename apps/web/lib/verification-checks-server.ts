import 'server-only';

/**
 * verification-checks-server.ts — gather the facts, then let the pure rules decide.
 *
 * ── THE ONE RULE THIS FILE EXISTS TO KEEP ───────────────────────────────────
 * **A read that fails degrades ITS OWN check to `manual` and nothing else.**
 * Storage being down must not turn the registration-number check into a
 * mismatch; an unreadable checklist must not report "no documents filed", which
 * is what an unreadable checklist looks like from the outside and is the exact
 * shape of the RLS-denial-reads-as-empty trap this codebase keeps paying for.
 *
 * So every probe below is wrapped, and every failure becomes a FLAG in
 * `CheckFacts` — `docUploadsUnreadable`, `storageUnreachable`, a `null` count,
 * an `existsInStorage: null` — that the pure engine already knows how to turn
 * into a manual mark with a reason. No probe here throws upward.
 *
 * ── THE STORAGE PROBE IS THE EXPENSIVE ONE ──────────────────────────────────
 * One HEAD per filed document, capped and run in parallel. A shop files at most
 * a handful of documents, so this is a small fan-out — but the cap is there
 * because `doc_uploads` is JSONB a vendor writes into, and an unbounded loop
 * over caller-supplied data is how a queue page becomes a timeout.
 */

import { R2_BUCKETS, r2HeadOutcome } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseVerificationKey } from '@/lib/verification-docs';
import { normalizeRegistrationNumber } from '@/lib/vendor-registration-number';
import {
  isFilledReference,
  isSlotComplete,
  parseClientReferences,
  parsePortfolioRefs,
  DOC_SLOTS,
  type DocUpload,
  type DocUploadMap,
} from '@/lib/vendor-verification';
import {
  runVerificationChecks,
  summariseChecks,
  type CheckFacts,
  type CheckResult,
  type CheckSummary,
  type FiledDocument,
  type RegistryAnswer,
} from '@/lib/verification-checks';

/** Never probe more than this many document keys for one application. */
const MAX_PROBED_DOCUMENTS = 24;

/**
 * Every R2 key a slot value carries, in whatever shape it was written.
 *
 * 🔑 A slot is FOUR shapes: `{ r2_key }`, an ARRAY of `{ r2_key }` (portfolio),
 * a structured entry list with no key at all (references), and a platform→link
 * map (social). Reading only the first shape is how a check reports "one
 * document filed" for a shop that filed ten photographs.
 */
export function r2KeysInSlot(value: DocUpload): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim().length > 0) out.push(v.trim());
  };
  if (value == null) return out;
  if (Array.isArray(value)) {
    for (const item of value) push((item as { r2_key?: unknown })?.r2_key);
    return out;
  }
  if (typeof value === 'object') push((value as { r2_key?: unknown }).r2_key);
  return out;
}

/** The document slots whose contents are FILES (never the meeting, never links). */
const FILE_BEARING_SLOTS: ReadonlySet<string> = new Set(
  DOC_SLOTS.filter((s) => s.kind === 'upload').map((s) => s.key),
);

/**
 * Which slots this application has genuinely filled, by the SAME rule the
 * vendor's own progress bar uses. Deriving it here rather than re-implementing
 * "is there a key" is what stops the reviewer's screen and the shop's screen
 * disagreeing about whether a document is in.
 */
function completeSlotKeys(uploads: DocUploadMap): Set<string> {
  const set = new Set<string>();
  for (const slot of DOC_SLOTS) {
    if (isSlotComplete(slot.key, uploads?.[slot.key])) set.add(slot.key);
  }
  return set;
}

export type VerificationChecksReport = {
  results: CheckResult[];
  summary: CheckSummary;
  /** Every filed document, so the card can offer an Open button per file. */
  documents: FiledDocument[];
};

export type ChecksInput = {
  vendorProfileId: string;
  businessName: string | null;
  docUploads: unknown;
  contactEmail: string | null;
  contactPhone: string | null;
  hqAddress: string | null;
  contactEmailConfirmedAt: string | null;
  contactPhoneConfirmedAt: string | null;
  registrationNumberRaw: string | null;
  registrationNumberNeedsReview: boolean;
  inBusinessSinceYear: number | null;
  experienceVerifiedAt: string | null;
};

/**
 * Who ELSE holds this shop's registration number.
 *
 * The duplicate FLAG already exists on the row; what it never carried is the
 * answer to *"duplicates whose?"* — and a reviewer told only "duplicate" has to
 * go and find that out, which is the whole thing this desk is meant to stop.
 *
 * ⚠ Read failure returns an EMPTY list, and the pure rule renders that as
 * "another shop (name not readable)" rather than as "nobody" — the flag is what
 * says a duplicate exists, never this lookup.
 */
async function otherShopsHoldingNumber(
  vendorProfileId: string,
  raw: string | null,
): Promise<string[]> {
  const normalized = normalizeRegistrationNumber(raw);
  if (!normalized) return [];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .eq('registration_number_normalized', normalized)
      .neq('vendor_profile_id', vendorProfileId)
      .limit(5);
    if (error || !data) return [];
    return (data as Array<{ business_name?: string | null; vendor_profile_id: string }>).map(
      (r) => r.business_name?.trim() || r.vendor_profile_id,
    );
  } catch {
    return [];
  }
}

/**
 * Ask the business registry whether this number is real.
 *
 * ⛔ NOTHING IS WIRED, ON PURPOSE, AND THAT IS REPORTED RATHER THAN HIDDEN.
 * The PH registries (DTI's BNRS, SEC) have no contracted API here — and the DTI
 * lookup answered **504 twice on 2026-09-09**, so *unreachable is a normal
 * condition* rather than an incident. The seam exists so that when a lookup is
 * commissioned it drops in here and the registration check starts passing by
 * itself; until then this returns `not_attempted` and the check says so in the
 * reviewer's own words instead of quietly implying the number was verified.
 *
 * 🔑 Both `unreachable` and `not_attempted` land on `manual`, never `pass` —
 * a registry that did not answer has no opinion about this shop.
 */
async function lookUpRegistry(_raw: string | null): Promise<RegistryAnswer> {
  return {
    kind: 'not_attempted',
    note: 'No business-registry lookup is connected yet.',
  };
}

/** HEAD every filed key, in parallel, telling "gone" from "did not answer". */
async function probeDocuments(
  uploads: DocUploadMap,
): Promise<{ documents: FiledDocument[]; unreachable: boolean; note: string | null }> {
  const pending: Array<{ slotKey: string; r2Key: string }> = [];
  for (const slot of DOC_SLOTS) {
    if (!FILE_BEARING_SLOTS.has(slot.key)) continue;
    for (const key of r2KeysInSlot(uploads?.[slot.key])) {
      pending.push({ slotKey: slot.key, r2Key: key });
      if (pending.length >= MAX_PROBED_DOCUMENTS) break;
    }
    if (pending.length >= MAX_PROBED_DOCUMENTS) break;
  }
  if (pending.length === 0) return { documents: [], unreachable: false, note: null };

  const probed = await Promise.all(
    pending.map(async ({ slotKey, r2Key }): Promise<FiledDocument & { note: string | null }> => {
      const { vendorProfileId } = parseVerificationKey(r2Key);
      let existsInStorage: boolean | null = null;
      let note: string | null = null;
      try {
        const outcome = await r2HeadOutcome({ bucket: R2_BUCKETS.vendorVerification, key: r2Key });
        if (outcome.kind === 'present') existsInStorage = true;
        else if (outcome.kind === 'absent') existsInStorage = false;
        else note = outcome.note;
      } catch (err) {
        note = err instanceof Error ? err.message : 'the storage probe threw';
      }
      return { slotKey, r2Key, existsInStorage, keyOwnerVendorId: vendorProfileId, note };
    }),
  );

  // "Unreachable" means we learned NOTHING about ANY file. One unanswered key
  // out of five is a per-document unknown, not an outage — and reporting it as
  // an outage would hide the four we did learn about.
  const answered = probed.filter((d) => d.existsInStorage !== null).length;
  const unreachable = answered === 0;
  const note = probed.find((d) => d.note)?.note ?? null;
  return {
    documents: probed.map(({ note: _n, ...rest }) => rest),
    unreachable,
    note,
  };
}

/**
 * Run the desk's checks for one application.
 *
 * ⚠ NEVER THROWS. This is called from a server component that renders the whole
 * verification queue; a throw here would take the queue down over one shop's
 * malformed JSONB. On a total failure it returns an empty report, and the card
 * says "no automatic checks ran" — which the grant warning then repeats.
 */
export async function buildVerificationChecks(
  input: ChecksInput,
): Promise<VerificationChecksReport> {
  let uploads: DocUploadMap = {};
  let docUploadsUnreadable = false;
  if (input.docUploads == null) {
    // A never-started application has no map. That is not "unreadable" — it is
    // an empty checklist, and the required-documents check should say so.
    uploads = {};
  } else if (typeof input.docUploads === 'object' && !Array.isArray(input.docUploads)) {
    uploads = input.docUploads as DocUploadMap;
  } else {
    docUploadsUnreadable = true;
  }

  let complete = new Set<string>();
  let portfolioCount: number | null = null;
  let clientReferenceCount: number | null = null;
  let meetScheduledAt: string | null = null;
  let documents: FiledDocument[] = [];
  let storageUnreachable = false;
  let storageNote: string | null = null;

  if (!docUploadsUnreadable) {
    try {
      complete = completeSlotKeys(uploads);
    } catch {
      docUploadsUnreadable = true;
    }
  }

  if (!docUploadsUnreadable) {
    try {
      portfolioCount = parsePortfolioRefs(uploads?.['portfolio_samples']).length;
    } catch {
      portfolioCount = null;
    }
    try {
      clientReferenceCount = parseClientReferences(uploads?.['client_references']).filter(
        isFilledReference,
      ).length;
    } catch {
      clientReferenceCount = null;
    }
    try {
      const meet = uploads?.['google_meet'] as { scheduled_at?: unknown } | undefined;
      meetScheduledAt =
        typeof meet?.scheduled_at === 'string' && meet.scheduled_at.trim()
          ? meet.scheduled_at
          : null;
    } catch {
      meetScheduledAt = null;
    }
    try {
      const probe = await probeDocuments(uploads);
      documents = probe.documents;
      storageUnreachable = probe.unreachable;
      storageNote = probe.note;
    } catch (err) {
      documents = [];
      storageUnreachable = true;
      storageNote = err instanceof Error ? err.message : 'the storage probe threw';
    }
  }

  const [heldAlsoBy, registryAnswer] = await Promise.all([
    input.registrationNumberNeedsReview
      ? otherShopsHoldingNumber(input.vendorProfileId, input.registrationNumberRaw)
      : Promise.resolve<string[]>([]),
    lookUpRegistry(input.registrationNumberRaw),
  ]);

  const facts: CheckFacts = {
    vendorProfileId: input.vendorProfileId,
    businessName: input.businessName,
    filedDocuments: documents,
    completeSlotKeys: complete,
    docUploadsUnreadable,
    storageUnreachable,
    storageNote,
    portfolioCount,
    clientReferenceCount,
    meetScheduledAt,
    registrationNumberRaw: input.registrationNumberRaw,
    registrationNumberDuplicate: input.registrationNumberNeedsReview,
    registrationNumberHeldAlsoBy: heldAlsoBy,
    registryAnswer,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    hqAddress: input.hqAddress,
    contactEmailConfirmedAt: input.contactEmailConfirmedAt,
    contactPhoneConfirmedAt: input.contactPhoneConfirmedAt,
    inBusinessSinceYear: input.inBusinessSinceYear,
    experienceVerifiedAt: input.experienceVerifiedAt,
  };

  const results = runVerificationChecks(facts);
  return { results, summary: summariseChecks(results), documents };
}
