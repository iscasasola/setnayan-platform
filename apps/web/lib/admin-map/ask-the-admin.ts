/**
 * ask-the-admin.ts — the words nobody listed, answered once and free ever after.
 *
 * ── THE SHAPE, AND WHY IT IS THIS ORDER ─────────────────────────────────────
 * Three steps, cheapest first, and the AI is the LAST one:
 *
 *   1. **What the box already knows** — the scanned map + the menu, matched by
 *      word. Answers most things, costs ₱0, runs in the browser.
 *   2. **What it has been taught** — a phrase somebody typed before, looked up
 *      in one indexed query. Also ₱0.
 *   3. **The AI** — only when the first two have nothing, and the answer is
 *      written back to step 2 so the same phrasing never reaches a model twice.
 *
 * That ordering is the whole economic story the owner asked about: the feature
 * gets CHEAPER the more it is used, which is the opposite of how AI usually
 * bills. It is also why step 3 can be missing entirely — no key, no network, a
 * refusal — and the box still works exactly as it did.
 *
 * ── WHAT THE MODEL IS ALLOWED TO DO ─────────────────────────────────────────
 * Choose from a list. Nothing else. Its answer is validated against the scanned
 * route map before it is offered or stored, so it cannot invent an address, and
 * it cannot reach a page that does not exist.
 *
 * ⛔ IT CANNOT DO ANYTHING. No action, no form, no press. The owner's own
 * one-person admin plan (2026-07-11) binds this: the machine may prepare and may
 * hold back; it may never be the thing that lets money, a price, an approval or
 * a publish through. This module returns a DESTINATION and a sentence.
 *
 * ⚖ SUPERSESSION, RECORDED RATHER THAN ASSUMED: DECISION_LOG 2026-08-03 removed
 * "Admin AI" as a concept — *"an assistant you have to go and ask is just one
 * more screen to visit"*. The owner reversed that on 2026-08-26, asking for
 * exactly this. The old objection is also answered on its own terms: this is not
 * a screen. It is the ⌘K box that already exists on every admin page.
 */

import Anthropic from '@anthropic-ai/sdk';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ADMIN_ROUTES } from '@/lib/admin-map/admin-routes.generated';

export type AskResult = {
  label: string;
  href: string;
  /** One plain sentence about why, shown under the answer. */
  because: string;
  /** How the answer was reached — the palette shows this, and it is honest. */
  from: 'remembered' | 'ai';
};

/** Same normalisation on the way in and the way out, or a lookup never hits. */
export function normalisePhrase(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Is this an address the admin actually has?
 *
 * 🔑 THE ONE CHECK THAT MAKES A MODEL'S ANSWER SAFE TO SHOW. Every href — from
 * the model OR from a row learned months ago — is checked against the scanned
 * route map. A page that moved makes a learned row degrade to "no answer", never
 * to a link that 404s, and a model that improvises an address is simply refused.
 */
export function isKnownAdminHref(href: string, extra: readonly string[] = []): boolean {
  if (!href.startsWith('/admin')) return false;
  if (extra.includes(href)) return true;
  const path = href.split('?')[0]?.split('#')[0] ?? '';
  return ADMIN_ROUTES.some((r) => r.path === path);
}

/** Step 2 — what the box has been taught. One indexed lookup, no model. */
export async function recallPhrase(question: string): Promise<AskResult | null> {
  const phrase = normalisePhrase(question);
  if (phrase.length < 2) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const { data, error } = await admin
    .from('admin_search_phrases')
    .select('href, label')
    .eq('phrase', phrase)
    .maybeSingle();

  if (error) {
    logQueryError('recallPhrase (admin_search_phrases)', error);
    return null;
  }
  if (!data) return null;
  if (!isKnownAdminHref(String(data.href))) return null;

  // Fire-and-forget: a failed counter must never cost the person their answer.
  void admin
    .from('admin_search_phrases')
    .update({ times_used: 1, last_used_at: new Date().toISOString() })
    .eq('phrase', phrase);

  return {
    label: String(data.label),
    href: String(data.href),
    because: 'You have asked this before.',
    from: 'remembered',
  };
}

/** Is the AI step available at all? FALSE is a normal, supported state. */
export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type Choice = { label: string; href: string };

/**
 * Step 3 — ask the model to CHOOSE from the list.
 *
 * The prompt carries the destinations and nothing else: no database rows, no
 * guest names, no money. The admin's page list is not sensitive and this keeps
 * the request small enough to stay in the fractions of a centavo.
 */
export async function askTheModel(
  question: string,
  choices: readonly Choice[],
): Promise<AskResult | null> {
  if (!aiConfigured() || choices.length === 0) return null;

  const client = new Anthropic();
  const menu = choices.map((c, i) => `${i + 1}. ${c.label} → ${c.href}`).join('\n');

  let message;
  try {
    message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system:
        'You route a Setnayan admin to one page of their own console. ' +
        'Answer ONLY with a number from the list and one short sentence. ' +
        'You never perform actions; you only say where to go. ' +
        'If nothing on the list fits, answer with 0.',
      messages: [
        {
          role: 'user',
          content: `Pages:\n${menu}\n\nThey typed: "${question}"\n\nReply exactly as: <number>|<one short sentence>`,
        },
      ],
    });
  } catch {
    // Any failure — no key, a refusal, a network fault — is a normal miss. The
    // box falls back to what it already showed.
    return null;
  }

  const text = message.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join(' ')
    .trim();
  const match = text.match(/^(\d+)\s*\|\s*(.+)$/);
  if (!match) return null;

  const index = Number(match[1]);
  if (!Number.isInteger(index) || index < 1 || index > choices.length) return null;
  const picked = choices[index - 1];
  if (!picked || !isKnownAdminHref(picked.href, choices.map((c) => c.href))) return null;

  return {
    label: picked.label,
    href: picked.href,
    because: (match[2] ?? '').slice(0, 160),
    from: 'ai',
  };
}

/** Write what was learned, so the next time is free. Never throws. */
export async function rememberPhrase(question: string, answer: AskResult): Promise<void> {
  const phrase = normalisePhrase(question);
  if (phrase.length < 2 || phrase.length > 200) return;
  if (!isKnownAdminHref(answer.href)) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }
  const { error } = await admin.from('admin_search_phrases').upsert(
    {
      phrase,
      href: answer.href,
      label: answer.label,
      learned_from: 'ai',
      times_used: 1,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'phrase' },
  );
  if (error) logQueryError('rememberPhrase (admin_search_phrases)', error);
}
