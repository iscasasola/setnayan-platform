import Link from 'next/link';
import type { HelpTopic } from '@/lib/help';
import { guideSteps, guidesFor, stepsLine } from '@/lib/help/guides';
import { inHelp, type HelpPlace } from '@/lib/help/help-place';
import { routes } from '@/lib/routes';
import { tilesFor } from './help-ask-places';
import { GuideRow, HelpRow, HelpRows, HelpSection } from './help-rows';

/** How many guides "Start here" lists and how many topics Help shows before "All N" (the drawing: three and three). */
const START_HERE = 3;
const TOPIC_ROWS = 3;

/**
 * 📘 HELP, BEFORE ANYTHING IS ASKED — the Guide & Help drawing, screen 1 (owner "Approved" 21 Nov 2026): START HERE,
 * the first three guides of this help (`lib/help/guides.ts`; a help with none draws no section), then TOPICS, three
 * rows and All N (`/help/topics`). Server-drawn; /help and the dev lab draw the same part.
 */
export function HelpStart({ place, topics: covered }: { place: HelpPlace; topics: ReadonlyArray<HelpTopic> }) {
  const startHere = guidesFor(place.coverage).slice(0, START_HERE);
  const topics = tilesFor(place.account, covered);
  return (
    <>
      {startHere.length > 0 ? (
        <HelpSection title="Start here" data="start-here">
          <HelpRows data="guides">
            {startHere.map((g) => (
              <GuideRow key={g.key} title={g.title} steps={stepsLine(guideSteps(g).length)} href={inHelp(routes.help.guide(g.key), place)} data={g.key} />
            ))}
          </HelpRows>
        </HelpSection>
      ) : null}

      <HelpSection
        title="Topics"
        data="topics"
        more={
          topics.length > TOPIC_ROWS ? (
            <Link href={inHelp(routes.help.topics(), place)} className="inline-flex min-h-11 items-center text-sn-base font-semibold text-terracotta-700" data-help-all-topics="">
              All {topics.length}
            </Link>
          ) : undefined
        }
      >
        <HelpRows data="topics">
          {topics.slice(0, TOPIC_ROWS).map((t) => (
            <HelpRow key={t.key} title={t.name} href={inHelp(routes.help.topic(t.key), place)} data={t.key} />
          ))}
        </HelpRows>
      </HelpSection>
    </>
  );
}
