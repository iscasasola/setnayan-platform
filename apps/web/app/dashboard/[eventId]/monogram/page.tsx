import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Sparkles, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveMonogram, deriveMonogram } from '@/lib/monogram';
import { eventOwnsAnimatedMonogram } from '@/lib/animated-monogram';
import { AnimatedMonogramHero } from '@/app/_components/animated-monogram-hero';
import { MonogramMaker } from './monogram-maker';

export const metadata = { title: 'Monogram Maker · Setnayan' };

/**
 * /dashboard/[eventId]/monogram — the couple's standalone Monogram Maker.
 *
 * A returnable home (vs. the one-time onboarding step + the inline wizard card)
 * to craft the wedding monogram: initials + one of the 5 curated lockups, with
 * a live draw-on preview. Persists the SAME columns onboarding writes
 * (lib/monogram.ts model) so the design shows everywhere — chrome switcher, QR
 * center, landing hero. The free static/draw monogram is never gated.
 *
 * The "How it animates" section upsells the paid ANIMATED_MONOGRAM SKU
 * (₱2,499 · gated via orders, not a column) and teases the wider animation
 * library that the picker will draw from — that 23-style picker is a tracked
 * scope expansion (Monogram_Maker_Plan_2026-06-05.md), not built here.
 */

const VALID_STYLES = ['bar', 'script', 'duo', 'framed', 'infinity'] as const;
type MonoStyle = (typeof VALID_STYLES)[number];

type Props = { params: Promise<{ eventId: string }> };

export default async function MonogramMakerPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, monogram_text, monogram_color, monogram_style')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  const owns = await eventOwnsAnimatedMonogram(supabase, eventId).catch(() => false);
  const monogram = resolveMonogram(event);

  const source = event.monogram_text?.trim() || deriveMonogram(event.display_name);
  const initialInitials =
    (source.match(/\p{L}/gu) ?? []).slice(0, 2).join('').toUpperCase() || 'AK';
  const initialStyle: MonoStyle = VALID_STYLES.includes(event.monogram_style as MonoStyle)
    ? (event.monogram_style as MonoStyle)
    : 'bar';

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Monogram maker
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your wedding monogram
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Your initials, your way — pick a lockup and watch it draw itself in. It
          shows on your wedding website, your QR codes, and across your dashboard.
        </p>
      </header>

      <MonogramMaker
        eventId={eventId}
        initialInitials={initialInitials}
        initialStyle={initialStyle}
      />

      {/* ── How it animates ── */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8">
        <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex justify-center sm:justify-start">
            <AnimatedMonogramHero
              key={`anim-${monogram.text}`}
              text={monogram.text}
              color={monogram.color}
              size="lg"
            />
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              How it animates
            </p>
            {owns ? (
              <>
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <Check aria-hidden className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
                  Your monogram draws itself in
                </h2>
                <p className="max-w-prose text-sm text-ink/65">
                  The animated draw-on is live on your wedding website&rsquo;s hero —
                  it plays every time a guest lands. More animation styles are on the
                  way.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold tracking-tight">
                  Make it draw itself in
                </h2>
                <p className="max-w-prose text-sm text-ink/65">
                  Upgrade to the Animated Monogram and your initials trace on, line by
                  line, the moment a guest lands on your wedding website. More
                  animation styles are coming soon.
                </p>
                <Link
                  href={`/dashboard/${eventId}/add-ons/animated-monogram`}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-700"
                >
                  <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  See the Animated Monogram
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
