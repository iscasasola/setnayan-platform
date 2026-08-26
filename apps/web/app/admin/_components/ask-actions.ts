'use server';

/**
 * ask-actions.ts — the one door between the admin's search box and the
 * remember-then-ask chain.
 *
 * Admin-gated at the top, like every other admin action. The chain itself is in
 * `lib/admin-map/ask-the-admin.ts`; this file exists to hold the gate and to
 * keep the model call off the client.
 */

import { requireAdmin } from '@/lib/admin/require-admin';
import {
  askTheModel,
  recallPhrase,
  rememberPhrase,
  aiConfigured,
  type AskResult,
} from '@/lib/admin-map/ask-the-admin';

export type AskAnswer =
  | { ok: true; answer: AskResult }
  | { ok: false; reason: 'nothing' | 'unavailable' };

/**
 * Answer a question the free word-matching could not.
 *
 * 🔑 REMEMBERED BEFORE ASKED, ALWAYS. The lookup runs first and short-circuits,
 * which is what makes a repeat cost nothing. Reversing these two lines would
 * still LOOK correct — the same answer comes back — while quietly paying a model
 * for something already written down.
 *
 * The candidate list is passed in from the browser because that is where it is
 * already built. It is only ever used to CHOOSE from, and every href that comes
 * back is re-validated against the scanned route map before it is offered or
 * stored — so a tampered list cannot make this return an address the admin does
 * not have.
 */
export async function askTheAdmin(
  question: string,
  choices: { label: string; href: string }[],
): Promise<AskAnswer> {
  await requireAdmin();

  const remembered = await recallPhrase(question);
  if (remembered) return { ok: true, answer: remembered };

  if (!aiConfigured()) return { ok: false, reason: 'unavailable' };

  // Every page, but not every ROW. ~90 lines of "name → address" is about two
  // thousand tokens — fractions of a centavo — while the price rows alone would
  // multiply that for no gain: a model choosing between 22 Papic SKUs is not the
  // question anybody is asking when the word matching has already failed.
  const answer = await askTheModel(question, choices.slice(0, 120));
  if (!answer) return { ok: false, reason: 'nothing' };

  await rememberPhrase(question, answer);
  return { ok: true, answer };
}
