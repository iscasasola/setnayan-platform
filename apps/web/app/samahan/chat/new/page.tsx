/**
 * 💬 /samahan/chat/new?event=… — "+ New group" (hosts only; specs DECISION_LOG 2026-11-11 "+ New group, hosts only" and
 * 2026-11-12 "EVENT GROUP CHATS APPROVED AS DRAWN" (1): a host-made group may hold suppliers and guests). A name and the
 * event's people with a tick each — a plain form, no script. The database re-checks everything
 * (`chat_group_create`: a host makes it; everyone in it is someone on this event).
 */
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { BackButton } from '@/app/_components/back-button';
import { SubmitButton } from '@/app/_components/submit-button';
import { readGroupPeople, type GroupPersonKind } from '@/lib/chat-groups';
import { groupChat } from '../actions';
import { GroupNameRow } from './_components/group-name-row';

export const metadata = { title: 'New group', robots: { index: false, follow: false } };

const KIND_WORD: Record<GroupPersonKind, string> = { host: 'Host', coordinator: 'Coordinator', supplier: 'Supplier', guest: 'Guest' };

export default async function NewGroupPage({ searchParams }: { searchParams: Promise<{ event?: string; error?: string }> }) {
  const { event: eventId, error } = await searchParams;
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/samahan/chat/new?event=${eventId}`)}`);
  const supabase = await createClient();
  const { data: me, error: meError } = await supabase.rpc('chat_group_my_kind', { p_event_id: eventId });
  if (meError || me !== 'host') notFound();
  const people = ((await readGroupPeople(supabase, eventId)) ?? []).filter((p) => p.user_id !== user.id);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-10 pt-4" data-new-group="">
      <BackButton href={`/dashboard/${eventId}/messages`} label="Chats" />
      <h1 className="mt-3 text-[22px] font-semibold text-ink">New group</h1>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-terracotta">
          The group was not made. Give it a name and try again.
        </p>
      ) : null}
      <form action={groupChat.bind(null, 'create')} className="mt-4 space-y-4">
        <input type="hidden" name="event_id" value={eventId} />
        <GroupNameRow />
        <fieldset>
          <legend className="text-[13px] font-semibold text-ink/70">Who is in it</legend>
          <p className="text-[12px] text-ink/55">Hosts, your coordinator, guests and your suppliers. Quotes and payments stay in each supplier’s own chat.</p>
          <ul className="mt-2 divide-y divide-ink/10">
            {people.map((p) => (
              <li key={p.user_id}>
                <label className="flex min-h-[48px] items-center gap-3 py-1">
                  <input type="checkbox" name="person" value={p.user_id} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-ink">{p.name ?? p.first_name ?? 'Someone'}</span>
                    <span className="block text-[12px] text-ink/55">{KIND_WORD[p.kind]}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <SubmitButton className="button-primary w-full" pendingLabel="Making the group…">
          Make the group
        </SubmitButton>
      </form>
    </main>
  );
}
