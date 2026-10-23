import { ArrowRight, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { AI_LIVE_FIGURES, loadAiActivity } from '@/lib/setnayan-ai-activity';
import { ActionButton } from '@/components/action-button';
import { HomeCardRow, HomeServiceCard } from '../home-service-card';

/**
 * ✨ THE PLANNER CARD (owner 2026-10-23, approved `prototypes/home_service_widgets_2026-10-23.html` frame 5).
 *
 *   QUICK VIEW   Active · the briefing sentence ("You're 73% booked, 2 decisions need you, next deadline in 6 days.")
 *                with the booked meter (a true total) · See decisions › (Suppliers, ranked — the page's own door).
 *                + the four figures the Planner page draws (`AI_LIVE_FIGURES`, one list), IN the quick view (owner: "Planner
 *                = quick view with its four figures"). It does not grow: the page has no settings (a buy + showcase page),
 *                so the card's head is the door to it.
 *
 * 🔒 HONEST — the prototype's NEW guard: `loadAiActivity` fail-softs every read to zeros, which would say "nothing needs
 * a decision" over a refusal. It now says whether it measured (`measured`); unmeasured → "couldn't load".
 */
export async function HomePlannerCard({ eventId, name, brand }: { eventId: string; name: string; brand?: string }) {
  const supabase = await createClient();
  const door = { label: 'Open Planner', href: `/dashboard/${eventId}/studio/setnayan-ai` };
  const icon = <Sparkles aria-hidden strokeWidth={1.9} />;
  const marker = { 'data-home-service': 'ai' };
  const { data: event, error } = await supabase
    .from('events')
    .select('event_date, event_date_precision, event_type, ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) logQueryError('HomePlannerCard.event', error, { event_id: eventId }, 'graceful_degrade');
  const activity =
    error || !event
      ? null
      : await loadAiActivity(supabase, eventId, {
          eventDate: event.event_date ?? null,
          eventDatePrecision: event.event_date_precision ?? null,
          eventType: event.event_type ?? null,
          ceremonyType: event.ceremony_type ?? null,
        }).catch(() => null);
  if (!activity || !activity.measured) return <HomeServiceCard name={name} brand={brand} icon={icon} dots={[]} door={door} failed marker={marker} />;

  const { briefing } = activity.cockpit;
  return (
    <HomeServiceCard
      name={name}
      brand={brand}
      icon={icon}
      dots={[{ mood: 'ok', words: 'Active', marker: 'ai' }]}
      status={{ lead: briefing.sentence }}
      statusMood="ok"
      meter={{ pct: briefing.lockedPct, label: 'Booked' }}
      actions={
        <ActionButton tone="neutral" icon={<ArrowRight aria-hidden="true" strokeWidth={1.9} />} label="See decisions" href={`/dashboard/${eventId}/vendors`} />
      }
      body={
        /* The four figures ARE the quick view (owner 2026-10-23, answering the prototype's question: "Planner = quick
           view with its four figures") — no grow: the page has no settings, so the head is the door to it. */
        <div className="divide-y divide-ink/10" data-home-planner-figures="">
          {AI_LIVE_FIGURES.map(({ label, of }) => (
            <HomeCardRow key={label} label={label} hint={of(activity)} marker={`ai-${label.toLowerCase()}`} />
          ))}
        </div>
      }
      door={door}
      marker={marker}
    />
  );
}
