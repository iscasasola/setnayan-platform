/**
 * ServiceTags — the small filter/browse chips shown under a service's name on
 * the Suite (rows, vignette cards, and search results). Pure presentational,
 * server-safe; the tags themselves live on the catalog entry (`AddOnEntry.tags`)
 * and the Suite search box indexes the same list.
 */
export function ServiceTags({
  tags,
  className,
}: {
  tags?: readonly string[];
  className?: string;
}) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className={`flex flex-wrap gap-1 ${className ?? ''}`}>
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-full bg-ink/[0.05] px-2 py-0.5 text-[11px] font-medium leading-none text-ink/55"
        >
          {t}
        </span>
      ))}
    </span>
  );
}
