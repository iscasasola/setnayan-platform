/**
 * articles-names — the only name a reader is ever shown in Articles.
 *
 * "Guest · 3F" for a couple or any other account; "Supplier · 7K" for anyone who
 * owns a shop or sits on a shop's team (owner ruling 2, 16 Nov). One code per
 * person per topic (`article_topic_codes`). Pure — safe anywhere.
 */
export type ArticleAuthorKind = 'guest' | 'supplier';

export function articleLabel(kind: ArticleAuthorKind, code: string): string {
  return `${kind === 'supplier' ? 'Supplier' : 'Guest'} · ${code}`;
}
