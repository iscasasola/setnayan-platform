'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  DOCUMENT_META,
  DOCUMENTS_BY_CEREMONY_TYPE,
  completeByDate,
  expiresAtFor,
  resolveCeremonyType,
  type PaperworkDocumentType,
  type PaperworkStatus,
} from '@/lib/paperwork';

/**
 * Server actions for the paperwork pipeline.
 *
 * Each action gates on auth + RLS:
 *   - `getUser` redirects to /login if anonymous.
 *   - The underlying UPDATE / INSERT runs against the host's RLS session,
 *     so even a malicious form-data POST against another event ID is
 *     rejected by the event_paperwork_host_* policies in the migration.
 *
 * Each action revalidates BOTH the paperwork page (so the host sees the
 * new state without a hard refresh) AND the event-home page (so the
 * Ceremony plan card's paperwork sub-link picks up updated counts on
 * the next nav back).
 */

const DOCUMENT_TYPE_SET = new Set<PaperworkDocumentType>(
  Object.keys(DOCUMENT_META) as PaperworkDocumentType[],
);

function isDocumentType(v: unknown): v is PaperworkDocumentType {
  return typeof v === 'string' && DOCUMENT_TYPE_SET.has(v as PaperworkDocumentType);
}

const STATUSES_REQUIRING_TIMESTAMPS: ReadonlyArray<PaperworkStatus> = [
  'requested',
  'in_processing',
  'received',
  'expired',
];

function isPaperworkStatus(v: unknown): v is PaperworkStatus {
  return (
    typeof v === 'string' &&
    (v === 'not_started' ||
      STATUSES_REQUIRING_TIMESTAMPS.includes(v as PaperworkStatus))
  );
}

function revalidateBoth(eventId: string): void {
  revalidatePath(`/dashboard/${eventId}/paperwork`);
  revalidatePath(`/dashboard/${eventId}`);
}

// ----------------------------------------------------------------------
// 1. Seed paperwork rows for a ceremony type
// ----------------------------------------------------------------------

/**
 * Seeds the canonical document_type rows for an event's ceremony_type.
 * Idempotent — uses INSERT ... ON CONFLICT DO NOTHING via the UNIQUE
 * (event_id, document_type) constraint so re-runs just no-op.
 *
 * Called from the page on first visit when the host has zero rows. Also
 * safe to call when the host changes ceremony_type — the seed adds the
 * new ceremony's required docs without disturbing any rows the host
 * already has progress on.
 *
 * Form contract: event_id (uuid), ceremony_type (optional override —
 * defaults to events.ceremony_type when not supplied).
 */
export async function seedPaperworkForEvent(formData: FormData): Promise<void> {
  const eventIdRaw = formData.get('event_id');
  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    throw new Error('Missing event reference.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read the event's current ceremony_type + event_date so we can compute
  // the per-document expected_completion_date at seed time. The page
  // reads ceremony_type fresh on every visit so it can re-seed if the
  // host changes their ceremony later.
  const { data: eventRow } = await supabase
    .from('events')
    .select('event_id, ceremony_type, event_date')
    .eq('event_id', eventIdRaw)
    .maybeSingle();

  const ceremony = resolveCeremonyType(
    (eventRow as { ceremony_type?: string | null } | null)?.ceremony_type ?? null,
  );
  const eventDate =
    (eventRow as { event_date?: string | null } | null)?.event_date ?? null;

  const docs = DOCUMENTS_BY_CEREMONY_TYPE[ceremony];
  if (docs.length === 0) {
    revalidateBoth(eventIdRaw);
    return;
  }

  // Compose row payloads. INSERT ... ON CONFLICT DO NOTHING handles
  // re-seeds cleanly: existing rows keep their state, missing rows
  // appear with the seed defaults.
  const rows = docs.map((document_type) => ({
    event_id: eventIdRaw,
    document_type,
    status: 'not_started' as const,
    expected_completion_date: completeByDate(document_type, eventDate),
  }));

  const { error } = await supabase
    .from('event_paperwork')
    .upsert(rows, { onConflict: 'event_id,document_type', ignoreDuplicates: true });
  if (error) {
    // Surface to the caller so the page can render a friendly retry —
    // never expose raw Postgres errors to the host per
    // [[feedback_setnayan_no_dev_text_post_launch]].
    console.error('[paperwork] seedPaperworkForEvent:', error.message);
    throw new Error(
      'Could not set up your paperwork checklist. Please refresh and try again.',
    );
  }

  revalidateBoth(eventIdRaw);
}

// ----------------------------------------------------------------------
// 2. Mark a single document as requested
// ----------------------------------------------------------------------

/**
 * Flips a paperwork row to status='requested' and stamps requested_at.
 * Form contract: event_id, paperwork_id, tracking_reference (optional).
 */
export async function markPaperworkRequested(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const paperworkId = formData.get('paperwork_id');
  const trackingRaw = formData.get('tracking_reference');
  if (typeof eventId !== 'string' || typeof paperworkId !== 'string') {
    throw new Error('Invalid input.');
  }
  const trackingReference =
    typeof trackingRaw === 'string' && trackingRaw.trim().length > 0
      ? trackingRaw.trim().slice(0, 120)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_paperwork')
    .update({
      status: 'requested',
      requested_at: new Date().toISOString(),
      tracking_reference: trackingReference,
    })
    .eq('id', paperworkId)
    .eq('event_id', eventId);
  if (error) {
    console.error('[paperwork] markPaperworkRequested:', error.message);
    throw new Error('Could not update this document. Please refresh and try again.');
  }
  revalidateBoth(eventId);
}

// ----------------------------------------------------------------------
// 3. Mark a single document as received
// ----------------------------------------------------------------------

/**
 * Flips a paperwork row to status='received' and stamps received_at.
 * If the document is the marriage_license, also computes expires_at =
 * received_at + 120 days so the UI can warn the host 30 days before
 * lapse.
 *
 * Form contract: event_id, paperwork_id, document_type.
 */
export async function markPaperworkReceived(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const paperworkId = formData.get('paperwork_id');
  const documentTypeRaw = formData.get('document_type');
  if (typeof eventId !== 'string' || typeof paperworkId !== 'string') {
    throw new Error('Invalid input.');
  }
  if (!isDocumentType(documentTypeRaw)) {
    throw new Error('Unknown document type.');
  }

  const now = new Date();
  const expiresAt = expiresAtFor(documentTypeRaw, now);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_paperwork')
    .update({
      status: 'received',
      received_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .eq('id', paperworkId)
    .eq('event_id', eventId);
  if (error) {
    console.error('[paperwork] markPaperworkReceived:', error.message);
    throw new Error('Could not update this document. Please refresh and try again.');
  }
  revalidateBoth(eventId);
}

// ----------------------------------------------------------------------
// 4. Generic status setter (handles 'in_processing', 'not_started', 'expired')
// ----------------------------------------------------------------------

/**
 * Generic status setter for the cases that don't have a dedicated
 * markX action — e.g., bumping back to 'not_started' to undo a mis-click,
 * or flipping 'in_processing' once PSA confirms receipt of the order.
 *
 * Form contract: event_id, paperwork_id, status.
 */
export async function setPaperworkStatus(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const paperworkId = formData.get('paperwork_id');
  const statusRaw = formData.get('status');
  if (typeof eventId !== 'string' || typeof paperworkId !== 'string') {
    throw new Error('Invalid input.');
  }
  if (!isPaperworkStatus(statusRaw)) {
    throw new Error('Unknown paperwork status.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Build the patch — only stamp timestamps that match the new status.
  const patch: Record<string, unknown> = { status: statusRaw };
  if (statusRaw === 'not_started') {
    patch['requested_at'] = null;
    patch['received_at'] = null;
    patch['expires_at'] = null;
    patch['tracking_reference'] = null;
  } else if (statusRaw === 'requested') {
    patch['requested_at'] = new Date().toISOString();
  } else if (statusRaw === 'in_processing') {
    // Stamp requested_at if it's not already stamped — host may have
    // skipped 'requested' and gone straight to 'in_processing'.
    patch['requested_at'] = new Date().toISOString();
  } else if (statusRaw === 'expired') {
    patch['expires_at'] = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from('event_paperwork')
    .update(patch)
    .eq('id', paperworkId)
    .eq('event_id', eventId);
  if (error) {
    console.error('[paperwork] setPaperworkStatus:', error.message);
    throw new Error('Could not update this document. Please refresh and try again.');
  }
  revalidateBoth(eventId);
}

// ----------------------------------------------------------------------
// 5. Save uploaded scan
// ----------------------------------------------------------------------

/**
 * Persists the r2:// reference returned by the FileUpload widget onto
 * the paperwork row. The FileUpload widget handles the presigned-URL
 * dance against /api/upload; this action just writes the resulting
 * reference into the document_r2_key column.
 *
 * When a scan is uploaded for a document that was still in
 * 'not_started' / 'requested' / 'in_processing', we auto-flip status
 * to 'received' and stamp received_at since "having the scan" is
 * effectively "having the document". For the marriage license, that
 * also triggers expires_at = received_at + 120 days.
 *
 * Form contract: event_id, paperwork_id, document_type, document_r2_key.
 */
export async function uploadPaperworkScan(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const paperworkId = formData.get('paperwork_id');
  const documentTypeRaw = formData.get('document_type');
  const r2KeyRaw = formData.get('document_r2_key');
  if (typeof eventId !== 'string' || typeof paperworkId !== 'string') {
    throw new Error('Invalid input.');
  }
  if (!isDocumentType(documentTypeRaw)) {
    throw new Error('Unknown document type.');
  }
  if (typeof r2KeyRaw !== 'string' || r2KeyRaw.trim().length === 0) {
    throw new Error('No file was attached. Please pick a file and try again.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Read current status so we know whether to auto-flip to 'received'.
  const { data: current } = await supabase
    .from('event_paperwork')
    .select('status')
    .eq('id', paperworkId)
    .eq('event_id', eventId)
    .maybeSingle();

  const currentStatus = (current as { status?: PaperworkStatus } | null)?.status
    ?? 'not_started';

  const patch: Record<string, unknown> = {
    document_r2_key: r2KeyRaw.trim(),
  };

  // Auto-flip to received if the host hasn't already marked it received.
  // The host can always toggle back to a lesser state via setPaperworkStatus
  // if the upload was a placeholder.
  if (currentStatus !== 'received' && currentStatus !== 'expired') {
    const now = new Date();
    patch['status'] = 'received';
    patch['received_at'] = now.toISOString();
    patch['expires_at'] = expiresAtFor(documentTypeRaw, now);
  }

  const { error } = await supabase
    .from('event_paperwork')
    .update(patch)
    .eq('id', paperworkId)
    .eq('event_id', eventId);
  if (error) {
    console.error('[paperwork] uploadPaperworkScan:', error.message);
    throw new Error(
      'Could not save your scan. Please try uploading again, or reach out from /help if it keeps failing.',
    );
  }
  revalidateBoth(eventId);
}

// ----------------------------------------------------------------------
// 6. Save notes (free-text)
// ----------------------------------------------------------------------

/**
 * Updates the notes column on a paperwork row. Useful for hosts who want
 * to log details like "got rejection — go back with NSO copy" or
 * "scheduled for March 2 9am with Fr. Reyes".
 *
 * Form contract: event_id, paperwork_id, notes (empty string clears).
 */
export async function setPaperworkNotes(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const paperworkId = formData.get('paperwork_id');
  const notesRaw = formData.get('notes');
  if (typeof eventId !== 'string' || typeof paperworkId !== 'string') {
    throw new Error('Invalid input.');
  }
  const notes =
    typeof notesRaw === 'string' && notesRaw.trim().length > 0
      ? notesRaw.trim().slice(0, 2000)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_paperwork')
    .update({ notes })
    .eq('id', paperworkId)
    .eq('event_id', eventId);
  if (error) {
    console.error('[paperwork] setPaperworkNotes:', error.message);
    throw new Error('Could not save your notes. Please refresh and try again.');
  }
  revalidateBoth(eventId);
}
