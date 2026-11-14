import Link from 'next/link';
import { Search, X } from 'lucide-react';

/** "Ask a question" — a plain GET form: works with no script, the words ride in this page's `?q=`. */
export function AskBox({
  q,
  action,
  keep = {},
  clearHref,
}: {
  q: string;
  action: string;
  keep?: Record<string, string | undefined>;
  clearHref: string;
}) {
  return (
    <form role="search" action={action} method="get" className="relative" data-help-ask="" id="ask">
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
