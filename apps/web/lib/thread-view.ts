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
/**
 * 💬 SIX SINCE 19 NOV 2026 (owner: the client page is ONE chat that holds everything; drawing S9ScH2Ps v3, screen 5): the
 * switch moved INTO the text box as chips — All · Decisions · Forms · Money · Dates · Files — and one picked kind
 * filters the stream to that kind's cards and lines. `forms`, `money` and `dates` are the three new kinds. A chat that
 * does not draw the chips (the routed thread page, the host's side until its own build) reads a new kind as the chat
 * (`legacyThreadView`), so an old `?view=decisions|files` link means exactly what it always did there.
 */
export type ThreadView = 'all' | 'decisions' | 'files' | 'forms' | 'money' | 'dates' | TalkView;

/**
 * 💬 TWO CHIPS THAT ARE NOT A KIND OF CARD (Unichat part D, 20 Nov 2026; approved drawing `UNICHAT-LIVE-2026-11-19.html`):
 * **Chat** shows only the messages people typed (no cards), **Private** only the private lines the reader may see. They
 * are a way of LOOKING, held for the visit — never an address: `parseThreadView` does not read them and
 * `withThreadView` does not write them, so a reload or a shared link opens the whole chat.
 */
export const TALK_VIEWS = ['chat', 'private'] as const;
export type TalkView = (typeof TALK_VIEWS)[number];

export function isTalkView(v: unknown): v is TalkView {
  return (TALK_VIEWS as readonly unknown[]).includes(v);
}

/** The kinds a chip filters to, in the chips' order (All is the absence of one). */
export const THREAD_KINDS = ['decisions', 'forms', 'money', 'dates', 'files'] as const;
export type ThreadKind = (typeof THREAD_KINDS)[number];

/** Anything that is not a view we know is the chat. Never throws. */
export function parseThreadView(v: unknown): ThreadView {
  const raw = Array.isArray(v) ? v[0] : v;
  return (THREAD_KINDS as readonly unknown[]).includes(raw) ? (raw as ThreadView) : 'all';
}

/** The view a chat WITHOUT the chips shows for a `?view=`: its three shipped thirds; a chip-only kind is the chat. */
export function legacyThreadView(v: ThreadView): 'all' | 'decisions' | 'files' {
  return v === 'decisions' || v === 'files' ? v : 'all';
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

  if (view === 'all' || isTalkView(view)) params.delete('view');
  else params.set('view', view);

  const q = params.toString();
  return `${pathname}${q ? `?${q}` : ''}${hash}`;
}
