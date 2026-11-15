import { splitArticleText } from '@/lib/articles-links';

/**
 * The words of a post, with every setnayan.com link drawn as a small card
 * ("A setnayan.com link becomes a card" — prototype screen 3). Nothing outside
 * setnayan.com is ever an anchor here: `splitArticleText` only yields links whose
 * host is setnayan.com, and builds the href itself on https://www.setnayan.com.
 */
export function ArticleText({ text, muted = false }: { text: string; muted?: boolean }) {
  const parts = splitArticleText(text);
  return (
    <div className={`whitespace-pre-line break-words text-[15px] leading-relaxed ${muted ? 'italic text-ink/60' : 'text-ink'}`}>
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.text}</span>
        ) : (
          <a
            key={i}
            href={p.href}
            data-article-link-card=""
            className="my-2 flex min-h-11 flex-col justify-center rounded-xl border border-ink/15 bg-ink/[0.03] px-3 py-2 not-italic no-underline hover:bg-ink/[0.06]"
          >
            <span className="text-sm font-medium text-ink">{p.path === '/' ? 'Setnayan' : p.path}</span>
            <span className="text-xs text-ink/65">setnayan.com</span>
          </a>
        ),
      )}
    </div>
  );
}
