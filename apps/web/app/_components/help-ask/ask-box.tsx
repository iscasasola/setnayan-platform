import Link from 'next/link';
import { Search, X } from 'lucide-react';

/**
 * "Ask a question" — works with no script, and the words land in this page's `?q=`.
 *
 * Without `ask` it is a plain GET form (the words ride straight into `?q=`). With `ask` (the helps that keep "No answer
 * yet") it POSTs to that help's existing action with `intent=ask`: the action writes the one `help_asks` row and
 * redirects to the same `?q=`. 🔒 A row is written only when a PERSON presses ask — never on a page render, so a
 * crawler, a prefetch or a shared `?q=` link writes nothing (guard: lib/help-asks-are-written-only-when-asked.test.ts).
 */
export function AskBox({
  q,
  action,
  keep = {},
  clearHref,
  ask,
}: {
  q: string;
  action: string;
  keep?: Record<string, string | undefined>;
  clearHref: string;
  /** The help's own action (it reads `intent=ask`) and which account's help this is. */
  ask?: { action: (formData: FormData) => Promise<void>; coverage: string };
}) {
  return (
    <form
      role="search"
      {...(ask ? { action: ask.action } : { action, method: 'get' })}
      className="relative"
      data-help-ask=""
      id="ask"
    >
      {ask ? <input type="hidden" name="intent" value="ask" /> : null}
      {ask ? <input type="hidden" name="coverage" value={ask.coverage} /> : null}
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink/45" strokeWidth={1.75} />
      <input
        type="search"
        name="q"
        defaultValue={q}
        enterKeyHint="search"
        autoComplete="off"
        maxLength={120}
        placeholder="Ask a question"
        aria-label="Ask a question"
        className="input-field h-14 w-full rounded-2xl pl-12 pr-12 text-base"
      />
      {q ? (
        <Link
          href={clearHref}
          aria-label="Clear"
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink/55 hover:text-ink"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </Link>
      ) : null}
    </form>
  );
}
