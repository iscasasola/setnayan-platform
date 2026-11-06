/**
 * 🖼 A PHOTO DRAWN WHOLE inside a fixed place (owner 2026-10-17, on a Love Story photo that cut the man off at its edge:
 * *"there might be a better way to present instead if it looking cropped"*): centred at its own shape, as large as the
 * place allows, never cropped — with the Glimpse card's corners and soft lift on the photo itself. The place is
 * reserved by its box, so the words below never move while the photo loads.
 *
 * A plain module (no "use client"): the Love Story's server-drawn Chapters and the client Glimpse rail read the SAME
 * string — a constant imported from a client module into a server component would arrive as a reference, not text.
 */
export const WHOLE_PHOTO_CLASS =
  'absolute inset-0 m-auto h-auto max-h-full w-auto max-w-full rounded-card object-contain shadow-[0_6px_16px_rgb(var(--color-ink)/0.14)]';
