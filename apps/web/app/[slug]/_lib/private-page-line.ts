/** "This wedding’s page is private" — one string, never a word and its ’s split over two text nodes (B9, 2026-11-27). */
export function privatePageLine(eventWord: string): string {
  return `This ${eventWord.trim()}’s page is private`;
}
