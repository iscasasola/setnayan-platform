import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { groupChatHref, readGroupHead } from '@/lib/chat-groups';

/**
 * Every answer a group chat gives that is not the chat — sign in, or "no such group" — decided by `./layout.tsx`
 * BEFORE `./loading.tsx` streams, so a 307 / 404 is never sent as a 200, a skeleton and a client hop.
 * `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gateGroupChat = cache(async (threadId: string) => {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(groupChatHref(threadId))}`);
  const supabase = await createClient();

  const head = await readGroupHead(supabase, threadId);
  if (head === 'unread') throw new Error('The group could not be read just now.');
  if (!head) notFound();
  return { user, supabase, head };
});
