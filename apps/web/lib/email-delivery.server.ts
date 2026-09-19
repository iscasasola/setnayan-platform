import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveResendConfig } from '@/lib/integration-config';
import { runClaimedJob } from '@/lib/periodic-jobs';
import {
  isDueForCheck,
  maskRecipient,
  summarize,
  SUMMARY_WINDOW_MS,
  STOP_ASKING_AFTER_MS,
  type DeliveryOutcome,
  type DeliveryRow,
  type DeliverySummary,
} from '@/lib/email-delivery-log';

/**
 * EVERY EMAIL SAYS WHETHER IT ARRIVED — the server half.
 *
 * Writer: `recordDelivery`, called by `sendEmail` (lib/email.ts) on every
 * attempt — the single choke point, so no caller can forget.
 * Checker: `maybeRunEmailDeliveryCheck`, a cron-free job riding admin traffic
 * (registry key `email-delivery-check`), which asks Resend for each accepted
 * message's `last_event` and writes it back.
 * Readers: the admin home strip and the Notifications tab.
 *
 * Every function here fails SOFT for the send (a log write must never stop an
 * email) and LOUD for the reader (a log that could not be read says so; it is
 * never shown as an empty, healthy week).
 */

const COLUMNS =
  'delivery_id, created_at, kind, recipient_masked, subject, outcome, provider_message_id, error, scheduled_for, last_event, last_event_checked_at';

export async function recordDelivery(input: {
  to: string;
  subject: string;
  kind?: string;
  outcome: DeliveryOutcome;
  providerMessageId?: string | null;
  error?: string | null;
  scheduledFor?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('email_deliveries').insert({
      kind: (input.kind ?? 'other').slice(0, 80),
      recipient_masked: maskRecipient(input.to),
      subject: input.subject.slice(0, 200),
      outcome: input.outcome,
      provider_message_id: input.providerMessageId ?? null,
      error: input.error ? input.error.slice(0, 500) : null,
      scheduled_for: input.scheduledFor ?? null,
    });
    if (error) console.error('[email-delivery] record failed:', error.message);
  } catch (e) {
    console.error('[email-delivery] record threw:', e);
  }
}

// ── The checker ─────────────────────────────────────────────────────────────

const CHECK_GAP_MS = 10 * 60 * 1000;
/** Per run. Resend allows ~2 requests/second; spaced below that. */
const CHECK_BATCH = 20;
const CHECK_SPACING_MS = 600;

/** Asks Resend about unsettled accepted messages. Returns how many rows it updated. */
export async function runEmailDeliveryCheck(now: number = Date.now()): Promise<number> {
  const { apiKey } = await resolveResendConfig();
  if (!apiKey) return 0;

  const admin = createAdminClient();
  const since = new Date(now - STOP_ASKING_AFTER_MS).toISOString();
  const { data, error } = await admin
    .from('email_deliveries')
    .select(COLUMNS)
    .eq('outcome', 'accepted')
    .not('provider_message_id', 'is', null)
    .gte('created_at', since)
    .order('last_event_checked_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(CHECK_BATCH * 3);
  if (error) throw new Error(`email_deliveries read failed: ${error.message}`);

  const due = ((data ?? []) as DeliveryRow[]).filter((r) => isDueForCheck(r, now)).slice(0, CHECK_BATCH);
  if (due.length === 0) return 0;

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  let updated = 0;
  for (const [i, row] of due.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, CHECK_SPACING_MS));
    let patch: Record<string, string | null>;
    try {
      const { data: email, error: getError } = await resend.emails.get(row.provider_message_id!);
      patch = getError
        ? { error: `status check: ${getError.message}`.slice(0, 500) }
        : { last_event: email?.last_event ?? null };
    } catch (e) {
      patch = { error: `status check threw: ${String(e)}`.slice(0, 500) };
    }
    patch.last_event_checked_at = new Date().toISOString();
    // A zero-row update is success-shaped — count the rows actually written.
    const { data: written, error: upErr } = await admin
      .from('email_deliveries')
      .update(patch)
      .eq('delivery_id', row.delivery_id)
      .select('delivery_id');
    if (upErr) {
      console.error('[supabase-error] lib/email-delivery.server.ts · from:email_deliveries.update', upErr, {
        delivery_id: row.delivery_id,
      });
    }
    if (!upErr && (written?.length ?? 0) > 0) updated += 1;
  }
  return updated;
}

/** CRON-FREE tick — fired from the admin layout's after(). Never throws. */
export async function maybeRunEmailDeliveryCheck(): Promise<void> {
  await runClaimedJob('email-delivery-check', CHECK_GAP_MS, () => runEmailDeliveryCheck());
}

// ── The readers ─────────────────────────────────────────────────────────────

export type DeliveryLogRead =
  | { ok: true; rows: DeliveryRow[]; summary: DeliverySummary; truncated: boolean }
  | { ok: false; error: string };

const READ_CAP = 1000;

/** The last SUMMARY_WINDOW_MS of sends. `ok:false` is NEVER an empty week. */
export async function readRecentDeliveries(now: number = Date.now()): Promise<DeliveryLogRead> {
  try {
    const admin = createAdminClient();
    const since = new Date(now - SUMMARY_WINDOW_MS).toISOString();
    const { data, error } = await admin
      .from('email_deliveries')
      .select(COLUMNS)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(READ_CAP);
    if (error) return { ok: false, error: error.message };
    const rows = (data ?? []) as DeliveryRow[];
    // At the cap the counts cover only the newest READ_CAP sends — say so.
    return { ok: true, rows, summary: summarize(rows, now), truncated: rows.length >= READ_CAP };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
