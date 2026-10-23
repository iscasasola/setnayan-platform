import { Gem } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { readHomeHubCard } from '@/lib/home-hub-card.server';
import { whoCanViewLabel } from '@/lib/event-visibility';
import { PUBLIC_STAGE_LABELS } from '@/lib/public-site-stage-labels';
import { hubProLine, type PaidRow } from '@/lib/home-first-screen';
import { siteUrl } from '@/lib/social/urls';
import { ProfileShareButton } from '@/app/_components/profile-share-button';
import { QrActions } from '@/app/_components/qr-actions';
import { HubDraftDock } from '../../website/_components/hub-draft-dock';
import { HomeServiceCard } from '../home-service-card';
import { HubPartsSwitches } from './hub-parts-switches';

/**
 * 💎 THE EVENT HUB CARD (owner 2026-10-23, approved `prototypes/home_service_widgets_2026-10-23.html` frames 2–4, with
 * his answers: Event Hub Pro folded in · no visits line · right after Papic).
 *
 *   QUICK VIEW   who can view + the link (the Maker's words) · the page guests see now · the ◆ line (Pro is a state of the
 *                Hub, `hubProLine`) · Share link · QR.
 *   OPEN         the parts of the page, a switch each, written into the Maker's DRAFT (`HubPartsSwitches`) · the shipped
 *                Apply bar (`HubDraftDock` — the same Undo · ✓ the Maker and Event Details carry; a ◆ part tried free is
 *                held and asked for there, never priced on Home) · "Design in the Maker ›".
 *
 * There is no visits line: nothing counts visits (owner: leave it out until something does).
 */
export async function HomeHubCard({ eventId, name, pro }: { eventId: string; name: string; pro: PaidRow | null }) {
  const supabase = await createClient();
  const read = await readHomeHubCard(supabase, eventId).catch(() => ({ ok: false }) as const);
  const door = { label: 'Design in the Maker', href: `/dashboard/${eventId}/launch` };
  const icon = <Gem aria-hidden strokeWidth={1.9} />;
  const marker = { 'data-home-service': 'hub' };
  if (!read.ok) return <HomeServiceCard name={name} icon={icon} dots={[]} door={door} failed marker={marker} />;

  const origin = siteUrl().replace(/\/$/, '');
  const url = read.path ? `${origin}${read.path}` : null;
  const shownAt = read.path ? `${origin.replace(/^https?:\/\//, '')}${read.path}` : 'No link yet';
  const open = read.visibility === 'public' || read.visibility === 'unlisted';

  return (
    <HomeServiceCard
      name={name}
      icon={icon}
      dots={[
        { mood: open ? 'ok' : 'plain', words: `${whoCanViewLabel(read.visibility)} · ${shownAt}`, marker: 'visibility' },
        { mood: read.stage ? 'ok' : 'plain', words: `Guests see now · ${read.stage ? PUBLIC_STAGE_LABELS[read.stage] : '—'}`, marker: 'stage' },
      ]}
      status={{ lead: hubProLine(pro, read.proParts) }}
      actions={
        url && read.slug ? (
          <>
            <ProfileShareButton url={url} title={name} label="Share link" ariaLabel="Share your Event Hub" />
            <QrActions
              url={url}
              hideCopy
              download={{ href: `/api/website/qr/${encodeURIComponent(read.slug)}`, filename: 'setnayan-event-qr.png', label: 'QR' }}
            />
          </>
        ) : null
      }
      settings={
        <>
          {read.draftUnread ? (
            <p role="status" className="py-3 text-[13px] text-ink/65" data-home-hub-draft-unread="">
              Your waiting changes couldn’t load — these switches show your live page.
            </p>
          ) : null}
          {read.table ? (
            <HubPartsSwitches eventId={eventId} table={read.table} now={read.stage} />
          ) : (
            <p role="status" className="py-3 text-[13px] text-ink/65" data-home-hub-parts-unread="">
              The parts of your page couldn’t load. Open the Maker to change them.
            </p>
          )}
          <div className="flex items-center justify-end gap-1.5 py-3" data-home-hub-apply="">
            <HubDraftDock eventId={eventId} />
          </div>
        </>
      }
      door={door}
      marker={marker}
      tour="home-hub-card"
    />
  );
}
