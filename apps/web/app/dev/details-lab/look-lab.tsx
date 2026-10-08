'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { MakerContext, type MakerLookPages, type MakerState } from '@/app/dashboard/[eventId]/launch/_components/maker-context';
import type { DetailsItemKey } from '@/lib/maker-details-items';
import { DetailsPieceButton } from '@/app/dashboard/[eventId]/launch/_components/details-go';
import { FontPick } from '@/app/dashboard/[eventId]/website/editor/_components/font-pick';
import type { HubFontKey } from '@/lib/hub-fonts';
import { ColorsPanel } from '@/app/dashboard/[eventId]/website/editor/_components/pro-panels';

/**
 * The lab's stand-in for `updateSiteColors`: what a Look form drafted, kept on
 * the window (`__labDrafts`) so the as-you-go drafting can be watched — no
 * database, no Save button.
 */
function labDraft(fd: FormData) {
  const w = window as unknown as { __labDrafts?: Array<Record<string, string>> };
  const sent = Object.fromEntries([...fd].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  (w.__labDrafts ??= []).push(sent);
  console.info('[lab] drafted', sent);
}

/**
 * `/dev/details-lab?look=1` — the Look items (Details part 3) on fixtures. The
 * Logo, Hero and Reveal pages are built by the Maker's work area, which needs a
 * signed-in couple and the database; here each is a labelled stand-in of the
 * same size, so the three-column LAYOUT (a page that fills the body, a page
 * that carries its own tools) can be checked at 375 / 390 and on a desk.
 */
function Stand({ name, tall = false }: { name: string; tall?: boolean }) {
  return (
    <div
      data-lab-stand={name}
      className={`flex flex-1 items-center justify-center bg-white/70 text-sm text-ink/60 ${tall ? 'min-h-[900px]' : 'min-h-0'}`}
    >
      {name}
    </div>
  );
}

function LabFontPick() {
  const [font, setFont] = useState<HubFontKey | null>(null);
  return (
    <FontPick
      eventId="lab"
      label="Font"
      dataAttr="data-element-font"
      value={font}
      lead="Event Hub font"
      onPick={setFont}
      className="min-h-11 w-full justify-between border border-ink/15"
    />
  );
}

export function LookLab({ children }: { children: ReactNode }) {
  const [detailsItem, setDetailsItem] = useState<DetailsItemKey | null>(null);
  const noop = () => {};
  const lookPages = useMemo<MakerLookPages>(
    () => ({
      logo: (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <Stand name="Logo studio — its canvas" />
          <div className="shrink-0 border-t border-ink/10 lg:w-[340px] lg:border-l lg:border-t-0">
            <Stand name="Logo studio — its own panel" />
          </div>
        </div>
      ),
      hero: <Stand name="Hero — Designs 1–4, parts, photo, Main background" tall />,
      reveal: <Stand name="Reveal — play it, fine-tune, where it plays" />,
      revealOptions: (
        <>
          {['No reveal', 'Four flaps', 'Two doors', 'The veil'].map((o, i) => (
            <DetailsPieceButton key={o} on={i === 0} onPick={() => {}} data={`lab:${o}`}>
              {o}
            </DetailsPieceButton>
          ))}
        </>
      ),
      heroParts: null,
      /* 🎨 Look's Font and Colours — the REAL `ColorsPanel` parts, drafting into the lab's stand-in. */
      look: {
        background: null,
        font: <ColorsPanel action={labDraft} eventId="lab" rowKey="font" part="font" bgColor={null} buttonColor={null} artDirection={null} />,
        colours: (
          <ColorsPanel action={labDraft} eventId="lab" rowKey="colors" part="art" bgColor={null} buttonColor={null} artDirection={null} magicTraveller={null} />
        ),
        palette: null,
        buttons: null,
        /* 🌈 The page fill — Look › Background's since 2026-10-08. */
        page: <ColorsPanel action={labDraft} eventId="lab" rowKey="page-colour" part="page" bgColor={null} buttonColor={null} artDirection={null} />,
      },
      /* Classic's faces + a couple's part font, as the page would register them. */
      fontsInUse: ['cormorant', 'cormorantsc', 'playfair'],
      revealStages: ['save_the_date', 'rsvp'],
      publicLandingUrl: '/dev/hero-lab',
    }),
    [],
  );
  const value = useMemo<MakerState>(
    () => ({
      eventId: 'lab',
      stage: 'rsvp',
      setStage: noop,
      device: 'phone',
      navOpen: true,
      selection: { kind: 'tool', key: 'details' },
      select: noop,
      moreOpen: false,
      renderStamp: 'lab',
      storeShell: false,
      seeAs: null,
      addScene: null,
      setAddScene: noop,
      detailsItem,
      setDetailsItem,
      lookPages,
      setLookPages: noop,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `noop` is a fresh arrow each render; it does nothing
    [detailsItem, lookPages],
  );
  return (
    <MakerContext.Provider value={value}>
      {/* 🔤 The REAL font dropdown (`FontPick`) above the page, visible at 375 /
          390 and on a desk, so its shelves, sticky headings and "In use" can be
          checked — "In use" here is the fixture above, not a page. */}
      <div className="px-4 py-3" data-lab-font-pick="">
        <LabFontPick />
      </div>
      {children}
    </MakerContext.Provider>
  );
}
