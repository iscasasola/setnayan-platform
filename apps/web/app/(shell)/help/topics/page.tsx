import { getCurrentUser } from '@/lib/auth';
import { HELP_TOPICS, helpTopicsFor } from '@/lib/help';
import { isStoreShellRequest } from '@/lib/request-platform';
import { topicsForCoverage } from '@/lib/help-ask-core';
import { helpPlace, inHelp } from '@/lib/help/help-place';
import { routes } from '@/lib/routes';
import { BackButton } from '@/app/_components/back-button';
import { tilesFor } from '@/app/_components/help-ask/help-ask-places';
import { HelpRow, HelpRows } from '@/app/_components/help-ask/help-rows';

export const metadata = {
  title: 'All topics · Help',
  alternates: { canonical: routes.help.topics() },
};

type Props = { searchParams: Promise<{ for?: string; role?: string; refer?: string }> };

/**
 * 📚 ALL TOPICS — Help's "All 14" (the Guide & Help drawing, owner "Approved" 21 Nov 2026: *"14 topic tiles become ...
 * three rows, with All 14"*). Every topic of THIS help (the active account, `lib/help/help-place.ts`), as rows in one
 * white card, in the tile order of 13 Nov; a row opens its topic page. The names are the 13 Nov tile words; no topic
 * line under a name (the drawing: "The name is enough").
 */
export default async function HelpTopicsPage({ searchParams }: Props) {
  const [search, user, storeShell] = await Promise.all([searchParams, getCurrentUser(), isStoreShellRequest()]);
  const place = helpPlace(search, Boolean(user && !user.is_anonymous));
  const topics = tilesFor(place.account, topicsForCoverage(helpTopicsFor(HELP_TOPICS, storeShell), place.coverage));

  return (
    <main className="min-h-dvh bg-page pb-24 lg:pb-0">
      <div className="mx-auto w-full max-w-xl px-4 pb-12 pt-3 sm:px-6 sm:pt-6" data-help-topics="" data-help-coverage={place.coverage}>
        <BackButton route="/help/topics" variant="chat" className="-ml-2" />
        <h1 className="mt-2 text-sn-title text-ink">Topics</h1>
        <p className="mt-1 text-sn-lg text-ink/65">{topics.length === 1 ? '1 topic' : `${topics.length} topics`}</p>
        <div className="mt-6">
          <HelpRows data="all-topics">
            {topics.map((t) => (
              <HelpRow key={t.key} title={t.name} href={inHelp(routes.help.topic(t.key), place)} data={t.key} />
            ))}
          </HelpRows>
        </div>
      </div>
    </main>
  );
}
