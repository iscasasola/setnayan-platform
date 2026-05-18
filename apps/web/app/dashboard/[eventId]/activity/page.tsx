import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchEventActivity, relativeTime } from '@/lib/activity';
import { getLocale, makeT } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function EventActivityPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [eventRes, activity, locale] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, display_name')
      .eq('event_id', eventId)
      .maybeSingle(),
    fetchEventActivity(supabase, eventId, 500),
    getLocale(),
  ]);
  const tr = makeT(locale);
  const event = eventRes.data;
  if (!event) notFound();

  const grouped = groupByDay(activity);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/dashboard/${eventId}`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 hover:text-terracotta"
        >
          <ArrowLeft aria-hidden className="h-3 w-3" />
          {tr('cta.back')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {tr('section.recent_activity')}
        </h1>
        <p className="text-sm text-ink/55">
          {event.display_name} · everything that happened, newest first.
        </p>
      </header>

      {activity.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
          Nothing yet. Add a guest, book a vendor, or place an order — it&rsquo;ll show up here.
        </p>
      ) : (
        <ol className="space-y-6">
          {grouped.map(({ day, items }) => (
            <li key={day} className="space-y-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
                {day}
              </h2>
              <ul className="space-y-1">
                {items.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-terracotta/5"
                    >
                      <span className="truncate text-ink/80">{a.description}</span>
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
                        {relativeTime(a.at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function groupByDay(
  activity: Awaited<ReturnType<typeof fetchEventActivity>>,
): Array<{ day: string; items: Awaited<ReturnType<typeof fetchEventActivity>> }> {
  const groups = new Map<string, typeof activity>();
  for (const a of activity) {
    const key = formatDayKey(a.at);
    const bucket = groups.get(key) ?? [];
    bucket.push(a);
    groups.set(key, bucket);
  }
  return Array.from(groups.entries()).map(([day, items]) => ({ day, items }));
}

function formatDayKey(iso: string | null | undefined): string {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const at = new Date(d);
  at.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - at.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}
