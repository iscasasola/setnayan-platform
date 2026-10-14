'use client';

import { Play } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { markSongHeard } from '@/lib/song-heard';

/**
 * ✅ "Hear your song" (owner "approve all", 2026-10-14 — services prototype):
 * opens the song on the Music page and marks it heard on this device
 * (`lib/song-heard.ts`), so the next Home hands its Next card to the next step.
 * One button for Home's card, Home's row and the Music page's band.
 */
export function HearYourSong({
  eventId,
  href,
  main = false,
  tone = 'brand',
  wide = false,
}: {
  eventId: string;
  href: string;
  main?: boolean;
  tone?: ActionTone;
  wide?: boolean;
}) {
  return (
    <ActionButton
      tone={tone}
      main={main}
      icon={Play}
      label="Hear your song"
      href={href}
      className={wide ? 'w-full justify-center' : undefined}
      onClick={() => markSongHeard(eventId)}
      data-testid="hear-your-song"
    />
  );
}
