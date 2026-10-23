import Link from 'next/link';
import { ChevronRight, Clapperboard, Video } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { readHomeBoothCard } from '@/lib/home-booth-card.server';
import { formatCount } from '@/lib/format-number';
import { ActionButton } from '@/components/action-button';
import { HomeCardRow, HomeServiceCard } from '../home-service-card';
import { cookies } from 'next/headers';
import { PATIKTOK_TEMPLATES } from '@/lib/patiktok';
import { patiktokBoothCookieName, resolveBoothTemplates } from '@/lib/patiktok-booth-templates';
import { BoothTemplatePick } from './booth-template-pick';

const opens = (href: string, label: string, marker: string) => (
  <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink/65 hover:text-ink" data-home-booth-door={marker}>
    {label}
    <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.9} />
  </Link>
);

/**
 * 🎬 THE VIDEO BOOTH CARD (owner 2026-10-23, approved `prototypes/home_service_widgets_2026-10-23.html` frame 8).
 *
 *   QUICK VIEW   Patiktok is yours / Free to record · "N reels today · M left before the soft cap" + its meter (a true
 *                total, `PATIKTOK_VIDEO_SOFT_CAP`) · Open booth.
 *   OPEN         Your renders · N › · TikTok (Connected · @handle / Connect TikTok, owned only) · not owned: Save & share
 *                (its page sells it — no price on Home) · "Open Patiktok ›".
 *
 * Primary / Backup template — the booth's own per-device pick (`lib/patiktok-booth-templates.ts`, a cookie scoped to the
 * event since 2026-10-24 so Home reads the same one), one dropdown each, posting the booth's own action.
 */
export async function HomeBoothCard({ eventId, name, brand, owned }: { eventId: string; name: string; brand?: string; owned: boolean }) {
  const supabase = await createClient();
  const read = await readHomeBoothCard(supabase, eventId, owned).catch(() => ({ ok: false }) as const);
  const page = `/dashboard/${eventId}/studio/patiktok`;
  const door = { label: 'Open Patiktok', href: page };
  const icon = <Clapperboard aria-hidden strokeWidth={1.9} />;
  const marker = { 'data-home-service': 'booth' };
  if (!read.ok) return <HomeServiceCard name={name} brand={brand} icon={icon} dots={[]} door={door} failed marker={marker} />;

  const jar = await cookies();
  const templates = resolveBoothTemplates({ saved: jar.get(patiktokBoothCookieName(eventId))?.value ?? null });
  const left = Math.max(0, read.cap - read.today);
  const over = read.today >= read.cap;
  return (
    <HomeServiceCard
      name={name}
      brand={brand}
      icon={icon}
      dots={[{ mood: 'ok', words: owned ? 'Patiktok is yours' : 'Free to record', marker: 'booth' }]}
      status={{
        strong: `${formatCount(read.today)} ${read.today === 1 ? 'reel' : 'reels'} today`,
        tail: over ? ' · past the soft cap' : ` · ${formatCount(left)} left before the soft cap`,
      }}
      statusMood={over ? 'low' : 'ok'}
      meter={{ pct: Math.min(100, Math.round((read.today / read.cap) * 100)), label: 'Reels today' }}
      actions={<ActionButton tone="brand" icon={<Video aria-hidden="true" strokeWidth={1.9} />} label="Open booth" href={`${page}/booth`} />}
      settings={
        <>
          <BoothTemplatePick
            eventId={eventId}
            primary={templates.primary.slug}
            backup={templates.backup.slug}
            templates={PATIKTOK_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name }))}
          />
          <HomeCardRow label={`Your renders · ${formatCount(read.renders)}`} marker="renders" control={opens(page, 'See', 'renders')} />
          {owned && read.tiktok !== null ? (
            <HomeCardRow
              label="TikTok"
              hint={
                read.tiktok === 'unread'
                  ? 'Couldn’t load your TikTok account.'
                  : read.tiktok === 'none'
                    ? 'Auto-post finished reels to your own TikTok.'
                    : `TikTok connected${read.tiktok.handle ? `: @${read.tiktok.handle}` : ''}`
              }
              marker="tiktok"
              control={
                read.tiktok === 'none' ? (
                  <a href={`/api/tiktok/auth/start?event_id=${eventId}`} className="text-[13px] font-medium text-terracotta" data-home-booth-door="tiktok">
                    Connect TikTok
                  </a>
                ) : read.tiktok === 'unread' ? null : (
                  opens(page, 'Manage', 'tiktok')
                )
              }
            />
          ) : null}
          {owned ? null : <HomeCardRow label="Save & share" marker="save-share" control={opens(page, 'See', 'save-share')} />}
        </>
      }
      door={door}
      marker={marker}
    />
  );
}
