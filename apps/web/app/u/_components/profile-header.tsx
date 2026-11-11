/**
 * profile-header.tsx — THE ONE PROFILE HEADER: the photo wearing the logo's frame, the name, and what sits under them.
 *
 * Owner, 11 Nov 2026 — "One profile page approve" (v3 of `one-profile-page`, DECISION_LOG "HOME IS THE PROFILE"):
 * *"Something like facebook/instagram profile page"*, and the ruling that **the profile IS the public page**. The
 * header lived only on the public `/u/[userSlug]` as inline JSX; it is lifted out here, unchanged in markup and style,
 * so the signed-in Home (`/dashboard`) and the public page draw the SAME header — one component, two gates (who may
 * see what is still each page's own read: `lib/profile-viewer.ts` on the public page, the owner's own account on Home).
 *
 *   · `layout="page"` — the public page as it shipped: centred, the big serif name.
 *   · `layout="home"` — Home's profile row (v3): photo left, name and @handle beside it, the doors underneath.
 *
 * Server-safe (no hooks, no 'use client'): both callers are server components. Its styles are
 * `PROFILE_HEADER_CSS` — the public page folds them into its own stylesheet; Home mounts them once.
 * 🔒 lib/home-is-the-profile.test.ts (one header, used by both)
 */
import type { CSSProperties, ReactNode } from 'react';

export function profileInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '··'
  );
}

export function ProfileHeader({
  layout = 'page',
  photoSrc,
  photoStyle,
  initials,
  heading,
  handle = null,
  relation = null,
  badge = null,
  audience = null,
  doors = null,
  subtitle = null,
  rule = true,
}: {
  layout?: 'page' | 'home';
  photoSrc: string | null;
  /** `pictureFrameStyle(readProfilePhotoFrame(user))` — the frame the shop logo also wears (ruling 2026-11-06). */
  photoStyle?: CSSProperties;
  initials: string;
  heading: string;
  /** Home: "@slug · Public page" — the one door to the public twin. */
  handle?: ReactNode;
  relation?: ReactNode;
  badge?: ReactNode;
  audience?: ReactNode;
  /** Home: the count doors — each one opens its section (T2 "counts as filter doors"). */
  doors?: ReactNode;
  subtitle?: string | null;
  rule?: boolean;
}) {
  const avatar = (
    <span className="uprof-avatar" aria-hidden>
      {photoSrc ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={photoSrc} alt="" className="uprof-avatar-img" decoding="async" style={photoStyle} />
      ) : (
        <span className="uprof-avatar-initials">{initials}</span>
      )}
    </span>
  );
  const name = <h1 className="m-serif uprof-name">{heading}</h1>;
  return (
    <header className="uprof-head" data-layout={layout} data-profile-header="">
      {layout === 'home' ? (
        <div className="uprof-hrow">
          {avatar}
          <div className="uprof-hname">
            {name}
            {handle ? <p className="uprof-handle" data-profile-handle="">{handle}</p> : null}
          </div>
        </div>
      ) : (
        <>
          {avatar}
          {name}
          {handle ? <p className="uprof-handle" data-profile-handle="">{handle}</p> : null}
        </>
      )}
      {relation ? (
        <p className="uprof-relation" data-uprof-relation="">
          {relation}
        </p>
      ) : null}
      {badge ? <div className="uprof-badge-row">{badge}</div> : null}
      {audience ? <div className="uprof-audience">{audience}</div> : null}
      {doors ? (
        <div className="uprof-doors" role="group" aria-label="Your sections" data-profile-doors="">
          {doors}
        </div>
      ) : null}
      {rule ? <span aria-hidden className="uprof-rule" /> : null}
      {subtitle ? <p className="uprof-sub">{subtitle}</p> : null}
    </header>
  );
}

/** The header's styles — lifted verbatim out of the public page's stylesheet, plus Home's row layout. */
export const PROFILE_HEADER_CSS = `
  .uprof-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 88px;
    margin: 0 auto 0.9rem;
    border-radius: var(--m-r-full, 999px);
    overflow: hidden;
    background: var(--m-paper-2, #F4F2EC);
    border: 1px solid var(--m-line, #E1DCD1);
  }
  .uprof-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .uprof-avatar-initials {
    font-family: var(--font-display), Georgia, serif;
    font-size: 2rem;
    letter-spacing: .04em;
    color: var(--m-orange, #A9834B);
  }
  .uprof-head { text-align: center; margin-bottom: clamp(2.25rem, 5vw, 3.25rem); }
  .uprof-name {
    font-size: clamp(2.4rem, 7vw, 4rem);
    line-height: 1.04;
    margin: 0;
    color: var(--m-ink, #1B1A17);
  }
  .uprof-badge-row {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
  }
  .uprof-audience {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem 0.7rem;
    margin-top: 1rem;
  }
  .uprof-stat {
    font-size: 0.9rem;
    color: var(--m-slate, #4F535B);
  }
  .uprof-stat strong {
    color: var(--m-ink, #1B1A17);
    font-weight: 600;
  }
  .uprof-stat-dot {
    color: var(--m-slate-2, #6A6E76);
    opacity: 0.6;
  }
  .uprof-tier-chip {
    margin-left: 0.4rem;
  }
  .uprof-follow {
    margin-left: 0.3rem;
    display: inline-flex;
    align-items: center;
    padding: 0.34rem 0.95rem;
    border: 1px solid var(--m-orange, #A9834B);
    border-radius: var(--m-r-full, 999px);
    background: var(--m-orange, #A9834B);
    color: #fff;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform .15s cubic-bezier(.2,.7,.2,1), opacity .15s, background .15s, color .15s;
  }
  .uprof-follow:hover { transform: translateY(-1px); }
  .uprof-follow:disabled { opacity: 0.6; cursor: default; transform: none; }
  .uprof-follow[data-following='1'] {
    background: #fff;
    color: var(--m-ink, #1B1A17);
    border-color: var(--m-line, #E2DED4);
  }
  /* E6 — the one-way promise. flex-basis:100% breaks it onto its own centered
     line inside the wrapping .uprof-audience row, so it never reads as a fourth
     stat chip.
     CONTRAST, measured not assumed: --m-slate-2 (#6E6A62) on --m-paper
     (#FFFFFF, white since 2026-08-20) = 5.39:1, clears AA. The spec's own 11.5px
     #A09A8E is 2.79:1 and
     was NOT used; --m-slate-3 (#8A857B) is 3.55:1 and also fails. Note that
     lint-label-on-fill-contrast.mjs CANNOT catch a miss here — it reads Tailwind
     class pairs and inline style objects, never this template literal. */
  .uprof-follow-note {
    flex-basis: 100%;
    width: 100%;
    margin: 0.35rem 0 0;
    text-align: center;
    font-size: 0.78rem;
    line-height: 1.35;
    color: var(--m-slate-2, #6E6A62);
  }

  .uprof-rule {
    display: block;
    width: 44px;
    height: 1px;
    margin: 1.25rem auto 0;
    background: var(--m-orange, #A9834B);
  }
  .uprof-sub {
    margin: 1rem 0 0;
    font-size: 0.98rem;
    color: var(--m-slate, #4F535B);
  }

  .uprof-relation {
    display: inline-flex;
    align-items: center;
    margin: 0.5rem auto 0;
    padding: 0.2rem 0.7rem;
    border: 1px solid var(--m-line, #E2DED4);
    border-radius: var(--m-r-full, 999px);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--m-ink, #1B1A17);
  }

  /* ── 🏠 HOME'S LAYOUT (owner 11 Nov 2026, "One profile page approve" — v3): the same header, read as a profile row —
     the photo on the left, the name and @handle beside it, the doors under them. Left-aligned, no centred hero. */
  .uprof-head[data-layout='home'] {
    text-align: left;
    margin: 0;
    padding: 4px 0 12px;
  }
  .uprof-head[data-layout='home'] .uprof-hrow {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }
  .uprof-head[data-layout='home'] .uprof-avatar {
    width: 64px;
    height: 64px;
    margin: 0;
    flex: 0 0 auto;
  }
  .uprof-head[data-layout='home'] .uprof-avatar-initials { font-size: 1.5rem; }
  .uprof-head[data-layout='home'] .uprof-hname { min-width: 0; flex: 1; }
  .uprof-head[data-layout='home'] .uprof-name {
    font-size: 1.5rem;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .uprof-handle {
    margin: 2px 0 0;
    font-family: var(--font-mono-marketing), ui-monospace, monospace;
    font-size: 12px;
    color: var(--m-slate);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .uprof-handle a { color: inherit; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: color-mix(in srgb, currentColor 35%, transparent); }
  .uprof-doors {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
`;
