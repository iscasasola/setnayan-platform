/**
 * person-avatar.tsx — the People page's one face: a photo when there is a real
 * one, initials when there is not. Shared by the roster, the find-or-invite
 * results and the Following / Followers lists so a person looks the same in
 * every view (it was `Avatar` inside `people-roster-view.tsx`).
 */
export function PersonAvatar({
  name,
  photoUrl,
  tone = 'person',
}: {
  name: string;
  photoUrl?: string | null;
  /** 'alaga' takes the roster's green — the tint it gives someone in your care. */
  tone?: 'person' | 'alaga';
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  // A stored photo may be an `r2://` reference rather than a URL — those never
  // render, so only an http(s) value is used and everything else falls back to
  // initials rather than a broken glyph (the logo_url lesson, 2026-08-08).
  const src = photoUrl && /^https?:\/\//.test(photoUrl) ? photoUrl : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" aria-hidden className="h-7 w-7 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
        tone === 'alaga' ? 'bg-success-100 text-success-800' : 'bg-ink/[0.06] text-ink/60'
      }`}
    >
      {initials || '·'}
    </span>
  );
}
