import 'server-only';

/**
 * 👗 THE GOWN MAKER'S CARD READ — NOT an action of its own. The action budget is full, so (like the Cake Maker) it rides
 * the Specialized tools' existing dispatcher, `supplierScan` (`app/_actions/supplier-scan-actions.ts`), as
 * `{ op: 'gown_tool', input }`. The client calls `gownAction` from `./gown-call`.
 *
 *   · `design` — one "Gown design" message, read for its card (both sides of the chat). The message names its stored
 *                row ("Gown design ref:"); the chat is read under the caller's OWN session first (RLS: its members),
 *                then the card's fields — thumbnail · summary · the price shown to the client — and never the tool's
 *                `state`, which holds the shop's own setup.
 *
 * Every refused read is `{ ok: false }` with the words to show — never an empty design.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { gownDesignRefOf } from '@/lib/gown-maker';
import { readGownDesignCard, type GownCard } from '@/lib/gown-maker.server';

export type GownActionInput = { op: 'design'; threadId: string; messageId: string };

export type GownActionResult = { ok: true; op: 'design'; card: GownCard; sentAt: string } | { ok: false; message: string };

const READ_FAILED = 'Couldn’t load this design — try again.';
const fail = (message = READ_FAILED) => ({ ok: false as const, message });

export async function runGownAction(input: GownActionInput): Promise<GownActionResult> {
  if (input?.op !== 'design') return fail();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('Sign in again to see this design.');
  const threadId = String(input.threadId ?? '');
  const messageId = String(input.messageId ?? '');
  if (!threadId || !messageId) return fail();
  // Under the caller's own session: a person who cannot read this chat reads no card from it.
  const [msgRes, threadRes] = await Promise.all([
    supabase.from('chat_messages').select('body, sender_role, created_at').eq('message_id', messageId).eq('thread_id', threadId).maybeSingle(),
    supabase.from('chat_threads').select('vendor_profile_id').eq('thread_id', threadId).maybeSingle(),
  ]);
  const failed = msgRes.error ?? threadRes.error;
  if (failed) {
    logQueryError('gownAction.design', failed, { thread_id: threadId }, 'graceful_degrade');
    return fail();
  }
  const msg = msgRes.data as { body: string | null; sender_role: string | null; created_at: string } | null;
  const shop = (threadRes.data as { vendor_profile_id: string | null } | null)?.vendor_profile_id ?? null;
  // Only the shop's own message names a design.
  if (!msg || !shop || msg.sender_role !== 'vendor') return fail();
  const ref = gownDesignRefOf(msg.body);
  if (!ref) return fail();
  const card = await readGownDesignCard(createAdminClient(), { designId: ref, vendorProfileId: shop });
  if (card === 'unread') return fail();
  if (!card) return fail('This design is no longer kept.');
  return { ok: true, op: 'design', card, sentAt: msg.created_at };
}
