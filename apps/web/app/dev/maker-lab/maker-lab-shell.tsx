'use client';

import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { MakerShell } from '@/app/dashboard/[eventId]/launch/_components/maker-shell';
import { MakerRsvpStage } from '@/app/dashboard/[eventId]/launch/_components/maker-rsvp-stage';
import { MakerWork, type MakerScene } from '@/app/dashboard/[eventId]/website/editor/_components/editor-shell';
import type { MakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import { HubDraftToolbar } from '@/app/dashboard/[eventId]/website/_components/hub-draft-bar';
import type { HubDraftActionResult, HubDraftSummary } from '@/lib/hub-draft';
import { sanitizeRsvpAskConfig } from '@/lib/rsvp-ask';
import { MainBackgroundPanel, type MovingBackgroundOption } from '@/app/dashboard/[eventId]/website/editor/_components/main-background-panel';
import { ColorsPanel } from '@/app/dashboard/[eventId]/website/editor/_components/pro-panels';
import { ButtonsLookRow } from '@/app/dashboard/[eventId]/website/editor/_components/buttons-look-row';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { hubButtonPage } from '@/lib/hub-buttons';
import { celebrationColours, celebrationDraftIsPro } from '@/lib/rsvp-celebration';

/**
 * The Maker lab's client half (`page.tsx` says what is real): the real shell,
 * work area, RSVP stage and draft bar, with lab saves — a draft write here is
 * COUNTED by the lab (`window.__labDrafts`) and answers with the Apply bar, so
 * the count beside ✓ moves exactly as a real save moves it; nothing leaves the
 * browser.
 */
let labChanges = 0;
/** 🎉 A Pro celebration drafted in the lab — the bar's ◆ follows it, as the real summary would. */
let labPro = 0;
function labSummary(n: number, pro = 0): HubDraftSummary {
  return { hasChanges: n > 0, changeCount: n, proCount: pro, canUndo: n > 0, changes: [] };
}
async function labDraft(_eventId: string, fd: FormData): Promise<HubDraftActionResult> {
  const w = window as unknown as { __labDrafts?: Array<Record<string, string>> };
  (w.__labDrafts ??= []).push(Object.fromEntries([...fd].filter(([, v]) => typeof v === 'string')) as Record<string, string>);
  /* 🎞 The lab's "draft": a Look › Background pick rides a cookie the lab's
     canvas (`./guest`) reads on its next load — the browser only, no database. */
  try {
    const patch = JSON.parse(String(fd.get('patch') ?? '{}')) as { widgets?: { hero?: { main?: unknown } }; events?: { rsvp_ask_config?: unknown } };
    if (patch.events && 'rsvp_ask_config' in patch.events) labPro = celebrationDraftIsPro(null, patch.events.rsvp_ask_config) ? 1 : 0;
    if (patch.widgets?.hero && 'main' in patch.widgets.hero) {
      document.cookie = `lab_main=${encodeURIComponent(JSON.stringify(patch.widgets.hero.main ?? null))}; path=/; SameSite=Lax`;
    }
  } catch {
    /* not a Background patch */
  }
  labChanges += 1;
  const s = labSummary(labChanges, labPro);
  return { ok: true, intent: 'save', applied: 0, held: [], bar: { free: s, owned: s, proEffects: [], priceLabel: null } } as HubDraftActionResult;
}
const noop = async () => {};
const formNoop = async () => {};

export function MakerLabShell({
  eventId,
  scenes,
  navigator,
  details,
  loops = [],
  openDetails = false,
}: {
  eventId: string;
  scenes: MakerScene[];
  navigator: MakerNavigatorData;
  details: ReactNode;
  loops?: readonly MovingBackgroundOption[];
  openDetails?: boolean;
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
      ownsPro: false,
      celebrationColours: celebrationColours(['#5B1A22', '#6B7A3A', '#E0A52B', '#8E2E3C', '#F2C8C2']),
    }),
    [eventId],
  );
  /* 🎨 Look's rows — the REAL controls (Background · Font · Colours · Buttons), on
     maria-and-jose's shape: Classic, no hero photo, nothing chosen yet. A
     Background pick drafts into the lab (`window.__labDrafts`), never a database. */
  const house = INVITE_THEMES.house;
  const formDraft = (fd: FormData) => void labDraft(eventId, fd);
  const lookRows = {
    'main-background': {
      label: 'Behind every scene',
      node: (
        <MainBackgroundPanel
          eventId={eventId}
          themeId="house"
          colours={house.palette}
          current={null}
          hero={{ photoRef: null, photoUrl: null, hasClip: false, liveRef: null }}
          overrideStillUrl={null}
          drafted={false}
          ownsPro={false}
          loops={loops}
          draftAction={labDraft as never}
        />
      ),
    },
    font: {
      label: 'Font',
      node: <ColorsPanel action={formDraft} eventId={eventId} rowKey="font" part="font" bgColor={null} buttonColor={null} artDirection={null} fontKey={null} proMark="try" />,
    },
    colors: {
      label: 'Colours',
      node: (
        <ColorsPanel action={formDraft} eventId={eventId} rowKey="colors" part="colours" bgColor={null} buttonColor={null} artDirection={null} fontKey={null} magicTraveller={null} proMark="try" />
      ),
    },
    buttons: {
      label: 'Buttons',
      node: <ButtonsLookRow eventId={eventId} theme={house} page={hubButtonPage(house, null)} style={null} colour={null} palette={[house.palette.accent, house.palette.ink]} />,
    },
  };
  return (
    <MakerShell
      eventId={eventId}
      /* The lab's own guest page stands in for /maria-and-jose (Preview's "Preview the stage"). */
      slug="dev/maker-lab/guest"
      liveStage="rsvp"
      initialStage="rsvp"
      /* `?tool=details` / `?guide=…` open on Details (the guided flow), as the real Maker does. */
      initialSelection={openDetails ? { kind: 'tool', key: 'details' } : null}
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
        rows={lookRows}
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
