import { headers } from 'next/headers';
import { Radio } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { readHomeLiveCard } from '@/lib/home-live-card.server';
import { liveStudioControlPath } from '@/lib/live-studio-control';
import { formatCount } from '@/lib/format-number';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { CopyButton } from '@/app/_components/copy-button';
import { LiveStudioRecordingsCard } from '@/app/_components/live-studio-recordings-card';
import { cutToMainStage, setEventQrOverlay, setGuestPick, setLowerThird, setMonogramOverlay } from '@/app/panood/control/[eventId]/actions';
import { HomeCardRow, HomeServiceCard } from '../home-service-card';
import { LiveAirButton } from './live-air-button';

/**
 * 📡 THE LIVE STREAM CARD (owner 2026-10-23, approved `prototypes/home_service_widgets_2026-10-23.html` frame 6).
 *
 *   QUICK VIEW   On air / Off air · "N of 12 channels · M cameras connected" · Go live (or End) · Copy watch link.
 *   OPEN         the channels (a tap puts that camera on Channel 1 — `cutToMainStage`) · Guests choose their view ·
 *                Monogram · Lower third · Event QR (the controller's own switches, landing back on Home with
 *                `return_to=home`) · the recordings, once there are some · "Open controller ›".
 *
 * Nothing counts viewers, so no viewer line (the controller's own note); no schedule field exists, so no "starts at".
 */
export async function HomeLiveCard({ eventId, name, brand }: { eventId: string; name: string; brand?: string }) {
  const h = await headers();
  const appUrl = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? 'www.setnayan.com'}`;
  const supabase = await createClient();
  const read = await readHomeLiveCard(supabase, eventId, appUrl).catch(() => ({ ok: false }) as const);
  const door = { label: 'Open controller', href: liveStudioControlPath(eventId) };
  const icon = <Radio aria-hidden strokeWidth={1.9} />;
  const marker = { 'data-home-service': 'live' };
  if (!read.ok) return <HomeServiceCard name={name} brand={brand} icon={icon} dots={[]} door={door} failed marker={marker} />;

  const connected = read.channels.filter((c) => c.live).length;
  const toggle = (action: (fd: FormData) => Promise<void>, on: boolean, label: string, hint: string | null, key: string) => (
    <HomeCardRow
      key={key}
      label={label}
      hint={hint}
      marker={key}
      control={
        <form action={action}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="enabled" value={on ? 'false' : 'true'} />
          <input type="hidden" name="return_to" value="home" />
          <button type="submit" role="switch" aria-checked={on} aria-label={label} className={SWITCH_BUTTON}>
            <SwitchTrack on={on} />
          </button>
        </form>
      }
    />
  );

  return (
    <HomeServiceCard
      name={name}
      brand={brand}
      icon={icon}
      dots={[{ mood: read.onAir ? 'gone' : 'plain', words: read.onAir ? 'On air' : 'Off air', marker: 'air' }]}
      status={{
        strong: `${formatCount(read.channels.length)} of ${formatCount(read.maxChannels)}`,
        tail: ` channels · ${formatCount(connected)} ${connected === 1 ? 'camera' : 'cameras'} connected`,
      }}
      actions={
        <>
          <LiveAirButton eventId={eventId} onAir={read.onAir} source={read.source} />
          {read.watchUrl ? <CopyButton value={read.watchUrl} label="Copy watch link" /> : null}
        </>
      }
      settings={
        <>
          {read.channels.length > 0 ? (
            <div className="flex flex-col gap-2 py-3" data-home-card-row="channels">
              <span className="text-[14px] font-medium">Channels</span>
              <span className="text-[12.5px] text-ink/60">Tap a camera to put it on Channel 1.</span>
              <div className="grid grid-cols-2 gap-2">
                {read.channels.map((c) => (
                  <form key={c.id} action={cutToMainStage}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="zone_id" value={String(c.id)} />
                    <input type="hidden" name="return_to" value="home" />
                    <button
                      type="submit"
                      aria-pressed={c.mainStage}
                      className="sn-press flex w-full flex-col items-start gap-0.5 rounded-xl border border-ink/15 px-3 py-2 text-left aria-pressed:border-sn-accent"
                      data-home-live-channel={c.id}
                    >
                      <span className="text-[13.5px] font-medium">{c.label}</span>
                      <span className="text-[12px] text-ink/60">{c.mainStage ? 'On Channel 1' : c.caption}</span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
          {toggle(setGuestPick, read.guestPick, 'Guests choose their view', read.guestPick ? null : 'Everyone sees your cut', 'guest-pick')}
          {toggle(setMonogramOverlay, read.overlays.monogramEnabled, 'Monogram', null, 'monogram')}
          {toggle(setLowerThird, read.overlays.lowerThirdEnabled, 'Lower third', read.overlays.lowerThirdTitle || null, 'lower-third')}
          {toggle(setEventQrOverlay, read.overlays.eventQrEnabled, 'Event QR', null, 'event-qr')}
          {read.recordings.length > 0 ? (
            <div className="py-3" data-home-card-row="recordings">
              <LiveStudioRecordingsCard recordings={read.recordings} compact />
            </div>
          ) : null}
        </>
      }
      door={door}
      marker={marker}
      tile={{
        big: read.onAir ? 'On air' : 'Off air',
        sm: `${formatCount(connected)} ${connected === 1 ? 'camera' : 'cameras'} connected`,
        action: <LiveAirButton eventId={eventId} onAir={read.onAir} source={read.source} />,
      }}
    />
  );
}
