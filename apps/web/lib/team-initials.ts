/** A team member's two letters ("Bea Santos" → "BS") — the Team card's own rule, in a plain module so a server page
 *  can draw the same circle (a `use client` module's function is a reference, not a function, on the server). */
export function initialsOf(name: string): string {
  const parts = name.replace(/@.*$/, '').split(/[\s._-]+/).filter(Boolean);
  const two = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? ''));
  return two.toUpperCase() || '·';
}
