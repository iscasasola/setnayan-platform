/**
 * RA 10173 right-to-erasure — the purge engine.
 *
 * EXTRACTED 2026-07-26 from `app/admin/users/actions.ts` with its behaviour and
 * every documented decision intact. Two reasons for the move, both about being
 * able to TEST the thing that erases people's data:
 *
 *   1. `actions.ts` is a `'use server'` module importing `next/cache`,
 *      `next/navigation` and `next/headers` at the top. Nothing can import it
 *      under tsx, so the purge could only ever be reasoned about by reading it.
 *      Reading it is how a column that does not exist survived in the hot path.
 *   2. Side effects (R2 deletes, session revocation) are now INJECTED rather
 *      than imported, so `tests/db/erasure-completeness.db.test.ts` can run this
 *      exact code against the real replayed schema and record what it deleted.
 *      That test is the backstop no static list can replace.
 *
 * The four properties the original established are load-bearing and preserved:
 *
 *   · OWN, NOT SHARED. We purge the leaving user's own data. Shared record
 *     fields (bride/groom names, venue, the jointly-authored event content) stay
 *     — a wedding has two partners plus coordinators. Whether partial erasure of
 *     a shared record should go further is a DPO/counsel ruling, not ours.
 *   · BEST-EFFORT, NEVER BLOCKING. Every step's failure is written to
 *     admin_audit_log under a distinct stage name and swallowed. A stuck purge
 *     must never trap an account in an undeletable state.
 *   · SERVICE-ROLE. Runs on the admin client so it is not subject to the leaving
 *     user's partially torn-down RLS, and can delete rows the append-only chat
 *     RLS denies to `authenticated`.
 *   · AUDITABLE. Success writes `user_erased`; failures write
 *     `erasure_purge_failed` / `erasure_step_failed` so a miss is recoverable by
 *     a manual sweep.
 *
 * ── ONE NEW STRUCTURAL RULE (2026-07-26) ────────────────────────────────────
 * Steps are now grouped so that ONE FAILING COLUMN CANNOT VOID UNRELATED WORK.
 * PostgREST rejects an entire `.update({…})` if any single key is not a real
 * column, and that is not theoretical here: `owner_email` was never a column of
 * `public.events`, so from the day it was added the owned-event purge failed in
 * FULL and the birth data + photo-delivery credential it was supposed to clear
 * were never cleared in production — invisibly, because best-effort logged it
 * and moved on. The phantom names are gone and CI now checks every name against
 * the real schema (`lib/erasure/coverage-guardrail.test.ts`), but the blast
 * radius is bounded as well as the cause removed.
 */
import type { createAdminClient } from '@/lib/supabase/admin';
import { distinctGuestIds, distinctPersonIds } from '@/lib/account-erasure';
import {
  EVENTS_OWNER_PII_NULLS,
  EVENT_PAPERWORK_PII_NULLS,
  EVENT_MODERATOR_SELF_NULLS,
  CLAIM_TOKEN_ROTATIONS,
  OWN_ROW_DELETES,
  OWN_ROW_DELETES_BY_EMAIL,
  freshClaimToken,
  PEOPLE_ANONYMIZE_NULLS,
  SCAN_EVENT_SCANNER_NULLS,
  USERS_ANONYMIZE_NULLS,
  VENDOR_PROFILE_PII_SCRUB,
  VENDOR_VERIFICATION_DOC_SCRUB,
  collectStoredAssetRefs,
  scrubWizardState,
} from '@/lib/erasure/coverage';

export type ErasureAdminClient = ReturnType<typeof createAdminClient>;

/**
 * Side effects the purge needs but must not import, so the module stays free of
 * `server-only` and remains runnable under tsx.
 *
 * The R2 helpers are handed WHOLE REFERENCES rather than a bucket+key pair: the
 * two storage conventions in this codebase are different (`r2://bucket/key` for
 * upload-flow columns, a public R2 URL for chat attachments), and the
 * "which refs are actually ours to delete" judgement lives with the storage
 * layer that owns it. Erasure's obligation is to HAND OVER every ref it finds;
 * the adapter decides what is deletable. Tests assert the hand-over.
 */
export type ErasureIo = {
  /** Delete the object behind an `r2://bucket/key` stored-asset ref. */
  deleteStoredAsset(ref: string): Promise<void>;
  /** Delete the object behind a public R2 URL (chat attachments). */
  deletePublicAssetUrl(url: string): Promise<void>;
  /** Revoke every live session so the lockout is immediate on all devices. */
  revokeAllSessions(
    userId: string,
  ): Promise<{ ok: true; sessionsRevoked: number } | { ok: false; error: string }>;
  /** Injectable clock — lets the tests assert exact tombstone values. */
  now?: () => Date;
};

/**
 * Build the per-purge recorder for data erasure DELIBERATELY LEFT BEHIND.
 *
 * Distinct from `makeAuditFail`: nothing went wrong here. A row was skipped
 * because the purge could not PROVE it belongs to the leaving subject, and the
 * fail-closed rule (see `purgeOwnedEventData`) says an unprovable row is not
 * ours to destroy. That is a correct outcome and a residual obligation at the
 * same time, so it has to be visible rather than silent — otherwise "erasure
 * completed" would quietly mean "erasure completed except for the rows nobody
 * counted".
 *
 * Records COUNTS and ids only, never payload: an audit row must not become a
 * second copy of the CENOMAR number the purge exists to remove.
 */
function makeAuditRetained(
  admin: ErasureAdminClient,
  targetUserId: string,
  actorUserId: string,
  logPrefix: string,
) {
  return async (stage: string, extra: Record<string, unknown>) => {
    console.warn(`[${logPrefix}] ${stage} — rows retained (subject not attributable)`, extra);
    const { error } = await admin.from('admin_audit_log').insert({
      action: 'erasure_unattributed_retained',
      target_id: targetUserId,
      actor_user_id: actorUserId,
      metadata: { stage, ...extra },
    });
    if (error) console.error(`[${logPrefix}] audit-log write failed`, error.message);
  };
}

/** Build the per-purge audit-failure recorder shared by every step below. */
function makeAuditFail(
  admin: ErasureAdminClient,
  targetUserId: string,
  actorUserId: string,
  logPrefix: string,
  action: 'erasure_purge_failed' | 'erasure_step_failed',
  baseMetadata: Record<string, unknown> = {},
) {
  return async (stage: string, message: string, extra: Record<string, unknown> = {}) => {
    console.error(`[${logPrefix}] ${stage} failed`, message);
    const { error } = await admin.from('admin_audit_log').insert({
      action,
      target_id: targetUserId,
      actor_user_id: actorUserId,
      metadata: { stage, message, ...baseMetadata, ...extra },
    });
    if (error) console.error(`[${logPrefix}] audit-log write failed`, error.message);
  };
}

/**
 * RA 10173 right-to-erasure helper (PR-G, extended 2026-07-26).
 *
 * Account deletion no longer removes auth.users, and `events` has NO foreign key
 * to its owner (the link is via event_members only), so the events ROW — and the
 * sensitive per-partner birth date/time captured for the BaZi date-check —
 * survives untouched. That's a right-to-erasure violation for sensitive data.
 *
 * This clears FOUR things, as four independent best-effort steps:
 *
 *   1. `oauth_grants` — where the photo-delivery Google credential ACTUALLY
 *      lives today. Nulling `events.photo_delivery_oauth_token_encrypted` while
 *      leaving a live, cron-refreshed refresh token in `oauth_grants` erased the
 *      pointer and kept the key. Scoped to the grants the SUBJECT consented to
 *      (see the per-partner scoping block below); whether Setnayan must ALSO
 *      call Google's revoke endpoint is a DPO question (see the PR). Runs
 *      BEFORE the owned-event lookup on purpose: a credential is provably the
 *      consenting account's own, so it must be reachable even for a subject who
 *      owns no events at all.
 *
 * …and then, on every event the deleted user OWNS (member_type='couple'):
 *
 *   2. the 5 birth/consent columns + the photo-delivery account email and the
 *      LIVE encrypted photo-delivery OAuth token (EVENTS_OWNER_PII_NULLS);
 *   3. `wizard_state` (jsonb) — the SECOND COPY. Surgically: the personal
 *      payload is stripped and the progress stamps are kept, via an allow-list
 *      (see `scrubWizardState`). Its `meta` passthrough targets the
 *      cenomar_bride / cenomar_groom / church_paperwork / marriage_license task
 *      ids, i.e. slots designed for PSA and CENOMAR reference numbers;
 *   4. `event_paperwork` — the purpose-built home for those same civil-registry
 *      references, plus the scanned document in R2. Payload nulled, checklist
 *      progress kept — and scoped per-partner (below).
 *
 * The SHARED fields (bride/groom names, venue) are left intact — a wedding can
 * have two partners + coordinators; we purge the leaving user's own data, not
 * the shared event (whether partial-erasure of a shared record should go further
 * is a DPO/counsel ruling). Best-effort: a purge failure is logged but does not
 * block the deletion (a stuck purge must never trap an account in an undeletable
 * state).
 *
 * ── PER-PARTNER SCOPING · FAIL CLOSED (owner ruling 2026-07-26) ─────────────
 * "A leaver deletes only their OWN paperwork; the remaining partner keeps
 * theirs."
 *
 * Steps 1 and 4 used to be scoped `.in('event_id', eventIds)` — EVENT-WIDE.
 * `event_paperwork` and `oauth_grants` are both keyed by event_id and had no
 * per-user column, so one partner deleting their account destroyed the OTHER
 * partner's PSA birth certificate, CENOMAR and baptismal/confirmation scans, and
 * revoked a Google credential that may well be the co-partner's account. That is
 * a third party's sensitive personal information (§3(l)) destroyed by someone
 * with no standing to request it, and unlike over-retention it cannot be undone.
 *
 * Both steps are now scoped to a nullable attribution column added by migration
 * `20271009200000_erasure_per_subject_attribution.sql`
 * (`event_paperwork.subject_user_id`, `oauth_grants.granted_by_user_id`), and the
 * rule is: DELETE ONLY WHAT IS PROVABLY THE LEAVER'S. A row whose attribution is
 * NULL is left untouched — never guessed at, never swept up by an event-wide
 * filter.
 *
 * ⚠ THE COST, STATED PLAINLY. This can leave SOME OF THE LEAVER'S OWN PAPERWORK
 * BEHIND — every row written before the attribution column existed is NULL, and
 * `event_paperwork` has no writer that populates it today, so in practice the
 * paperwork step currently erases nothing at all. That is a deliberate trade,
 * not an oversight: retaining a document too long is a fixable compliance miss
 * (and every such row is audit-logged below as `erasure_unattributed_retained`
 * so an operator sweep can still act on it), whereas destroying a co-partner's
 * civil-registry documents is irreversible and harms someone who never asked for
 * anything. When the two failure modes are not symmetric, fail toward the
 * reversible one.
 *
 * ⚠ THE REAL FIX IS NOT BUILT HERE, ON PURPOSE. What is actually missing is a
 * user↔partner-slot link. Nothing in the schema maps an account to "partner 1"
 * or "partner 2": `event_members.role` is only 'host' or NULL, `events` carries
 * bride_name / groom_name / partner_a_birth_date / partner_b_birth_date but no
 * partner_a_user_id, and the second partner frequently has no account at all. So
 * "is this leaver partner_1 or partner_2" is UNANSWERABLE with today's data, and
 * inventing an answer inside an erasure path — the one place a wrong guess
 * destroys someone else's documents — would be the wrong place to invent it.
 * That mapping is a product-model change (it decides who a wedding "belongs to"
 * in a dozen other surfaces), and it is deliberately left to its own PR.
 *
 * Uses the service-role admin client (passed in) so it isn't subject to the
 * leaving user's RLS, which may already be partially torn down.
 *
 * (Renamed from `purgeOwnedEventBirthData` — it has not been only birth data
 * since the photo-delivery columns were added, and is now decidedly not.)
 */
export async function purgeOwnedEventData(
  admin: ErasureAdminClient,
  targetUserId: string,
  actorUserId: string,
  io: ErasureIo,
): Promise<void> {
  // RA 10173 right-to-erasure: a purge failure must NOT trap the account in an
  // undeletable state, but it also must not silently vanish. On any failure we
  // leave a durable admin_audit_log row so the erasure miss is recoverable via a
  // manual sweep.
  const recordErasureFailure = makeAuditFail(
    admin,
    targetUserId,
    actorUserId,
    'purgeOwnedEventData',
    'erasure_purge_failed',
  );
  const recordRetained = makeAuditRetained(admin, targetUserId, actorUserId, 'purgeOwnedEventData');

  // ── 1 · oauth_grants: the live Google credential ───────────────────────────
  // Scoped to `granted_by_user_id` — the account that completed the consent —
  // and NOT to event_id. Deliberate, and the reason this step runs before the
  // owned-event lookup: a grant attributed to the subject is provably their own
  // credential wherever it hangs, and an event-wide filter is exactly what used
  // to revoke the co-partner's Google account.
  //
  // Already-revoked rows are deleted too. `revoked_at` only marks the token as
  // no longer usable BY US; the row still carries external_account_display (an
  // email address), external_account_id (the provider subject id) and a
  // metadata blob with the account's display name and avatar URL. Those are the
  // subject's personal data whether or not the credential still works, so the
  // filter deliberately does not exclude them.
  const { error: grantErr } = await admin
    .from('oauth_grants')
    .delete()
    .eq('granted_by_user_id', targetUserId);
  if (grantErr) {
    await recordErasureFailure('oauth-grants-delete', grantErr.message, {
      kind: 'live_oauth_credential',
    });
  }

  const { data: owned, error: lookupErr } = await admin
    .from('event_members')
    .select('event_id')
    .eq('user_id', targetUserId)
    .eq('member_type', 'couple');
  if (lookupErr) {
    await recordErasureFailure('owned-event-lookup', lookupErr.message, { event_ids: [] });
    return;
  }
  const eventIds = (owned ?? [])
    .map((r) => (r as { event_id?: string }).event_id)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (eventIds.length === 0) return;

  // ── 2 · birth/consent + photo-delivery columns ─────────────────────────────
  const { error: purgeErr } = await admin
    .from('events')
    .update({ ...EVENTS_OWNER_PII_NULLS })
    .in('event_id', eventIds);
  if (purgeErr) {
    await recordErasureFailure('owner-pii-purge', purgeErr.message, {
      event_ids: eventIds,
      kind: 'bazi_birth_data',
    });
  }

  // ── 2 · wizard_state, the JSONB second copy ────────────────────────────────
  // Read → scrub → write back per event. Separate from step 1 on purpose: this
  // is a computed value, and a failure here must not void the column purge.
  const { data: wizardRows, error: wizardReadErr } = await admin
    .from('events')
    .select('event_id, wizard_state')
    .in('event_id', eventIds);
  if (wizardReadErr) {
    await recordErasureFailure('wizard-state-read', wizardReadErr.message, {
      event_ids: eventIds,
      kind: 'wizard_state',
    });
  } else {
    for (const row of wizardRows ?? []) {
      const { event_id: eventId, wizard_state: raw } = row as {
        event_id?: string;
        wizard_state?: unknown;
      };
      if (typeof eventId !== 'string' || eventId.length === 0) continue;
      const scrub = scrubWizardState(raw);
      // Nothing personal in it — skip the write rather than churn the row.
      if (!scrub.changed) continue;
      const { error: wErr } = await admin
        .from('events')
        .update({ wizard_state: scrub.next })
        .eq('event_id', eventId);
      if (wErr) {
        await recordErasureFailure('wizard-state-purge', wErr.message, {
          event_ids: [eventId],
          kind: 'wizard_state',
          // Key PATHS only — never the values. The audit row must not become a
          // second copy of the CENOMAR number we are erasing.
          stripped_paths: scrub.strippedPaths,
        });
      }
    }
  }

  // ── 4 · event_paperwork: PSA / CENOMAR references + the scanned document ───
  // ⚠ `.eq('subject_user_id', targetUserId)` is the whole point — see the
  // per-partner scoping block in the docstring. The `.in('event_id', …)` filter
  // is kept alongside it, not as the gate (subject_user_id is the gate) but so
  // this step stays inside the scope its function name claims.
  const { data: paperwork, error: paperErr } = await admin
    .from('event_paperwork')
    .select('id, document_r2_key')
    .in('event_id', eventIds)
    .eq('subject_user_id', targetUserId);
  if (paperErr) {
    await recordErasureFailure('paperwork-lookup', paperErr.message, {
      event_ids: eventIds,
      kind: 'civil_registry_documents',
    });
  } else if ((paperwork ?? []).length > 0) {
    // Drop the R2 objects FIRST so nulling the pointer can't orphan the file.
    for (const row of paperwork ?? []) {
      const ref = (row as { document_r2_key?: string | null }).document_r2_key;
      if (typeof ref !== 'string' || ref.length === 0) continue;
      try {
        await io.deleteStoredAsset(ref);
      } catch (e) {
        await recordErasureFailure(
          'paperwork-r2-delete',
          e instanceof Error ? e.message : String(e),
          { event_ids: eventIds, kind: 'civil_registry_documents' },
        );
      }
    }
    const { error: pwErr } = await admin
      .from('event_paperwork')
      .update({ ...EVENT_PAPERWORK_PII_NULLS })
      .in('event_id', eventIds)
      .eq('subject_user_id', targetUserId);
    if (pwErr) {
      await recordErasureFailure('paperwork-purge', pwErr.message, {
        event_ids: eventIds,
        kind: 'civil_registry_documents',
      });
    }
  }

  // ── 5 · fail-closed residue: what per-partner scoping deliberately kept ────
  // Counting is not optional bookkeeping. Without it "erasure completed" would
  // silently also mean "…except for N documents and M credentials on your own
  // events that nobody could attribute", and the DPO would have no way to tell
  // the difference between a clean run and a run that skipped everything. These
  // are the rows the OLD event-wide filter would have destroyed.
  // Row ids are read and counted in JS rather than asked for as an exact count:
  // the sets are single-digit (one couple's own events) and `.select(cols, {
  // count })` is a call shape the erasure test's PostgREST adapter does not
  // model. A count the test harness cannot execute is a count nobody verifies.
  const { data: unattributedPaperwork, error: pwCountErr } = await admin
    .from('event_paperwork')
    .select('id')
    .in('event_id', eventIds)
    .is('subject_user_id', null);
  if (pwCountErr) {
    await recordErasureFailure('paperwork-unattributed-count', pwCountErr.message, {
      event_ids: eventIds,
      kind: 'civil_registry_documents',
    });
  } else if ((unattributedPaperwork ?? []).length > 0) {
    await recordRetained('paperwork-unattributed', {
      event_ids: eventIds,
      kind: 'civil_registry_documents',
      retained_count: (unattributedPaperwork ?? []).length,
      reason:
        'subject_user_id IS NULL — the document may be the co-partner’s, and no user↔partner-slot mapping exists to decide',
    });
  }

  const { data: unattributedGrants, error: grCountErr } = await admin
    .from('oauth_grants')
    .select('grant_id')
    .in('event_id', eventIds)
    .is('granted_by_user_id', null);
  if (grCountErr) {
    await recordErasureFailure('oauth-grants-unattributed-count', grCountErr.message, {
      event_ids: eventIds,
      kind: 'live_oauth_credential',
    });
  } else if ((unattributedGrants ?? []).length > 0) {
    await recordRetained('oauth-grants-unattributed', {
      event_ids: eventIds,
      kind: 'live_oauth_credential',
      retained_count: (unattributedGrants ?? []).length,
      reason:
        'granted_by_user_id IS NULL — a pre-attribution grant; the connected account may be the co-partner’s',
    });
  }
}

/**
 * RA 10173 right-to-erasure — chat residue (Data Retention Schedule 2026-07-11).
 *
 * The chat FKs to users are ON DELETE SET NULL (the message sender_user_id,
 * chat_threads.created_by_user_id), and chat_threads only cascade-delete when
 * the EVENT or vendor_profile is removed — but events have no owner FK and are
 * never deleted. So without this, a departing user's message BODIES (their own
 * words = their personal data, up to 4000 chars each) survive the auth-delete
 * indefinitely, with sender_user_id merely nulled.
 *
 * Fix: hard-delete the messages this user AUTHORED. This is the surgical,
 * minimal-harm erasure — the vendor's own messages and any co-partner's messages
 * stay intact (a wedding can have two partners + coordinators; we erase only the
 * leaving user's content, never the shared conversation). Runs on the
 * service-role admin client so it isn't subject to the chat append-only RLS
 * (which denies DELETE to authenticated).
 *
 * ⚠ ATTACHMENTS (added 2026-07-26). Deleting the row without deleting the R2
 * object is strictly WORSE than leaving both: the file stays addressable by URL
 * and the row that recorded it is gone — unreachable-but-retained, the worst of
 * both. So the attachment URLs are collected BEFORE the delete and handed to
 * storage afterwards.
 *
 * ⚠⚠ AND THE BUCKET IS PUBLIC. An earlier version of this note said the file
 * "stays in setnayan-thread-files" — the PRIVATE bucket, readable only via a
 * short-lived presigned GET. That is wrong, and the correction raises the
 * stakes rather than lowering them. `sendChatMessageCore` (lib/chat-send.ts)
 * uploads with `pathPrefix: chat/<thread_id>`, which `bucketForPrefix`
 * (lib/bucket-routing.ts) does not special-case, so it takes the default:
 * **setnayan-media, the PUBLIC bucket** — the chat-send code says as much
 * ("Public URL is acceptable for v1 … signed-URL access control is a tracked
 * follow-up"). A missed delete therefore leaves the subject's uploaded contract
 * or ID scan at a permanently public URL, not behind a signature. Nothing here
 * depends on the bucket name, but the next person reasoning about the residual
 * risk does.
 *
 * Best-effort, matching the other purges: a failure is logged to admin_audit_log
 * (so the erasure miss is recoverable via a manual sweep) but does NOT block the
 * deletion — a stuck purge must never trap an account in an undeletable state.
 *
 * Downstream note: these rows FEED A COUNTER. `countCoupleMessages`
 * (lib/chat.ts) counts couple-authored rows per thread to decide whether a
 * pending vendor thread has already spent its one pre-accept message. Deleting
 * rows here lowers that count. Read that function's docstring before changing
 * this delete — it records why the interaction is accepted rather than defended
 * (it needs a second surviving `member_type='couple'` member on the event, which
 * no shipped app path creates).
 */
export async function purgeUserAuthoredChat(
  admin: ErasureAdminClient,
  targetUserId: string,
  actorUserId: string,
  io: ErasureIo,
): Promise<void> {
  const auditFail = makeAuditFail(
    admin,
    targetUserId,
    actorUserId,
    'purgeUserAuthoredChat',
    'erasure_purge_failed',
    { kind: 'chat_message_bodies' },
  );

  // Collect attachment refs BEFORE the delete — afterwards there is no row to
  // tell us which objects were theirs.
  const { data: attachments, error: readErr } = await admin
    .from('chat_messages')
    .select('attachment_url')
    .eq('sender_user_id', targetUserId)
    .not('attachment_url', 'is', null);
  if (readErr) await auditFail('chat-attachment-lookup', readErr.message);

  const { error } = await admin
    .from('chat_messages') // chat-guard-allow: RA 10173 right-to-erasure — deletes ONLY the leaving user's own authored messages on account deletion (service-role; audit-logged). See fn docstring.
    .delete()
    .eq('sender_user_id', targetUserId);
  if (error) await auditFail('chat-authored-messages', error.message);

  for (const row of attachments ?? []) {
    const url = (row as { attachment_url?: string | null }).attachment_url;
    if (typeof url !== 'string' || url.length === 0) continue;
    try {
      await io.deletePublicAssetUrl(url);
    } catch (e) {
      await auditFail('chat-attachment-r2-delete', e instanceof Error ? e.message : String(e));
    }
  }
}

/**
 * RA 10173 right-to-erasure — the erased user's OTHER owner-scoped personal data,
 * beyond the users identity row + owned-event data + authored chat that
 * `eraseUserAccount` already handles. Every table here is reachable ONLY as the
 * target's OWN PII (their own FK, or the person node they claimed), so scrubbing
 * it harms no other data subject.
 *
 * Deliberately EXCLUDED (DPO / counsel judgment calls — see the PR): shared-event
 * fields (bride/groom/venue and the jointly-authored jsonb content), financial +
 * BIR records (receipts/orders/payments/payouts — lawful retention),
 * consent-audit tables, the fraud identity graph (retention review already
 * pending), third-party PII the user ENTERED about others, and the R2 objects
 * behind verification docs (a DB scrub alone orphans the file). (Per-event
 * guest-side biometrics + face selfies are erased separately by
 * `purgeUserGuestBiometrics`; chat attachments are now handled with the chat
 * rows themselves.)
 *
 * ⚠ EXTENDED 2026-07-26 with the tables whose only cleanup was the
 * `ON DELETE CASCADE` to auth.users. Those cascades stopped firing when
 * `eraseUserAccount` stopped issuing the hard delete, and nothing replaced them
 * — see OWN_ROW_DELETES in lib/erasure/coverage.ts for the list and the
 * per-table reason.
 *
 * Best-effort per step, mirroring the purges above: a failure is audit-logged,
 * never thrown, so one bad step can't trap the account in an undeletable state.
 */
export async function purgeUserOwnedRecords(
  admin: ErasureAdminClient,
  targetUserId: string,
  actorUserId: string,
  opts: { originalEmail: string | null; now: Date },
): Promise<void> {
  const nowIso = opts.now.toISOString();
  const tombstoneEmail = `erased+${targetUserId}@erased.setnayan.invalid`;

  const auditFail = makeAuditFail(
    admin,
    targetUserId,
    actorUserId,
    'purgeUserOwnedRecords',
    'erasure_step_failed',
  );

  const step = async (
    stage: string,
    exec: () => PromiseLike<{ error: { message: string } | null }>,
  ) => {
    const { error } = await exec();
    if (error) await auditFail(stage, error.message);
  };

  // people — the user's OWN durable identity node (claimed_by_user_id UNIQUE).
  // Anonymize the PII columns + tombstone the node. Rows they merely CREATED
  // for third parties (created_by_user_id) are left — that's someone else's PII.
  await step('people-anonymize', () =>
    admin
      .from('people')
      .update({ ...PEOPLE_ANONYMIZE_NULLS, deleted_at: nowIso })
      .eq('claimed_by_user_id', targetUserId),
  );

  // user_face_profiles — the account's OWN biometric template. Sensitive PI with
  // no retention basis → delete the row outright.
  await step('user-face-profile-delete', () =>
    admin.from('user_face_profiles').delete().eq('user_id', targetUserId),
  );

  // push_subscriptions — device push endpoints/keys. Useless after lockout.
  await step('push-subscriptions-delete', () =>
    admin.from('push_subscriptions').delete().eq('user_id', targetUserId),
  );

  // dependents / godparents — the user's PRIVATE family records (owner-scoped;
  // no other data subject can reach them; may hold a minor's sensitive PI).
  await step('dependents-delete', () =>
    admin.from('dependents').delete().eq('owner_user_id', targetUserId),
  );
  await step('godparents-delete', () =>
    admin.from('godparents').delete().eq('owner_user_id', targetUserId),
  );

  // Seats the erased person claimed. THE ROW SURVIVES AND RETURNS TO UNCLAIMED —
  // a seat belongs to the event that paid for it, not to whoever claimed it.
  //
  // Until 2026-08-01 erasure did not name these tables, so claimer_user_id kept
  // pointing at a deleted account and both claimability gates read "taken": the
  // couple's paid seat was held forever by a ghost.
  //
  // ⚠ THE UNCLAIM AND THE ROTATION MUST STAY IN ONE STATEMENT. Clearing the
  // claimer alone flips the row back to `claimable`, and the erased person's QR
  // is still printed and still points at that token — freeing the seat without
  // rotating hands it straight back to them. The token is REPLACED rather than
  // nulled so the seat stays re-issuable (and because claim_qr_token is NOT
  // NULL). See CLAIM_TOKEN_ROTATIONS for why only two tables qualify.
  //
  // ⚠ ONE STATEMENT PER ROW, NOT ONE PER TABLE. Both token columns are UNIQUE
  // (`claim_qr_token TEXT NOT NULL UNIQUE`, and
  // panood_camera_operators_claim_qr_token_key). A single
  // `.update({ token: freshClaimToken() }).eq(subject, id)` would write the SAME
  // value to every row the person claimed, so anyone holding two seats — two
  // events, or two seats at one event — trips the unique index, the whole
  // statement fails, and the best-effort step() logs it and moves on leaving
  // NOTHING freed. That is the same swallow-the-failure shape as the
  // events.owner_email PGRST204 bug. Each row therefore gets its own token.
  for (const rot of CLAIM_TOKEN_ROTATIONS) {
    await step(`claim-token-rotate:${rot.table}`, async () => {
      const { data, error } = await admin
        .from(rot.table)
        .select(rot.idColumn)
        .eq(rot.subjectColumn, targetUserId);
      if (error) return { error };
      const rows = (data ?? []) as unknown as Array<Record<string, string | number>>;
      for (const row of rows) {
        const { error: upErr } = await admin
          .from(rot.table)
          .update({ [rot.tokenColumn]: freshClaimToken(), ...rot.clear })
          .eq(rot.idColumn, row[rot.idColumn]);
        if (upErr) return { error: upErr };
      }
      return { error: null };
    });
  }

  // guest_claims — the user's own name/email presented when claiming a guest
  // seat. claimer_name is NOT NULL → tombstone; the rest → null.
  await step('guest-claims-anonymize', () =>
    admin
      .from('guest_claims')
      .update({ claimer_name: '[erased]', claimer_email: null, otp_sent_to: null })
      .eq('claimer_user_id', targetUserId),
  );

  // help_messages — support tickets the user authored. Keep the shell for
  // support continuity but erase every PII field (all three are NOT NULL bar the
  // name → tombstone/placeholder rather than null).
  await step('help-messages-anonymize', () =>
    admin
      .from('help_messages')
      .update({ sender_email: tombstoneEmail, sender_name: null, subject: '[erased]', body: '[erased]' })
      .eq('user_id', targetUserId),
  );

  // vendor_profiles — the user's OWN shop (user_id is UNIQUE = sole owner). Scrub
  // the contact PII, blank the NOT NULL name, and unpublish it from the
  // marketplace. The shell stays for team continuity (DPO note in the PR).
  await step('vendor-profile-anonymize', () =>
    admin
      .from('vendor_profiles')
      .update({ ...VENDOR_PROFILE_PII_SCRUB })
      .eq('user_id', targetUserId),
  );

  // vendor_push_tokens — the vendor-side twin of push_subscriptions (above),
  // which diverged because it is keyed by vendor_profile_id and has no user FK.
  // Resolve through the user's own shop.
  const { data: shop, error: shopErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (shopErr) {
    await auditFail('vendor-shop-lookup', shopErr.message);
  } else {
    const vendorProfileId = (shop as { vendor_profile_id?: string } | null)?.vendor_profile_id;
    if (typeof vendorProfileId === 'string' && vendorProfileId.length > 0) {
      await step('vendor-push-tokens-delete', () =>
        admin.from('vendor_push_tokens').delete().eq('vendor_profile_id', vendorProfileId),
      );
    }
  }

  // event_moderators — the subject's OWN co-host/coordinator seat: the contact
  // details the invite went to, plus the live invitation bearer token.
  // `display_label` is left (the host's record of who their coordinator was —
  // same call as bride/groom names on a shared event row); rows where the
  // subject is the INVITER are third-party PII and are left too.
  await step('event-moderator-self-anonymize', () =>
    admin
      .from('event_moderators')
      .update({ ...EVENT_MODERATOR_SELF_NULLS })
      .eq('user_id', targetUserId),
  );

  // scan_events — drop the scanner's identity + device trail, keep the host's
  // per-guest scan record. Surgical rather than a delete: the row belongs to the
  // event as much as to the scanner.
  await step('scan-events-anonymize', () =>
    admin
      .from('scan_events')
      .update({ ...SCAN_EVENT_SCANNER_NULLS })
      .eq('scanner_user_id', targetUserId),
  );

  // Whole-row deletes keyed by the subject's own FK — the cleanup the disarmed
  // ON DELETE CASCADEs used to do. Reason per table in coverage.ts.
  for (const { table, column } of OWN_ROW_DELETES) {
    await step(`${table}-delete`, () => admin.from(table).delete().eq(column, targetUserId));
  }

  // Pre-signup marketing captures — no user FK exists, so the ORIGINAL email
  // (captured before the tombstone) is the only key that reaches them.
  if (opts.originalEmail && opts.originalEmail.length > 0) {
    for (const { table } of OWN_ROW_DELETES_BY_EMAIL) {
      await step(`${table}-delete`, () =>
        admin.from(table).delete().eq('email', opts.originalEmail as string),
      );
    }
  }
}

/**
 * RA 10173 right-to-erasure — the vendor's uploaded GOVERNMENT IDENTITY
 * DOCUMENTS (added 2026-07-26).
 *
 * `vendor_verification_applications.doc_uploads` is a JSONB map of verification
 * slots holding R2 refs to the vendor's government ID, DTI / SEC certificate,
 * BIR 2303 and Mayor's Permit, in the PRIVATE `setnayan-vendor-verification`
 * bucket. Before this there was NO erasure code for it at all: the identity
 * documents — the most sensitive PI a vendor ever hands over — survived account
 * deletion in full, both the DB refs and the objects behind them.
 *
 * ⚠ WHY NOTHING CAUGHT IT. The erasure guardrail's "unclassified subject-bearing
 * table" check keys on a `*_user_id` column. This table has exactly one,
 * `admin_user_id`, and that is the REVIEWING STAFF MEMBER — correctly treated as
 * a staff actor and skipped. Everything else is keyed by `vendor_profile_id`. So
 * the detector could never have flagged this table, no matter how long it went
 * uncovered: the miss is STRUCTURAL, not an oversight in the list. It is now
 * pinned in `PURGED_WITHOUT_SUBJECT_COLUMN` (coverage-guardrail.test.ts) so the
 * blind spot is counted, and this docstring exists so the next person reads the
 * guard's limits rather than its green tick.
 *
 * Resolution path mirrors `vendor_push_tokens` in `purgeUserOwnedRecords`:
 * `vendor_profiles.user_id` is UNIQUE, so the subject is the SOLE owner of at
 * most one shop, and every application under it is theirs. There is no
 * co-partner analogue here and therefore no fail-closed problem — unlike
 * `event_paperwork`, a vendor application cannot belong to a second data
 * subject.
 *
 * R2 objects are dropped FIRST, then the JSONB is emptied — same ordering rule
 * as the paperwork and chat-attachment purges, because clearing the pointer
 * before the object leaves the file addressable with nothing left to say it was
 * theirs. The row itself SURVIVES, scrubbed: it is also the admin verification
 * decision record (see VENDOR_VERIFICATION_DOC_SCRUB for why).
 *
 * Best-effort per step, like every purge above: failures are audit-logged, never
 * thrown, so one bad step can't trap the account in an undeletable state.
 */
export async function purgeVendorVerificationDocuments(
  admin: ErasureAdminClient,
  targetUserId: string,
  actorUserId: string,
  io: ErasureIo,
): Promise<void> {
  const auditFail = makeAuditFail(
    admin,
    targetUserId,
    actorUserId,
    'purgeVendorVerificationDocuments',
    'erasure_step_failed',
    { kind: 'vendor_identity_documents' },
  );

  const { data: shops, error: shopErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', targetUserId);
  if (shopErr) {
    await auditFail('vendor-verification-shop-lookup', shopErr.message);
    return;
  }
  const vendorProfileIds = (shops ?? [])
    .map((r) => (r as { vendor_profile_id?: string }).vendor_profile_id)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (vendorProfileIds.length === 0) return;

  const { data: applications, error: appErr } = await admin
    .from('vendor_verification_applications')
    .select('application_id, doc_uploads')
    .in('vendor_profile_id', vendorProfileIds);
  if (appErr) {
    await auditFail('vendor-verification-application-lookup', appErr.message);
    return;
  }
  if ((applications ?? []).length === 0) return;

  // Drop the private-bucket objects first. `collectStoredAssetRefs` walks the
  // whole JSONB rather than reading a known key — the slot shapes are a
  // seven-member union and two of them are arrays (see its docstring).
  for (const row of applications ?? []) {
    const refs = collectStoredAssetRefs((row as { doc_uploads?: unknown }).doc_uploads);
    for (const ref of refs) {
      try {
        await io.deleteStoredAsset(ref);
      } catch (e) {
        await auditFail(
          'vendor-verification-r2-delete',
          e instanceof Error ? e.message : String(e),
          { vendor_profile_ids: vendorProfileIds },
        );
      }
    }
  }

  const { error: scrubErr } = await admin
    .from('vendor_verification_applications')
    .update({ ...VENDOR_VERIFICATION_DOC_SCRUB })
    .in('vendor_profile_id', vendorProfileIds);
  if (scrubErr) {
    await auditFail('vendor-verification-docs-scrub', scrubErr.message, {
      vendor_profile_ids: vendorProfileIds,
    });
  }
}

/**
 * RA 10173 right-to-erasure — the subject's PER-EVENT guest-side BIOMETRICS.
 *
 * The guest-face-enrolment table has NO user FK: a row holds the biometric
 * template + `asset_url` (the full-res R2 selfie behind it) and is
 * keyed by (event_id, guest_id). Nothing in the identity/owner-scoped purges
 * above reaches it, so before this the subject's face vector + selfie survived
 * account deletion indefinitely. Enrolments are written at RSVP
 * (`app/[slug]/actions.ts`) and day-of (`app/papic/face-enroll-actions.ts`).
 *
 * We resolve the leaving user's guest identities via `event_members.guest_id`
 * (the user→guest link), then hard-delete every enrolment on those guest rows —
 * dropping the R2 selfie objects FIRST so deleting the DB row doesn't orphan the
 * file — and null the subject's own selfie DISPLAY photo on those guest rows
 * (the selfie is the subject's face = their PI, and shares the R2 object with the
 * enrolment asset, so leaving it would both retain the PI and dangle a pointer
 * to a just-deleted object).
 *
 * Best-effort per step, mirroring the other purges: every failure is
 * audit-logged, never thrown, so one bad step can't trap the account undeletable.
 */
export async function purgeUserGuestBiometrics(
  admin: ErasureAdminClient,
  targetUserId: string,
  actorUserId: string,
  io: ErasureIo,
  now: Date,
): Promise<void> {
  const nowIso = now.toISOString();
  const auditFail = makeAuditFail(
    admin,
    targetUserId,
    actorUserId,
    'purgeUserGuestBiometrics',
    'erasure_step_failed',
    { kind: 'guest_biometrics' },
  );

  // Resolve the subject's guest identities via BOTH user→guest links, unioned:
  //
  //  (1) event_members.guest_id — the guest row a signed-in account is bound to
  //      when it JOINS an event (app/join/[eventId]/actions.ts). Covers the
  //      common "RSVP'd, then joined" path.
  //  (2) the person spine — guests.person_id → people.claimed_by_user_id. A guest
  //      row is auto-linked to its durable person node by EMAIL on insert
  //      (set_guest_person trigger / resolve_or_claim_person, migration
  //      20270514555975), and an account CLAIMS that person by the same email.
  //      This catches enrolments the subject made WITHOUT ever joining the event
  //      — e.g. a selfie RSVP on the public event page (submitRsvp writes a
  //      guest-face-enrolment row from a guest-session guestId with NO
  //      event_members insert), then a later same-email signup + account delete.
  //      Resolving only via (1) would leave that face_vector + full-res R2 selfie
  //      surviving deletion — the exact RA 10173 erasure gap this step closes.
  //
  // ⚠ PATH (2) IS CURRENTLY INERT IN PRODUCTION (observed 2026-07-26): zero of
  // the live guest rows carry a person_id, so the union collapses to path (1).
  // Nothing is lost today (guest_face_enrollments is empty), but the safeguard is
  // not doing what its docstring claims — flagged in the PR, not silently fixed
  // here, because the remedy is in the guest/person linking path, not erasure.
  //
  // Ordering note: purgeUserOwnedRecords runs BEFORE this step and only NULLs the
  // people PII columns + stamps deleted_at — it does NOT null claimed_by_user_id
  // (that UNIQUE link is retained), so the (2) lookup is still resolvable here.
  const { data: memberships, error: mErr } = await admin
    .from('event_members')
    .select('guest_id')
    .eq('user_id', targetUserId)
    .not('guest_id', 'is', null);
  if (mErr) {
    await auditFail('biometrics-membership-lookup', mErr.message);
    return;
  }

  const { data: claimedPersons, error: pnErr } = await admin
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', targetUserId);
  if (pnErr) {
    await auditFail('biometrics-person-lookup', pnErr.message);
    return;
  }
  const personIds = distinctPersonIds((claimedPersons ?? []) as { person_id?: string | null }[]);

  let personLinkedGuests: { guest_id?: string | null }[] = [];
  if (personIds.length > 0) {
    const { data: pg, error: pgErr } = await admin
      .from('guests')
      .select('guest_id')
      .in('person_id', personIds);
    if (pgErr) {
      await auditFail('biometrics-person-guest-lookup', pgErr.message);
      return;
    }
    personLinkedGuests = (pg ?? []) as { guest_id?: string | null }[];
  }

  const guestIds = distinctGuestIds([
    ...((memberships ?? []) as { guest_id?: string | null }[]),
    ...personLinkedGuests,
  ]);
  if (guestIds.length === 0) return;

  // Pull enrolment asset refs (ALL rows, incl. superseded/revoked — every selfie
  // this subject ever enrolled for these events must go) before deleting.
  const { data: enrols, error: eErr } = await admin
    .from('guest_face_enrollments') // chat-guard-allow: RA 10173 erasure — reads only asset_url (the R2 selfie key) to clean up storage, never a face vector
    .select('asset_url')
    .in('guest_id', guestIds);
  if (eErr) {
    await auditFail('biometrics-enrolment-lookup', eErr.message);
    return;
  }

  // Delete the R2 selfie objects (full-res biometric source). Idempotent on a
  // missing key; best-effort per object.
  for (const row of enrols ?? []) {
    const ref = (row as { asset_url?: string | null }).asset_url;
    if (typeof ref !== 'string' || ref.length === 0) continue;
    try {
      await io.deleteStoredAsset(ref);
    } catch (e) {
      await auditFail('biometrics-r2-delete', e instanceof Error ? e.message : String(e));
    }
  }

  // Hard-delete the enrolment rows (vector + asset ref + consent record).
  const { error: dErr } = await admin
    .from('guest_face_enrollments') // chat-guard-allow: RA 10173 erasure — hard-deletes the subject's OWN enrolment rows (no vector is read)
    .delete()
    .in('guest_id', guestIds);
  if (dErr) await auditFail('biometrics-enrolment-delete', dErr.message);

  // Null the subject's OWN selfie display photo on those guest rows (their face
  // = their PI; also avoids a dangling pointer to the deleted R2 object). Only
  // 'selfie'-sourced photos — a Gmail avatar is display-only, non-biometric.
  const { error: pErr } = await admin
    .from('guests')
    .update({ photo_url: null, photo_source: null, photo_updated_at: nowIso })
    .in('guest_id', guestIds)
    .eq('photo_source', 'selfie');
  if (pErr) await auditFail('biometrics-guest-photo-null', pErr.message);
}

/** What the caller needs after erasure to invalidate cached public pages. */
export type EraseResult = {
  /** The user's public-profile slug before it was nulled, if they had one. */
  publicSlug: string | null;
};

/**
 * RA 10173 right-to-erasure — the terminal erasure step (soft-delete + anonymize).
 *
 * REPLACES the old hard `auth.admin.deleteUser`, which THREW for any user with
 * activity: ~46 foreign keys to auth.users / public.users were ON DELETE
 * NO ACTION / RESTRICT, and `vendor_team_guard_trg` aborts the delete of a
 * vendor's sole admin. So the admin Delete button — and the RA 10173 self-serve
 * erasure queue that funnels through here — 500'd on real accounts, leaving
 * erasure unfulfillable. Worse, the two PII purges used to run and COMMIT
 * *before* the throwing hard-delete, so a failed delete left the account LIVE
 * with its birth data + chat already erased (an inconsistent, unrecoverable state).
 *
 * ⚠ PAST TENSE ON PURPOSE (2026-08-02). Those foreign keys have since been swept
 * — 48 of them decided across two migrations, and exactly THREE still refuse, all
 * deliberately (order_refunds · supplies_orders · vendor_contract_signatures; see
 * tests/db/user-delete-refusing-fks.baseline.txt). A hard delete would therefore
 * succeed today for most accounts, and that does NOT make it the right call. The
 * FK situation was only ever the reason the old code CRASHED; the reason this
 * function anonymizes instead is the one in "Legal posture" below — erase the
 * personal data, keep the business record. Reintroducing a DELETE on the strength
 * of the FKs now being clear would destroy transactional history that the very
 * same sweep concluded must survive its author.
 *
 * Fix: we never DELETE auth.users. Instead we
 *   0. capture what the anonymize is about to destroy but the purges still need
 *      (own uploaded-file refs · the ORIGINAL email · the public slug);
 *   1. anonymize the public.users PII + stamp `deleted_at` (the middleware +
 *      dashboard/vendor-dashboard layouts reject any session with deleted_at set
 *      — immediate lockout);
 *   2. revoke every live session;
 *   3. scrub the auth.users email AND the GoTrue user_metadata (which carries a
 *      second copy of the full name, email and OAuth avatar URL);
 *   4. run the domain PII purges;
 *   5. delete the user's OWN uploaded files from R2 (profile photo · shop logo)
 *      so nulling the DB pointer doesn't orphan the object.
 * No DELETE is issued, so all the RESTRICT FKs + the vendor-admin trigger are
 * sidestepped, and it is idempotent (re-running re-tombstones to the same values).
 *
 * ⚠ CONSEQUENCE OF NOT DELETING auth.users, made explicit 2026-07-26: the ~60
 * `ON DELETE CASCADE` foreign keys that used to clean up after a hard delete
 * NEVER FIRE. The original docstring framed the change purely as sidestepping
 * RESTRICT FKs and did not note that it also disarmed every CASCADE, which is
 * why tables like `notifications` and `api_keys` quietly kept the subject's data.
 * The replacement is explicit and enumerated (OWN_ROW_DELETES in
 * lib/erasure/coverage.ts) and CI now fails when a new subject-bearing table
 * lands without a decision (lib/erasure/coverage-guardrail.test.ts).
 *
 * Legal posture: this erases the data subject's PERSONAL data. Transactional /
 * attribution rows (orders, vendor-team membership, audit) persist under the
 * lawful basis to retain business records — you erase the personal data, not
 * every row. ⚠ STILL a DPO / counsel retention-review item (NOT scrubbed here):
 * shared-event fields and the jointly-authored event content; the R2 objects
 * behind Papic media and verification docs; financial + BIR records;
 * consent-audit tables; audit logs; and the fraud identity graph (note: this DOES
 * null `users.address_normalized`, a fraud-graph input — carve out if counsel
 * establishes a fraud-retention basis). `auth.identities.identity_data` is a
 * KNOWN GAP, pinned in the guardrail. Best-effort per step: a failure is
 * audit-logged, never thrown, so erasure can't trap the account undeletable.
 */
export async function eraseUserAccount(
  admin: ErasureAdminClient,
  targetUserId: string,
  actorUserId: string,
  io: ErasureIo,
): Promise<EraseResult> {
  const now = io.now ? io.now() : new Date();
  const nowIso = now.toISOString();
  // Per-user unique tombstone (auth.users.email + public.users.email are unique).
  // The .invalid TLD (RFC 2606) can never be a real deliverable address.
  const tombstoneEmail = `erased+${targetUserId}@erased.setnayan.invalid`;

  const auditFail = makeAuditFail(
    admin,
    targetUserId,
    actorUserId,
    'eraseUserAccount',
    'erasure_step_failed',
  );

  // 0. Capture what step 1 is about to destroy:
  //    · own uploaded-file refs (profile photo · shop logo) — nulling the DB
  //      pointer alone orphans the object in R2;
  //    · the ORIGINAL email — the only key that reaches the pre-signup marketing
  //      captures, which have no user FK at all;
  //    · the public slug — so the caller can invalidate the cached public page.
  //    (Papic/event photos are shared-event → left for the DPO shared-record
  //    ruling; gov-ID/selfie were retired 2026-07-03 and are never stored.)
  const [preUser, preVendor] = await Promise.all([
    admin
      .from('users')
      .select('profile_photo_url, email, slug')
      .eq('user_id', targetUserId)
      .maybeSingle(),
    admin.from('vendor_profiles').select('logo_url').eq('user_id', targetUserId).maybeSingle(),
  ]);
  const preUserRow = preUser.data as {
    profile_photo_url?: string | null;
    email?: string | null;
    slug?: string | null;
  } | null;
  const ownFileRefs = [
    preUserRow?.profile_photo_url,
    (preVendor.data as { logo_url?: string | null } | null)?.logo_url,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);
  const originalEmail =
    typeof preUserRow?.email === 'string' && !preUserRow.email.endsWith('@erased.setnayan.invalid')
      ? preUserRow.email
      : null;
  const publicSlug = typeof preUserRow?.slug === 'string' && preUserRow.slug.length > 0 ? preUserRow.slug : null;

  // 1. Anonymize the public.users PII + lock the account out via deleted_at.
  //    email is NOT NULL → tombstone rather than null. Covers the sensitive PI
  //    (§3(l)) the identity row carries beyond name/contact: religion, civil
  //    status, sex, address, self-review venue, and the public social-post link.
  const { error: pErr } = await admin
    .from('users')
    .update({
      ...USERS_ANONYMIZE_NULLS,
      email: tombstoneEmail,
      deleted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('user_id', targetUserId);
  if (pErr) await auditFail('users-anonymize', pErr.message);

  // 2. Kill live sessions so the lockout is immediate on every device.
  const revoked = await io.revokeAllSessions(targetUserId);
  if (!revoked.ok) await auditFail('session-revoke', revoked.error);

  // 3. Scrub the auth.users email (frees the original + removes email PII) AND
  //    the GoTrue user_metadata. The metadata is a SECOND COPY of the subject's
  //    full name, email and OAuth avatar URL, written at signup by the Google /
  //    Facebook / Apple providers; before this it survived a "completed" erasure
  //    untouched. email_confirm:true applies the address change immediately
  //    without mailing the tombstone.
  //    ⚠ NOT covered: auth.identities.identity_data holds a THIRD copy per linked
  //    provider. Pinned as a KNOWN GAP in the guardrail rather than removed here
  //    — see the PR body.
  const { error: aErr } = await admin.auth.admin.updateUserById(targetUserId, {
    email: tombstoneEmail,
    email_confirm: true,
    user_metadata: {},
  });
  if (aErr) await auditFail('auth-scrub', aErr.message);

  // 4. Domain PII purges (owned-event owner data + wizard_state + civil-registry
  //    paperwork + the live OAuth grant · authored chat bodies + attachments ·
  //    the user's uploaded vendor-verification identity documents · the user's
  //    other owner-scoped records · the subject's per-event GUEST-side
  //    biometrics + selfies).
  await purgeOwnedEventData(admin, targetUserId, actorUserId, io);
  await purgeUserAuthoredChat(admin, targetUserId, actorUserId, io);
  // Ordering note: BEFORE purgeUserOwnedRecords on purpose. That step scrubs
  // vendor_profiles, and although it does not currently touch `user_id` (the
  // link this resolves through), depending on that is a needless coupling —
  // running first means the vendor-document purge cannot be broken by a future
  // widening of the profile scrub.
  await purgeVendorVerificationDocuments(admin, targetUserId, actorUserId, io);
  await purgeUserOwnedRecords(admin, targetUserId, actorUserId, { originalEmail, now });
  await purgeUserGuestBiometrics(admin, targetUserId, actorUserId, io, now);

  // 5. Delete the user's own uploaded FILES from R2 (the objects behind the
  //    now-nulled profile-photo + shop-logo pointers). Best-effort: the storage
  //    adapter throws only if R2 is unconfigured — caught so a storage hiccup
  //    can't trap the erasure. Only `r2://` refs from the current upload flow are
  //    removed; a legacy/external URL is left (it may not even be ours).
  for (const ref of ownFileRefs) {
    try {
      await io.deleteStoredAsset(ref);
    } catch (e) {
      await auditFail('r2-object-delete', e instanceof Error ? e.message : String(e));
    }
  }

  // 6. Success audit.
  const { error: successErr } = await admin.from('admin_audit_log').insert({
    action: 'user_erased',
    target_id: targetUserId,
    actor_user_id: actorUserId,
    metadata: { method: 'soft_delete_anonymize' },
  });
  if (successErr) console.error('[eraseUserAccount] success audit write failed', successErr.message);

  return { publicSlug };
}
