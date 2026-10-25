/**
 * /dashboard/search — what the signed-in search answers with, INSIDE the shell.
 *
 * Owner, 22 Oct 2026, iPhone, signed in, after searching "seda" (Seda Vertis
 * North, a supplier he booked on his own event): *"I tried to search for seda
 * and brought me here away from our shell"*. "Here" was `/explore?q=seda` —
 * the old top bar with "+ Create event", a second search box, an
 * "Off-season savings" pill, "No suppliers match exactly… Clear all filters",
 * and no account bar. He had been handed out of the app twice: the palette's
 * row opened the public front door (`/?q=`), and its results handed the words
 * on to the marketplace.
 *
 * 🔑 THIS PAGE IS IN THE `(account)` GROUP, so its layout draws the shell he
 * was standing in — the Setnayan mark, the bell, the account, and the account
 * bar at the bottom — and it renders the SAME results view the front door does
 * (`FrontDoorResults`), in its `shell` form:
 *   · your own things first — your events and spaces, and now the SUPPLIERS ON
 *     YOUR EVENTS (booked or hand-added, published or not), tagged "On your
 *     event" (`lib/own-supplier-items.ts`);
 *   · the shops we publish (`searchLiveShops`, one publish gate);
 *   · our stories and guides;
 *   · no row out to `/explore`. The in-shell way to look for a NEW supplier is
 *     the Suppliers page of the event you host, drawn on the web only — the
 *     store app shows no marketplace.
 *
 * It is the Discover-wide answer ("the search searches the place you are
 * standing in", DECISION_LOG 2026-09-23 — Discover is everything you may
 * reach), which is why the palette's narrowed boxes step OUT to it.
 */
import { redirect } from 'next/navigation';
import { PageMasthead } from '@/app/_components/page-masthead';
import { FrontDoorResults } from '@/app/_components/frontdoor/front-door-results';
import { loadFrontDoorArticles } from '@/app/_components/frontdoor/data';
import { resolveCommandItems } from '@/app/_components/frontdoor/command-data';
import { resolveShellSearchContext } from '@/app/_components/frontdoor/shell-search-context';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { SHELL_SEARCH_PATH } from '@/lib/shell-search';

export const metadata = { title: 'Search' };

export default async function ShellSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const query = (raw ?? '').trim();

  const user = await getCurrentUser();
  if (!user) {
    redirect(loginRedirectPath(query ? `${SHELL_SEARCH_PATH}?q=${encodeURIComponent(query)}` : SHELL_SEARCH_PATH));
  }

  /*
    🚪 NO WORDS, NO PAGE OF ITS OWN — BACK TO DISCOVER (owner 2026-10-24, a screenshot: Clear landed on a page that
    said only "Type what you're looking for in the search at the top." — there was no search at the top, and none at
    the bottom either, so he was stuck). Discover holds the search box and answers in place; an empty `q` here (Clear,
    a bookmark, Back) goes there. In the store app `/` is not a page, and the middleware takes it on to the board —
    a page with its own search, never a blank one. Guarded by `discover-search-stays-on-page.test.ts`.
  */
  if (!query) redirect('/');

  const commandItems = await resolveCommandItems();
  const { people, findSuppliers } = await resolveShellSearchContext(query, user.id, commandItems);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8" data-shell-search="">
      <PageMasthead title="Search" />
      <FrontDoorResults
        query={query}
        data={{ articles: loadFrontDoorArticles() }}
        commandItems={commandItems}
        place="shell"
        findSuppliers={findSuppliers}
        people={people}
      />
    </div>
  );
}
