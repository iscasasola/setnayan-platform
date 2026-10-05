'use client';

import { useState, useTransition } from 'react';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { stdFollowTheme, type StdLegibility } from '@/lib/std-backgrounds';

/**
 * 🎞 "YOUR SAVE THE DATE FILM KEEPS ITS OWN BACKGROUND · SAME AS THEME" (owner,
 * live walk 2026-10-05, relayed by the controller with this copy). The film
 * follows the theme unless the couple picked a background of its own
 * (`stdFilmBackground`) — and then a theme change shows nowhere on it. One tap
 * hands the film back to the theme, INTO THE DRAFT (`std_background: null`, the
 * only value the draft holds for it): Undo steps it back, Apply puts it live.
 *
 * Drawn under Theme only while the film has a pick of its own. Its own file: the
 * theme picker is the theme's ONE writer (`a-theme-pick-hands-the-look-back`).
 * The tap is drawn first (the line goes), then saved; a refusal puts it back.
 */
export function FilmFollowsTheme({
  eventId,
  legibility = 'auto',
}: {
  eventId: string;
  /** The film's Readability today — kept when it follows the theme (`stdFollowTheme`). */
  legibility?: StdLegibility;
}) {
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  if (hidden && !error) return null;
  const follow = () => {
    setHidden(true);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify({ events: { std_background: stdFollowTheme(legibility) } }));
      const r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh).catch(
        () => ({ ok: false as const, error: 'That did not save. Please try again.' }),
      );
      if (!r.ok) {
        setHidden(false);
        setError(r.error);
      }
    });
  };
  return (
    <p data-film-follows-theme="" className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink/75">
      <span>Your Save the Date film keeps its own background ·</span>
      <button
        type="button"
        onClick={follow}
        className="sn-press inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-2"
      >
        Same as theme
      </button>
      {error ? (
        <span role="alert" className="basis-full text-xs text-danger-800">
          {error}
        </span>
      ) : null}
    </p>
  );
}
