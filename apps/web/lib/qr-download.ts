/**
 * The href behind a "Download QR" anchor when the QR was rendered server-side
 * as an inline SVG string. A data: URI keeps the download a plain anchor — no
 * JavaScript, no round trip — the same shape the vendor Shortlist QR has used.
 */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** `qr-maria-santos.svg` — a filename a person can find in Downloads. */
export function qrFileName(name: string, ext: 'svg' | 'png' = 'svg'): string {
  const slug = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'code';
  return `qr-${slug}.${ext}`;
}
