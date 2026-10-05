'use client';

import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { MakerShell } from '@/app/dashboard/[eventId]/launch/_components/maker-shell';
import { MakerRsvpStage } from '@/app/dashboard/[eventId]/launch/_components/maker-rsvp-stage';
import { MakerWork, type MakerScene } from '@/app/dashboard/[eventId]/website/editor/_components/editor-shell';
import type { MakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import { HubDraftToolbar } from '@/app/dashboard/[eventId]/website/_components/hub-draft-bar';
import type { HubDraftActionResult, HubDraftSummary } from '@/lib/hub-draft';
import { sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';

/**
 * The Maker lab's client half (`page.tsx` says what is real): the real shell,
 * work area, RSVP stage and draft bar, with lab saves — a draft write here is
 * COUNTED by the lab (`window.__labDrafts`) and answers with the Apply bar, so
 * the count beside ✓ moves exactly as a real save moves it; nothing leaves the
 * browser.
 */
let labChanges = 0;
function labSummary(n: number): HubDraftSummary {
  return { hasChanges: n > 0, changeCount: n, proCount: 0, canUndo: n > 0, changes: [] };
}
async function labDraft(_eventId: string, fd: FormData): Promise<HubDraftActionResult> {
  const w = window as unknown as { __labDrafts?: Array<Record<string, string>> };
  (w.__labDrafts ??= []).push(Object.fromEntries([...fd].filter(([, v]) => typeof v === 'string')) as Record<string, string>);
  labChanges += 1;
  const s = labSummary(labChanges);
  return { ok: true, intent: 'save', applied: 0, held: [], bar: { free: s, owned: s, proEffects: [], priceLabel: null } } as HubDraftActionResult;
}
const noop = async () => {};
const formNoop = async () => {};

export function MakerLabShell({
  eventId,
  scenes,
  navigator,
  details,
}: {
  eventId: string;
  scenes: MakerScene[];
  navigator: MakerNavigatorData;
  details: ReactNode;
}) {
  const stand = (name: string) => <div data-lab-stand={name} className="rounded-md bg-white/70 p-3 text-[13px] text-ink/60">{name}</div>;
  const rsvpProps = useMemo<ComponentProps<typeof MakerRsvpStage>>(
    () => ({
      eventId,
      publicLandingUrl: '/dev/maker-lab/guest',
      solemn: false,
      current: sanitizeRsvpAskConfig({}),
      drafted: false,
      replyBy: { date: 'November 12, 2026', isDefault: true },
      replyByOwn: { deadline: null, pricingMode: 'realtime' },
      replyByFallback: 'November 12, 2026',
      frameSrc: (scene) => `/dev/maker-lab/guest?rsvp=${scene}`,
      draftAction: labDraft as never,
      replyByAction: formNoop as never,
    }),
    [eventId],
  );
  return (
    <MakerShell
      eventId={eventId}
      /* The lab's own guest page stands in for /maria-and-jose (Preview's "Preview the stage"). */
      slug="dev/maker-lab/guest"
      liveStage="rsvp"
      initialStage="rsvp"
      storeShell={false}
      tourSlides={[]}
      firstVisit={false}
      completeTourAction={noop}
      renderStamp="lab"
      more={null}
      applySlot={<HubDraftToolbar eventId={eventId} summary={labSummary(0)} storeShell={false} priceLabel={null} proHref={null} />}
      details={{ page: details, controls: null }}
      rsvpStage={<MakerRsvpStage {...rsvpProps} />}
      hasWork
      theHost="the couple"
    >
      <MakerWork
        eventId={eventId}
        publicLandingUrl="/dev/maker-lab/guest"
        scenes={scenes}
        navigator={navigator}
        scenePanels={Object.fromEntries(scenes.map((s) => [s.id, stand(`${s.label} — its settings`)]))}
        rows={{}}
        ownsPro={false}
        toggleAction={formNoop}
        setModeAction={formNoop}
        moveUpAction={formNoop}
        moveDownAction={formNoop}
        proUnlockHref="/dev/maker-lab"
        proPriceLabel={null}
        showProCta={false}
        revealStages={['save_the_date']}
        madeOnce={{ hero: stand('The names & date design'), reveal: stand('The reveal — its controls'), logo: stand('The logo studio') }}
        elementEditing={{
          canvases: {},
          palette: { ink: '#2C2A29', heading: '#2C2A29', accent: '#A9834B', muted: '#8A8580', surface: '#FBF9F5' },
          draftAction: labDraft,
        }}
        sceneFormat={{
          colorChoices: [],
          photoChoices: [],
          videoChoice: null,
          mediaHref: '/dev/maker-lab',
          hubTheme: 'house',
          openBrowse: true,
          hideLocked: false,
          twoPeople: true,
          eventType: 'wedding',
          heroCard: true,
          heroPhoto: false,
          ticketStyle: 'classic',
        }}
      />
    </MakerShell>
  );
}
