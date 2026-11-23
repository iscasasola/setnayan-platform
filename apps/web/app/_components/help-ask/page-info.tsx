import { HELP_TOPICS, helpTopicsFor } from '@/lib/help';
import { isStoreShellRequest } from '@/lib/request-platform';
import { findGuide, guideSteps, stepsLine } from '@/lib/help/guides';
import { routes } from '@/lib/routes';
import { PageInfoSheet } from './page-info-sheet';

/** How many answers the ⓘ sheet lists (the plan: "Answers for this page (top 3 to 5)"; the drawing draws three). */
const INFO_ANSWERS = 3;

/**
 * ⓘ ON AN APP PAGE — the Guide & Help drawing, screen 6 (owner "Approved" 21 Nov 2026, re-confirmed 22 Nov; corpus
 * `prototypes/guide_help_2026-11-20/index.html`: *"Every page's ⓘ opens this. Show me, Practice, Answers, Guide."*).
 *
 * A SERVER part: it reads the page key's row (`lib/help/guides.ts`) and that page's help topic here, and hands the
 * client sheet only the plain words and links — no tour and no help corpus reaches the browser. In the iPhone app the
 * answers are the app's own (`helpTopicsFor`), as on /help.
 *
 *   Show me        replays THIS page's spotlight tour — drawn only while the page has one mounted (the sheet asks
 *                  `<html data-spotlight-page>`, the attribute `spotlight-mount.tsx` sets), so it is never dead;
 *   Practice       not drawn: the practice-frame engine is paused plumbing (DECISION_LOG 2026-11-21);
 *   Answers        the first three of the page's home topic, each opening in place on its topic page;
 *   Read the full guide   the guide, with this event kept, so its Take me there comes back here.
 */
export async function PageInfo({ pageKey, eventId }: { pageKey: string; eventId: string }) {
  const guide = findGuide(pageKey);
  if (!guide) return null;
  const steps = guideSteps(guide);
  const homeKey = guide.topicKeys[0] ?? '';
  const home = helpTopicsFor(HELP_TOPICS, await isStoreShellRequest()).find((t) => t.key === homeKey);
  const refer = new URLSearchParams({ refer: eventId });
  const answers = (home?.articles ?? []).slice(0, INFO_ANSWERS).map((a) => ({
    slug: a.slug,
    title: a.title,
    href: `${routes.help.topic(homeKey)}?${new URLSearchParams({ refer: eventId, open: a.slug }).toString()}#${a.slug}`,
  }));
  return (
    <PageInfoSheet
      name={guide.pageName}
      tourKey={guide.tourKey}
      answers={answers}
      guide={steps.length > 0 ? { href: `${routes.help.guide(guide.key)}?${refer.toString()}`, steps: stepsLine(steps.length) } : null}
    />
  );
}
