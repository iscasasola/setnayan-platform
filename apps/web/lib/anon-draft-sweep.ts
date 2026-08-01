import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob, DAILY_GAP_MS } from '@/lib/periodic-jobs';
import { ANON_EMAIL_DOMAIN } from '@/lib/anon-onboarding';
import { describeUserDeleteBlocker } from '@/lib/user-delete-blockers';
import { CLAIM_TOKEN_ROTATIONS, freshClaimToken } from '@/lib/erasure/coverage';

/**
 * Abandoned anonymous-draft cleanup (RA 10173 data-minimization).
 *
 * anon-draft onboarding (NEXT_PUBLIC_ANON_ONBOARDING_ENABLED) lets a visitor
 * commit a real account + event as a Supabase native anonymous user; many never
 * secure it. Those drafts hold third-party guest PII under an unidentifiable
 * controller and — with no sweep — persist forever. `public.events` has NO owner
 * FK, so deleting the anon auth user alone would ORPHAN the event (its
 * event_members row cascades away, leaving a member-less, invisible, permanent
 * row). This deletes an abandoned draft in the only safe order:
 *   1. delete the event(s)  → cascades every event-scoped child AND the
 *      NO-ACTION user-FK children (e.g. event_playlist_picks.created_by_user_id)
 *      that would otherwise make admin.auth.admin.deleteUser() throw, and
 *   2. delete the auth user → cascades public.users.
 *
 * Best-effort, batched, idempotent, and a no-op until a real abandoned draft
 * ages past the TTL — safe to drive from admin request traffic.
 */

// ⚠ DPO / counsel sign-off item — retention window for UNCONVERTED anon drafts.
// 30 days is a conservative default for third-party PII held under an
// unidentifiable controller (data-minimization argues for aggressive deletion).
// Tighten as directed before enabling the feature in production.
const ANON_DRAFT_TTL_DAYS = 30;

// Bounded per run so a single admin request never does unbounded work; the
// daily claim keeps chewing through the backlog across subsequent requests.
const BATCH = 50;

export async function runAnonDraftSweep(): Promise<{ scanned: number; deleted: number }> {
  const admin = createAdminClient();
  const cutoffIso = new Date(
    Date.now() - ANON_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Candidates: public.users rows still carrying the non-routable placeholder
  // email (the convert flow overwrites it with the real email), created before
  // the cutoff. This is a cheap pre-filter — is_anonymous is re-confirmed below.
  const { data: candidates, error } = await admin
    .from('users')
    .select('user_id')
    .like('email', `%${ANON_EMAIL_DOMAIN}`)
    .lt('created_at', cutoffIso)
    // Cursor (gap audit · anti-wedge): least-recently-skipped first (NULL = never
    // skipped → sorts first), THEN oldest. Every skip below re-stamps the row so
    // it rotates to the back of the window instead of permanently occupying the
    // head and blocking deletable drafts behind it.
    .order('anon_sweep_skipped_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(BATCH);
  if (error) {
    console.error('[anon-draft-sweep] candidate query failed:', error.message);
    return { scanned: 0, deleted: 0 };
  }

  const rows = candidates ?? [];
  let deleted = 0;

  // Stamp a SKIPPED candidate so the next run orders it behind never-/less-
  // recently-skipped rows (see the query ORDER above). Best-effort — a failed
  // stamp just means the row is re-considered next run; the cursor is
  // ordering-only and never gates deletion, so nothing is deleted unsafely.
  const markSkipped = async (id: string): Promise<void> => {
    try {
      await admin
        .from('users')
        .update({ anon_sweep_skipped_at: new Date().toISOString() })
        .eq('user_id', id);
    } catch {
      /* ordering-only — safe to retry next run */
    }
  };

  for (const row of rows) {
    const uid = (row as { user_id: string }).user_id;
    try {
      // Authoritative converted-marker is auth.users.is_anonymous. The placeholder
      // email can linger on a CONVERTED account if the best-effort profile-email
      // update failed (signup/actions.ts), so re-confirm before ANY delete —
      // deleting a converted (real) account would be data loss.
      const { data: got, error: getErr } = await admin.auth.admin.getUserById(uid);
      if (getErr || got?.user?.is_anonymous !== true) {
        // Converted (real) account with a lingering placeholder email, or a
        // transient lookup error — either way don't delete. Stamp so a permanent
        // converted-account row can't wedge the window.
        await markSkipped(uid);
        continue;
      }

      // Events this draft created — an anon user is only ever a 'couple' member
      // of its own event.
      const { data: memberships } = await admin
        .from('event_members')
        .select('event_id')
        .eq('user_id', uid)
        .eq('member_type', 'couple');
      const eventIds = (memberships ?? [])
        .map((m) => (m as { event_id: string }).event_id)
        .filter(Boolean);

      if (eventIds.length > 0) {
        // Legal hold: never delete an event carrying a payment record (BIR /
        // contract floor). An abandoned draft never paid (checkout is gated for
        // anonymous principals), so this is defensive.
        const { data: paid } = await admin
          .from('orders')
          .select('order_id')
          .in('event_id', eventIds)
          .limit(1);
        if (paid && paid.length > 0) {
          // Legal hold (BIR / contract floor). Stamp so a held draft rotates back.
          await markSkipped(uid);
          continue;
        }

        const { error: delEventsErr } = await admin
          .from('events')
          .delete()
          .in('event_id', eventIds);
        if (delEventsErr) {
          console.error(`[anon-draft-sweep] event delete failed (${uid}):`, delEventsErr.message);
          await markSkipped(uid);
          continue;
        }
      }

      // 🔴 ROTATE BEFORE DELETING. `paparazzi_seats.claimer_user_id` is
      // `REFERENCES auth.users(id) ON DELETE SET NULL`, and `claim_qr_token` is
      // NOT in that clause. So deleting the auth user below silently unclaims
      // every seat this person holds while leaving their printed QR intact:
      // seatClaimability() flips from 'taken' back to 'claimable', and
      // papic_claim_seat's `AND claimer_user_id IS NULL` then passes. The QR
      // they walked in with 30 days ago becomes a working claim credential for
      // whoever is holding it.
      //
      // The sweep never noticed because its only guard looks for `event_members`
      // rows with member_type='couple', and a seat claimer is never a couple
      // member of the event — so eventIds is empty and the legal-hold block
      // above is skipped in full.
      //
      // This is the same invariant the erasure path enforces: THE UNCLAIM AND
      // THE ROTATION MUST NEVER BE SEPARATED. Here the unclaim is performed by
      // the database, so the rotation has to happen first.
      let rotateFailed = false;
      for (const rot of CLAIM_TOKEN_ROTATIONS) {
        const { data: held, error: selErr } = await admin
          .from(rot.table)
          .select(rot.idColumn)
          .eq(rot.subjectColumn, uid);
        if (selErr) {
          console.error(`[anon-draft-sweep] seat lookup failed (${uid}):`, selErr.message);
          rotateFailed = true;
          break;
        }
        // One statement per row: both token columns are UNIQUE, so a single
        // table-wide update would write one value to every seat they hold and
        // be rejected by the index the moment they hold two.
        for (const row of (held ?? []) as unknown as Array<Record<string, string | number>>) {
          const { error: rotErr } = await admin
            .from(rot.table)
            .update({ [rot.tokenColumn]: freshClaimToken(), ...rot.clear })
            .eq(rot.idColumn, row[rot.idColumn]);
          if (rotErr) {
            console.error(`[anon-draft-sweep] token rotate failed (${uid}):`, rotErr.message);
            rotateFailed = true;
            break;
          }
        }
        if (rotateFailed) break;
      }
      // Fail CLOSED: if we could not revoke the printed QR, do NOT delete the
      // user, because the FK would unclaim the seat and arm that QR.
      if (rotateFailed) {
        await markSkipped(uid);
        continue;
      }

      // Hard-delete the auth user → cascades public.users. Skip-on-throw so one
      // stubborn row never aborts the batch.
      //
      // This is the ONLY place in the app that issues a real user DELETE — the
      // admin path erases (anonymize + tombstone) instead — so it is also the
      // only place a foreign-key refusal can surface. Since the 2026-08-02 sweep
      // exactly THREE foreign keys still refuse, all deliberately; anything else
      // refusing is a regression, and the two cases must not read the same in the
      // log. A recognised refusal gets its reason; an unrecognised one keeps the
      // raw Postgres text, constraint name and all, because that is the thing
      // somebody needs to go and decide.
      const { error: delUserErr } = await admin.auth.admin.deleteUser(uid);
      if (delUserErr) {
        const deliberate = describeUserDeleteBlocker(delUserErr.message);
        console.error(
          `[anon-draft-sweep] auth delete failed (${uid}):`,
          deliberate ?? delUserErr.message,
        );
        await markSkipped(uid);
        continue;
      }
      deleted++;
    } catch (e) {
      console.error(`[anon-draft-sweep] unexpected error (${uid}):`, e);
      // Unresolved this pass — stamp so it can't wedge the head of the window.
      await markSkipped(uid);
    }
  }

  return { scanned: rows.length, deleted };
}

/**
 * CRON-FREE daily anon-draft sweep — fired from admin-layout after(); a DAILY DB
 * claim guarantees it runs ~once/day across the fleet and survives deploys.
 * Best-effort, never throws.
 */
export async function maybeRunAnonDraftSweep(): Promise<void> {
  try {
    if (await claimPeriodicJob('anon-draft-sweep', DAILY_GAP_MS)) await runAnonDraftSweep();
  } catch {
    /* best-effort — a missed day retries on the next eligible admin request */
  }
}
