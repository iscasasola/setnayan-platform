/**
 * thread-view.ts — which third of a conversation is showing, as a URL fact.
 *
 * All · Decisions · Files used to be local component state, which had two costs
 * the owner felt at once (2026-09-10):
 *
 *   1. **A reply bounced you out.** Every reply action — confirm a meeting,
 *      accept an adjustment — ends in `redirect(return_path)`, which reloads
 *      the page. With the view held only in `useState`, answering the other
 *      side from Decisions landed you back on the full chat, and you had to
 *      find your place again after every single tap.
 *   2. **It could not be pointed at.** "Open the Decisions view of this
 *      thread" was not a link anyone could send.
 *
 * So the view lives in `?view=`. The page reads it on the server, so a
 * Decisions link renders Decisions on first paint with no flash of the chat.
 *
 * ⚖ `all` IS THE ABSENCE OF THE PARAM, not `?view=all`. The plain thread URL
 * every notification, email and bookmark already uses must keep meaning the
 * chat, and one conversation must not have two addresses for the same screen.
 *
 * ⚠ A QUERY, NOT A HASH. A fragment is never sent to the server, so a
 * `#decisions` link would paint the chat first and then jump — and a server
 * action's redirect target would have to carry a fragment the server cannot
 * see. See `lib/return-path.ts` for the one place the query needed care.
 */
export type ThreadView = 'all' | 'decisions' | 'files';

/** Anything that is not a view we know is the chat. Never throws. */
export function parseThreadView(v: unknown): ThreadView {
  const raw = Array.isArray(v) ? v[0] : v;
  return raw === 'decisions' || raw === 'files' ? raw : 'all';
}

/**
 * `path` showing `view`. Any other query the path already carries is kept;
 * `all` removes the param rather than writing `?view=all`.
 */
export function withThreadView(path: string, view: ThreadView): string {
  const hashAt = path.indexOf('#');
  const hash = hashAt === -1 ? '' : path.slice(hashAt);
  const beforeHash = hashAt === -1 ? path : path.slice(0, hashAt);
  const qAt = beforeHash.indexOf('?');
  const pathname = qAt === -1 ? beforeHash : beforeHash.slice(0, qAt);
  const params = new URLSearchParams(qAt === -1 ? '' : beforeHash.slice(qAt + 1));

  if (view === 'all') params.delete('view');
  else params.set('view', view);

  const q = params.toString();
  return `${pathname}${q ? `?${q}` : ''}${hash}`;
}
