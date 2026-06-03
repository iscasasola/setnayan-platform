import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  ServicePoster,
  type PosterStyle,
} from './_components/service-poster';
import { ADD_ONS, addOnHref } from '@/lib/add-ons-catalog';

// Re-export the shared PosterStyle type so existing imports from this file
// (if any) keep working.
export type { PosterStyle };

export const metadata = { title: 'Add-ons' };

type Props = { params: Promise<{ eventId: string }> };

async function isInternalAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(me?.is_internal || me?.is_team_member);
}

export default async function AddOnsPage({ params }: Props) {
  const { eventId } = await params;
  const showDevCodes = await isInternalAdmin();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Add-ons
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          What would you like to set up?
        </h1>
        <p className="max-w-prose text-base text-ink/60">
          Each Setnayan feature lives here. Cards light up as they ship.
        </p>
      </header>

      {/* Poster grid — owner directive 2026-05-23 PM. Each service renders
          as a cinema-style poster with a per-service animated CSS
          background + dark gradient mask + text in the lower third.
          See _components/service-poster.tsx for the per-poster anatomy
          and globals.css `@keyframes poster-*` for the motion primitives.
          Grid stays at 3-col desktop / 2-col tablet / 1-col mobile so
          the 4:5 posters tile cleanly without horizontal scroll on PH
          mid-tier devices. */}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADD_ONS.map((addon) => {
          const href = addOnHref(addon.key, eventId);
          const comingSoon = addon.status === 'coming_soon';

          // Iteration codes only leak to internal admin accounts. Couples
          // and vendors see the human-readable Coming-soon / Web V1 pills
          // OR no pill at all for fully-live services.
          const pill = showDevCodes ? (
            <span className="rounded-full bg-cream/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-cream/80 backdrop-blur-md">
              {addon.iteration}
            </span>
          ) : addon.status === 'web_v1' ? (
            <span className="rounded-full bg-cream/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-cream backdrop-blur-md">
              Web V1
            </span>
          ) : comingSoon ? (
            <span className="rounded-full bg-cream/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-cream/70 backdrop-blur-md">
              Coming soon
            </span>
          ) : null;

          return (
            <li key={addon.key}>
              <ServicePoster
                label={addon.label}
                blurb={addon.blurb}
                cta={addon.cta}
                href={comingSoon ? null : href}
                Icon={addon.Icon}
                style={addon.poster}
                pill={pill}
                comingSoon={comingSoon}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
