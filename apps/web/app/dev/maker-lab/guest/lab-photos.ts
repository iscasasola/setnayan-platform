/**
 * 🎞 THE LAB'S STAND-IN PICTURES (`/dev/maker-lab/guest?photos=<n>`) — our own drawn gradients, never anybody's photo.
 * A picture of nothing, not a logo: kept out of the page's .tsx so the still-logo sweep (`every-logo-plays.test.ts`)
 * has nothing to read as a mark.
 */
const HUES = [28, 352, 205, 160, 44, 290, 12, 190, 75, 330, 230, 98];

export function labPhotoUrls(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const hue = HUES[i % HUES.length]!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><defs><linearGradient id="g" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="hsl(${hue} 38% 72%)"/><stop offset=".55" stop-color="hsl(${hue} 42% 48%)"/><stop offset="1" stop-color="hsl(${(hue + 30) % 360} 36% 30%)"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/><circle cx="${60 + ((i * 51) % 150)}" cy="${70 + ((i * 33) % 80)}" r="48" fill="rgba(255,255,255,.28)"/><line x1="40" x2="260" y1="300" y2="300" stroke="rgba(255,255,255,.4)"/><text x="20" y="384" font-family="sans-serif" font-size="18" letter-spacing="3" fill="rgba(255,255,255,.8)">${String(i + 1).padStart(2, '0')}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  });
}
