'use server';

/**
 * Manual re-run for the SEO/GEO audit.
 *
 * WHY THIS EXISTS. The audit is cron-free: `app/admin/layout.tsx` fires
 * `runSeoPeriodicJobs()` inside `after()`, claim-gated to roughly once a day. That
 * has two consequences an admin cannot work around by reloading:
 *   1. `after()` runs AFTER the response is flushed, so the snapshot you are
 *      looking at is always the PREVIOUS one — your refresh lands on the next load.
 *   2. The claim gate ignores you until ~24h have elapsed, so hammering reload
 *      does nothing at all.
 * This action calls the two jobs DIRECTLY, bypassing `claimPeriodicJob`, so a
 * price edit can be confirmed in seconds instead of tomorrow.
 *
 * ⚠ SECURITY. The /admin layout gating protects the PAGE, not this action — a
 * server action is independently invocable by anyone who can guess its id, so the
 * admin check has to live here. Same shape as app/admin/songs/actions.ts.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { runSeoHealthAudit, runSeoGscPull } from '@/lib/seo/seo-cron-jobs';
import { aiAnswerById, aiAnswerRationale, AI_SAID_MAX_CHARS, type AiAnswerVerdict } from '@/lib/seo/ai-answers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';

// Mirrors the /admin/pricing requireAdmin gate (defense-in-depth — the /admin
// layout already 404s non-admins, but server actions re-check).
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
}

export type RerunResult = {
  ok: boolean;
  /** Human-readable outcome for the button to echo back. */
  message: string;
};

/**
 * THE ONE EXPORT of this file — the SEO console's dispatcher. No form → re-run the audit (the masthead button);
 * `op` = 'log' | 'resolve' → the AI-answer check (Build 6 Lane K). One export, not three, because every exported
 * server action is a Vercel route and the repo holds them to a ceiling (`scripts/lint-server-action-budget.mjs`,
 * preference 1: reuse an existing action). Both halves answer `{ ok, message }`.
 */
export async function seoConsole(formData?: FormData): Promise<RerunResult> {
  const op = formData ? String(formData.get('op') ?? '') : '';
  if (op === 'resolve') return resolveAiAnswerDrift(formData!);
  if (op === 'log') return logAiAnswerCheck(formData!);
  return rerunSeoAudit();
}

async function rerunSeoAudit(): Promise<RerunResult> {
  await requireAdmin();

  const health = await runSeoHealthAudit();
  const gsc = await runSeoGscPull();

  // Fresh snapshot is in the table; re-render the surface so it shows THIS run
  // rather than the one before it.
  revalidatePath('/admin/app-performance');

  if (!health.ok) {
    return { ok: false, message: 'Health audit failed to write a snapshot — check server logs.' };
  }

  // Be honest about the half that did nothing. Search Console is unconfigured
  // until the owner pastes GOOGLE_SITE_VERIFICATION / the GSC credentials into
  // Vercel env, and silently reporting "done" would hide that.
  const gscNote = gsc.skipped
    ? ' Search Console skipped — not configured.'
    : gsc.ok
      ? ` Search Console: ${gsc.days ?? 0} day(s) pulled.`
      : ' Search Console pull failed — check server logs.';

  const drift = health.drift ?? 0;
  return {
    ok: true,
    message: `Audit re-run. ${drift} price-drift entr${drift === 1 ? 'y' : 'ies'}.${gscNote}`,
  };
}

/* ── Build 6 Lane K · the AI-answer check ────────────────────────────────────────────────────────────────────────
 * Once a month somebody asks an AI assistant the saved questions (lib/seo/ai-answers.ts) and records what it said.
 * Each answer becomes ONE `seo_suggestions` row — the queue that table was created for (migration
 * 20270710700100: "the weekly AI meta/FAQ review queue … a human approves"):
 *   · "AI got it wrong" → status 'pending' — our true answer is the suggestion, the AI's words the current value.
 *   · "AI got it right" → status 'rejected' — reviewed, no change needed. Kept so "last asked" is a fact, not memory.
 * Admin-only, re-checked here because a server action is invocable on its own (see requireAdmin above).
 */

export type AiAnswerLogResult = RerunResult;

async function logAiAnswerCheck(formData: FormData): Promise<AiAnswerLogResult> {
  await requireAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const id = String(formData.get('question_id') ?? '');
  const verdict = String(formData.get('verdict') ?? '') as AiAnswerVerdict;
  const said = String(formData.get('ai_said') ?? '').trim();
  if (verdict !== 'right' && verdict !== 'wrong') return { ok: false, message: 'Pick right or wrong.' };
  if (said.length === 0) return { ok: false, message: 'Paste what the AI said first.' };
  if (said.length > AI_SAID_MAX_CHARS) {
    return { ok: false, message: `Keep it under ${AI_SAID_MAX_CHARS.toLocaleString('en-PH')} characters.` };
  }

  const admin = createAdminClient();
  const answer = aiAnswerById(id, { bookingFee: await getBookingFeeSchedule(admin) });
  if (!answer) return { ok: false, message: 'That question is not on the saved list.' };

  const now = new Date().toISOString();
  const { error } = await admin.from('seo_suggestions').insert({
    route: answer.route,
    field: 'faq',
    current_value: said,
    suggested_value: answer.answer,
    rationale: aiAnswerRationale(answer.id, verdict),
    status: verdict === 'wrong' ? 'pending' : 'rejected',
    // A "right" answer is reviewed the moment it is logged; a "wrong" one waits for the copy fix.
    reviewed_at: verdict === 'right' ? now : null,
    reviewed_by: verdict === 'right' ? (user?.id ?? null) : null,
  });
  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  revalidatePath('/admin/app-performance');
  return {
    ok: true,
    message: verdict === 'wrong' ? 'Logged as drift — it is in the queue below.' : 'Logged — the AI got it right.',
  };
}

/** Close a drift row once the copy (llms.txt, the FAQ, the front page) says the true answer. */
async function resolveAiAnswerDrift(formData: FormData): Promise<AiAnswerLogResult> {
  await requireAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rowId = Number(formData.get('row_id'));
  if (!Number.isInteger(rowId) || rowId <= 0) return { ok: false, message: 'Unknown row.' };

  const { error } = await createAdminClient()
    .from('seo_suggestions')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
    .eq('id', rowId)
    .eq('status', 'pending');
  if (error) return { ok: false, message: `Could not save: ${error.message}` };
  revalidatePath('/admin/app-performance');
  return { ok: true, message: 'Marked fixed.' };
}
