import Link from 'next/link';
import { Globe, Palette, Type, ArrowRight } from 'lucide-react';

export const metadata = { title: 'Design · Setnayan' };

/**
 * /dashboard/[eventId]/design — the Design hub.
 *
 * The landing for the "Design" bottom-nav tab (owner-locked 2026-06-16 6-tab
 * nav). Design's surfaces are otherwise scattered — the Website editor lives at
 * /site-editor, Mood Board under /add-ons, Monogram at its own route — so this
 * page is the single home that cards out to all three (same hub pattern as the
 * Studio / add-ons launcher). Static links only; the dashboard layout guards
 * auth + event scoping.
 */
export default async function DesignHubPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const base = `/dashboard/${eventId}`;

  const cards = [
    {
      href: `/site-editor/${eventId}`,
      icon: Globe,
      title: 'Website',
      desc: 'Your wedding website — invitation, RSVP, story & gallery.',
    },
    {
      href: `${base}/add-ons/mood-board`,
      icon: Palette,
      title: 'Mood Board',
      desc: 'Your palette and visual identity.',
    },
    {
      href: `${base}/monogram`,
      icon: Type,
      title: 'Monogram',
      desc: 'Your bespoke wedding mark.',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6">
      <h1
        className="text-2xl"
        style={{
          fontFamily: 'var(--font-serif), Georgia, serif',
          color: 'var(--m-ink)',
        }}
      >
        Design
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--m-slate)' }}>
        The look &amp; feel of your wedding.
      </p>

      <div className="mt-5 grid gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="flex items-center gap-4 rounded-2xl border p-4 transition-colors"
              style={{
                background: 'var(--m-paper, #FFFFFF)',
                borderColor: 'var(--m-line)',
              }}
            >
              <span
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'var(--m-orange-4, #F4ECD8)' }}
              >
                <Icon
                  className="h-[22px] w-[22px]"
                  strokeWidth={1.75}
                  style={{ color: 'var(--m-orange)' }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[15px] font-medium"
                  style={{ color: 'var(--m-ink)' }}
                >
                  {c.title}
                </span>
                <span
                  className="block text-[13px]"
                  style={{ color: 'var(--m-slate)' }}
                >
                  {c.desc}
                </span>
              </span>
              <ArrowRight
                className="h-5 w-5 flex-shrink-0"
                style={{ color: 'var(--m-slate-4, #B6B9BE)' }}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
