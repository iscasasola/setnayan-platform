/**
 * 🗂 REPORT — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113 `page=report`). OWNER: C3 (B2 §2.6).
 *
 * Owner 2026-11-08, DECISION_LOG "REPORT = SUBJECT · NOTE · ORIGIN": *"report will be subject, note and we must know
 * where it came from"*. Subject (one line) · Note · "Where it came from · filled in automatically" (the shop · the
 * event and its date · Clients › Report) · thumb **Submit report** (the ruling's word; v113 drew "Send").
 * It lands in /admin/help with its origin, and every admin is told in the app only — no email.
 * NOT built: "Past reports · N" (INVENTED in the parts map — no ruling asks for a history list).
 *
 * Reads: the shop's name (the request-cached profile the client page already resolved) — no new request.
 * `shipped` (what the client page drew under this id before the build — L2 aliases the old Activity tab here) is kept
 * below the form, moved and not lost.
 */
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { ReportForm } from './report-form';
import type { PickedPageProps } from './context';

export async function ReportPage({ ctx, shipped }: PickedPageProps) {
  const supabase = await createClient();
  const profile = await fetchOwnVendorProfile(supabase, ctx.viewerUserId);
  return (
    <div className="space-y-8" data-picked-page="report">
      <ReportForm
        eventId={ctx.eventId}
        shopName={profile?.business_name?.trim() || 'Your shop'}
        eventName={ctx.eventName}
        eventDate={ctx.eventDate}
      />
      {shipped ?? null}
    </div>
  );
}
