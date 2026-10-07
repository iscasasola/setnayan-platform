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
 * Drawn under Look › Background only while the film has a pick of its own. Its own file: the
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
  /* ON = the film follows the Event Hub. Drawn only while it has a pick of its own (off); a tap
     turns it on at once, saves into the draft, and the refresh then folds the row away. */
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const follow = () => {
    if (on) return;
    setOn(true);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify({ events: { std_background: stdFollowTheme(legibility) } }));
      const r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh).catch(
        () => ({ ok: false as const, error: 'That did not save. Please try again.' }),
      );
      if (!r.ok) {
        setOn(false);
        setError(r.error);
      }
    });
  };
  return (
    <div data-film-follows-theme="" className="flex flex-col gap-1">
      {/* 🔀 A SWITCH, not a link (owner 2026-10-08, studio round 3: *"Same as the Event Hub" becomes a switch*). */}
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm text-ink">
        <span className="min-w-0">
          Save the Date film · Same as the Event Hub
          <span className="block text-xs text-ink/60">{on ? 'It follows the Event Hub’s background.' : 'Your film keeps its own background.'}</span>
        </span>
        <input type="checkbox" role="switch" checked={on} onChange={follow} className="peer sr-only" data-film-follows-switch="" />
        <span
          aria-hidden
          className="relative h-6 w-11 shrink-0 rounded-full bg-ink/20 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-terracotta-700 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-mulberry"
        />
      </label>
      {error ? (
        <span role="alert" className="text-xs text-danger-800">
          {error}
        </span>
      ) : null}
    </div>
  );
}
