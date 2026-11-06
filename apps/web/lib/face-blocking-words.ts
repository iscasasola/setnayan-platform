/**
 * The Papic card's read-only Face blocking line (owner ruling 2026-10-24): "N guests blurred" — and when the count
 * could not be read, it says so; it never prints 0 over a read that failed. Pure.
 */
export function faceBlockingWords(count: number | null): string {
  if (count === null) return 'Couldn’t count who asked to be blurred';
  return `${count.toLocaleString('en-PH')} ${count === 1 ? 'guest' : 'guests'} blurred`;
}
