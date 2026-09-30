import { Camera, CircleSlash, Sparkles } from 'lucide-react';

import { sceneCardClass } from '@/lib/scene-card-look';

/**
 * CAMERA CUES' OTHER TWO STYLES — B · Down the day and C · Yes and no
 * (prototype `every_scene_three_styles_2026-09-29.html` §10). A · Cards is
 * `PhotoMomentsWidget` itself.
 *
 * The same intro and the same up-to-eight moments `parsePhotoMomentsConfig`
 * reads for the cards, each with its mode: cameras welcome · phones down ·
 * our paparazzi (the Papic cue — Papic keeps its name). Nothing is looked up.
 * The moments stay in the couple's order: their time is a label they typed,
 * not a clock value, so it is never re-sorted or read as "now".
 */

export type PhotoMomentMode = 'camera_ok' | 'phone_down' | 'papic_only';
export type PhotoMomentView = { time_label: string; title: string; note: string; mode: PhotoMomentMode };

const MODE_WORD: Record<PhotoMomentMode, string> = {
  camera_ok: 'Cameras welcome',
  phone_down: 'Phones down',
  papic_only: 'Our paparazzi',
};

function ModeIcon({ mode }: { mode: PhotoMomentMode }) {
  if (mode === 'camera_ok') return <Camera aria-hidden className="h-4 w-4 text-gild" strokeWidth={1.75} />;
  if (mode === 'papic_only') return <Sparkles aria-hidden className="h-4 w-4 text-terracotta-700" strokeWidth={1.75} />;
  return <CircleSlash aria-hidden className="h-4 w-4 text-ink/70" strokeWidth={1.75} />;
}

function Header() {
  return (
    <header>
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-ink/55">Savour the moments</p>
      <h3 className="mt-1 text-2xl font-semibold tracking-tight">Photo moments</h3>
    </header>
  );
}

type Props = { intro: string; moments: readonly PhotoMomentView[]; bare?: boolean };

/** B · Down the day — one row each in the couple's order, the mode as an icon and a word. */
export function PhotoMomentsDownTheDay({ intro, moments, bare = false }: Props) {
  return (
    <section data-scene-card={bare ? 'bare' : 'own'} data-scene-style="down-the-day" className={sceneCardClass('card', bare)}>
      <Header />
      {intro.trim() ? <p className="text-sm text-ink/70">{intro}</p> : null}
      <ol className="divide-y divide-ink/10 border-y border-ink/10">
        {moments.map((m, i) => (
          <li key={`${m.title}-${i}`} className="grid grid-cols-[4.5rem_1fr] items-start gap-3 py-3" data-moment-mode={m.mode}>
            <p className="font-mono text-xs uppercase tabular-nums tracking-[0.1em] text-terracotta">{m.time_label}</p>
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium text-ink">
                <ModeIcon mode={m.mode} />
                {m.title}
              </p>
              <p className="mt-0.5 text-sm text-ink/65">
                {MODE_WORD[m.mode]}
                {m.note.trim() ? ` · ${m.note}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** C · Yes and no — when to shoot, and when to put the phone away. The Papic cue lives on the "yes" side. */
export function PhotoMomentsYesAndNo({ intro, moments, bare = false }: Props) {
  const yes = moments.filter((m) => m.mode !== 'phone_down');
  const no = moments.filter((m) => m.mode === 'phone_down');
  const column = (title: string, list: readonly PhotoMomentView[], side: 'yes' | 'no') => (
    <div className="min-w-0 space-y-3" data-moments-side={side}>
      <p className={`font-sans text-xs uppercase tracking-[0.2em] ${side === 'yes' ? 'text-gild' : 'text-ink/60'}`}>{title}</p>
      {list.length === 0 ? (
        <p className="text-sm text-ink/60">—</p>
      ) : (
        <ul className="space-y-3">
          {list.map((m, i) => (
            <li key={`${m.title}-${i}`} className="space-y-0.5">
              {m.mode === 'papic_only' ? (
                <p className="flex items-center gap-1.5 font-sans text-xs uppercase tracking-[0.14em] text-terracotta-700">
                  <ModeIcon mode={m.mode} />
                  {MODE_WORD[m.mode]}
                </p>
              ) : null}
              <p className="text-sm font-medium text-ink">
                {m.time_label.trim() ? <span className="font-mono tabular-nums">{m.time_label} · </span> : null}
                {m.title}
              </p>
              {m.note.trim() ? <p className="text-sm text-ink/65">{m.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <section data-scene-card={bare ? 'bare' : 'own'} data-scene-style="yes-and-no" className={sceneCardClass('card', bare)}>
      <Header />
      <div className="grid grid-cols-2 gap-4">
        {column('Cameras welcome', yes, 'yes')}
        {column('Phones down', no, 'no')}
      </div>
      {intro.trim() ? <p className="text-sm text-ink/70">{intro}</p> : null}
    </section>
  );
}
