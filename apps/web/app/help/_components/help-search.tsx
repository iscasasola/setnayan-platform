'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Search } from 'lucide-react';

type Article = { slug: string; title: string; body: string };
type Topic = { key: string; label: string; articles: ReadonlyArray<Article> };

/**
 * Client-side instant search for the Help Center (iteration 0029 promised
 * full-text search; the page shipped without it — the audit's single biggest
 * discoverability gap). Pure in-memory filter over the already-role-filtered
 * corpus the server passes in; no fetch, no index, no new dependency.
 *
 * Empty box → the same topic-grouped list as before, with `id` anchors intact
 * so the sidebar nav + `/help#slug` deep links keep working. Typing → a flat,
 * in-context result list (each hit shows its topic). The server-rendered
 * FAQPage JSON-LD is built from the full corpus and is unaffected by this.
 */
export function HelpSearch({ topics }: { topics: ReadonlyArray<Topic> }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const flat = useMemo(
    () =>
      topics.flatMap((t) =>
        t.articles.map((a) => ({ ...a, topicLabel: t.label })),
      ),
    [topics],
  );

  const matches = useMemo(() => {
    if (!query) return [];
    return flat.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.body.toLowerCase().includes(query) ||
        a.topicLabel.toLowerCase().includes(query),
    );
  }, [flat, query]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45"
          strokeWidth={1.75}
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help — e.g. “RSVP”, “refund”, “QR code”"
          aria-label="Search help articles"
          className="input-field w-full pl-9"
        />
      </div>

      {query ? (
        matches.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-ink/55">
              {matches.length} result{matches.length === 1 ? '' : 's'} for “{q.trim()}”
            </p>
            <ul className="space-y-3">
              {matches.map((a) => (
                <li key={a.slug} className="rounded-xl border border-ink/10 bg-cream p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                    {a.topicLabel}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-ink">
                    <Link
                      href={`/help/${a.slug}`}
                      className="underline-offset-4 hover:text-terracotta hover:underline"
                    >
                      {a.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-ink/70">{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-xl border border-ink/10 bg-cream p-6 text-sm text-ink/65">
            No matches for “{q.trim()}”. Try different words, or{' '}
            <a
              href="#contact"
              className="font-medium text-terracotta underline underline-offset-2"
            >
              message the team
            </a>{' '}
            below.
          </p>
        )
      ) : (
        <div className="space-y-10">
          {topics.map((topic) => (
            <section key={topic.key} id={topic.key} className="scroll-mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <HelpCircle aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
                <h2 className="text-xl font-semibold tracking-tight">{topic.label}</h2>
              </div>
              <ul className="space-y-3">
                {topic.articles.map((a) => (
                  <li
                    key={a.slug}
                    id={a.slug}
                    className="scroll-mt-6 rounded-xl border border-ink/10 bg-cream p-4"
                  >
                    <h3 className="text-base font-semibold text-ink">
                      <Link
                        href={`/help/${a.slug}`}
                        className="underline-offset-4 hover:text-terracotta hover:underline"
                      >
                        {a.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm text-ink/70">{a.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
