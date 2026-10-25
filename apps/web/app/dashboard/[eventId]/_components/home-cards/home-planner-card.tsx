import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { loadAiActivity } from '@/lib/setnayan-ai-activity';
import { readSaiOnWatch } from '@/lib/home-ai-card.server';
import { formatCount } from '@/lib/format-number';
import { HomeCardRow, HomeServiceCard } from '../home-service-card';

/**
 * ✨ SETNAYAN AI — ITS OWN SERVICE CARD (owner-approved 2026-10-24, `home_control_center_2026-10-24_fable.html`: *"while
 * separating what Setnayan AI does, so it can have its own widget"*; the 23 Oct "Service by service" table: "Setnayan AI —
 * Sai on watch alerts · ranked picks · one Ask box · door: the full chat").
 *
 *   QUICK VIEW   "Sai on watch · N alerts" (or all quiet) · the top alert as the one line.
 *   OPEN         Sai on watch — each alert the AI raised for THIS event (the guard notifications it already sends:
 *                `ai_guard_alert` · `ai_payment_due`, unread, `readSaiOnWatch`), each with its own door · Your picks — the
 *                decisions the planner ranks (`buildCockpitModel`, the Planner page's own model), each opening its room
 *                · "Open Setnayan AI ›" last.
 *   PHONE        a tile — "1 alert · 9 days quiet" — that grows the card in place.
 *
 * ⚠ NO ASK BOX: nothing in the product answers a typed question (no assistant chat exists — the Setnayan AI page is the
 * buy + showcase page). Drawing an Ask that sends nowhere would be a door to nothing; it waits for its own build.
 *
 * 🔒 HONEST — `loadAiActivity` fail-softs every read to zeros, so it says whether it measured (`measured`); the alert
 * read answers 'unread' on a refusal. Either unmeasured → "Couldn't load", never "all quiet" over a refusal.
 */
export async function HomePlannerCard({ eventId, name, brand }: { eventId: string; name: string; brand?: string }) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const door = { label: 'Open Setnayan AI', href: `/dashboard/${eventId}/studio/setnayan-ai` };
  const icon = <Sparkles aria-hidden strokeWidth={1.9} />;
  const marker = { 'data-home-service': 'ai' };
  const { data: event, error } = await supabase
    .from('events')
    .select('event_date, event_date_precision, event_type, ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) logQueryError('HomePlannerCard.event', error, { event_id: eventId }, 'graceful_degrade');
  const [activity, watch] = await Promise.all([
    error || !event
      ? null
      : loadAiActivity(supabase, eventId, {
          eventDate: event.event_date ?? null,
          eventDatePrecision: event.event_date_precision ?? null,
          eventType: event.event_type ?? null,
          ceremonyType: event.ceremony_type ?? null,
        }).catch(() => null),
    user ? readSaiOnWatch(supabase, user.id, eventId).catch((): 'unread' => 'unread') : Promise.resolve<'unread'>('unread'),
  ]);
  if (!activity || !activity.measured) return <HomeServiceCard name={name} brand={brand} icon={icon} dots={[]} door={door} failed marker={marker} />;
  if (watch === 'unread') return <HomeServiceCard name={name} brand={brand} icon={icon} dots={[]} door={door} failed marker={marker} />;

  const n = watch.length;
  const top = watch[0] ?? null;
  const picks = activity.cockpit.decisions.slice(0, 3);
  return (
    <HomeServiceCard
      name={name}
      brand={brand}
      icon={icon}
      dots={[{ mood: n > 0 ? 'wait' : 'ok', words: n > 0 ? `Sai on watch · ${formatCount(n)} ${n === 1 ? 'alert' : 'alerts'}` : 'Sai on watch · all quiet', marker: 'ai-watch' }]}
      status={{ lead: top ? top.title : activity.cockpit.briefing.sentence }}
      settings={
        <>
          <p className="home-k2 !mb-0 !mt-3" data-home-ai-section="watch">
            Sai on watch
          </p>
          {watch.length > 0 ? (
            watch.map((a) => (
              <HomeCardRow
                key={a.id}
                label={a.title}
                hint={a.body}
                marker="ai-alert"
                control={
                  a.href ? (
                    <Link href={a.href} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink/65 hover:text-ink" data-home-ai-alert-door="">
                      Look
                      <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                    </Link>
                  ) : null
                }
              />
            ))
          ) : (
            <HomeCardRow label="All quiet" hint="Nothing needs you right now." marker="ai-quiet" />
          )}
          <p className="home-k2 !mb-0 !mt-3" data-home-ai-section="picks">
            Your picks
          </p>
          {picks.length > 0 ? (
            picks.map((d) => (
              <HomeCardRow
                key={d.id}
                label={d.label}
                hint={d.detail}
                marker="ai-pick"
                control={
                  <Link href={d.href} aria-label={`${d.label} — ${d.ctaLabel}`} className="inline-flex items-center text-[13px] font-medium text-ink/65 hover:text-ink">
                    <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.9} />
                  </Link>
                }
              />
            ))
          ) : (
            <HomeCardRow label="Nothing to pick" hint="Your plan has no open choice right now." marker="ai-picks-none" />
          )}
        </>
      }
      door={door}
      marker={marker}
      tile={{ label: brand, big: formatCount(n), unit: n === 1 ? 'alert' : 'alerts', sm: top ? top.title : 'all quiet' }}
    />
  );
}
