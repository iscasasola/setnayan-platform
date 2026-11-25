import { eventRowOnce } from '@/lib/event-row-once';
import Link from 'next/link';
import { QuietStart } from '@/app/_components/states/quiet-start';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ChevronRight, Footprints, Plus } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchEventActivityMeasured, relativeTime, type ActivityItem } from '@/lib/activity';
import { ReadRefusedNotice } from '../_components/read-refused-notice';
import { getLocale, makeT } from '@/lib/i18n';
import { PageMasthead } from '@/app/_components/page-masthead';
import { formatLongTimestamp } from '@/lib/format-date';

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

  const [eventRes, activityRead, locale] = await Promise.all([
    eventRowOnce(supabase, eventId, 'event_id, display_name', () =>
      supabase
      .from('events')
      .select('event_id, display_name')
      .eq('event_id', eventId)
      .maybeSingle()),
    fetchEventActivityMeasured(supabase, eventId, 500),
    getLocale(),
  ]);
  const tr = makeT(locale);
  const activity = activityRead.items;
  // A2-B9: which sources were refused. Every one refused = we cannot say nothing happened; some = the feed is partial.
  const refused = activityRead.refused;
  const event = eventRes.data;
  if (!event) notFound();

  const grouped = groupByDay(activity);

  return (
    <section className="sn-col space-y-6">
      <PageMasthead
        titleNode={<>{tr('section.recent_activity')}</>}
        actions={
          <Link
            href={`/dashboard/${eventId}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-terracotta-700 hover:underline"
          >
            <ArrowLeft aria-hidden className="h-3 w-3" />
            {tr('cta.back')}
          </Link>
        }
      />

      {refused.length > 0 ? (
        <ReadRefusedNotice what={`your ${refused.join(', ')} activity`} partial={activity.length > 0} />
      ) : null}
      {activity.length === 0 && refused.length > 0 ? null : activity.length === 0 ? (
        <QuietStart
          Icon={Footprints}
          title="Nothing has happened yet."
          blurb="Every guest you add, supplier you book and order you place lands here, newest first — so you can see what moved without asking anyone."
          action={
            <Link
              href={`/dashboard/${eventId}/guests`}
              className="ab ab-brand ab-main"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Add your first guest
            </Link>
          }
        />
      ) : (
        <ol className="space-y-6">
          {grouped.map(({ day, items }) => (
            <li key={day} className="space-y-2">
              {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 13 · 14): a grey-capital label per day over hairline rows
                  (56 high, terracotta ›); the time is plain grey words in the body font, not a typewriter caption. */}
              <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
                {day}
              </h2>
              <ul className="divide-y divide-ink/10">
                {items.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      className="flex min-h-14 items-center justify-between gap-3 py-2 text-[15px]"
                    >
                      <span className="truncate text-ink">{a.description}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[13px] tabular-nums text-ink/75">
                        {relativeTime(a.at)}
                        <ChevronRight aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
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
  activity: ActivityItem[],
): Array<{ day: string; items: ActivityItem[] }> {
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
  return formatLongTimestamp(d.toISOString());
}
