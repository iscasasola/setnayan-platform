'use client';

/**
 * "Overall Theme" — the card at the top of the redesigned Mood Board canvas
 * (2026-09-02): an editable name + description for the couple's wedding look,
 * with a "Suggest for me" button that fills in a starter derived from the
 * couple's own saved palette + reception design (lib/theme-suggest.ts — pure,
 * no AI call). Accepting/overwriting the suggestion is the couple's choice;
 * nothing is saved until they edit (debounced) or the values change.
 *
 * ── 🔑 AND THE DESCRIPTION NOW DOES SOMETHING (2026-09-03) ─────────────────
 * The description box was a real, saved, INERT field: shown on the vendor
 * board and printed on the concept-PDF cover, and read by nothing. Its
 * placeholder invited a sentence about the feeling and then ignored it. The
 * owner typed "i want to feel christmas vibe with a hint of classy elegance"
 * and nothing happened — verdict: "if this will not help me generate a theme,
 * remove it."
 *
 * Three rules govern the flow that replaces that silence, and they are the
 * reason it is shaped the way it is:
 *
 *   1. NEVER ON KEYSTROKE. Reading is an explicit act — the couple presses
 *      "Read my description". Prose is never quietly reinterpreted as they
 *      type.
 *   2. THE READING IS SHOWN BEFORE ANYTHING MOVES. What we understood arrives
 *      as REMOVABLE chips; what we did NOT understand is shown too, in the
 *      couple's own words. Nothing reaches the board until they press "Use
 *      these".
 *   3. IT FILLS, IT NEVER OVERWRITES. `applyThemeIntent` merges fill-empty,
 *      exactly like applying a theme template does.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { Sparkles, Wand2, X } from 'lucide-react';
import type { RolePalette } from '@/lib/mood-board';
import type { ReceptionDesign } from '@/lib/reception-scene';
import { suggestMoodboardTheme } from '@/lib/theme-suggest';
import {
  MOOD_LABELS,
  STYLE_FAMILY_LABELS,
  type MoodboardMoodTag,
  type MoodboardStyleFamily,
} from '@/lib/moodboard-templates';
import { motifId, type ThemeTextReading } from '@/lib/theme-text-intent';

export type ThemeIntentJump = {
  mood: MoodboardMoodTag | null;
  family: MoodboardStyleFamily | null;
};

type ApplySummary = {
  filledPaletteRoles: string[];
  filledReceptionZones: string[];
  styleFamily: string | null;
  nothingToFill: boolean;
};

type Props = {
  eventId: string;
  initialName: string | null;
  initialDescription: string | null;
  palette: RolePalette;
  receptionDesign: ReceptionDesign;
  saveAction: (eventId: string, theme: { name: string; description: string }) => Promise<void>;
  readAction: (text: string) => Promise<ThemeTextReading>;
  applyIntentAction: (eventId: string, selection: unknown) => Promise<ApplySummary>;
  /** Hands the gallery below the feeling + setting we read, so "Use these"
   *  lands the couple on the matching themes instead of a saved field. */
  onJump?: (jump: ThemeIntentJump) => void;
};

const SAVE_DEBOUNCE_MS = 900;

/** One removable chip. `onRemove` omitted = informational, not a selection. */
function Chip({
  label,
  swatch,
  onRemove,
  tone = 'kept',
}: {
  label: string;
  swatch?: string;
  onRemove?: () => void;
  tone?: 'kept' | 'unknown';
}) {
  return (
    <span
      className={
        tone === 'kept'
          ? 'inline-flex items-center gap-1.5 rounded-full border border-terracotta/35 bg-terracotta/[0.07] py-1 pl-2.5 pr-1.5 text-xs font-medium text-ink'
          : 'inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-ink/[0.03] px-2.5 py-1 text-xs text-ink/60'
      }
    >
      {swatch ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-ink/15"
          style={{ backgroundColor: swatch }}
        />
      ) : null}
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="sn-press rounded-full p-0.5 text-ink/45 transition hover:bg-ink/10 hover:text-ink"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

export function ThemeCard({
  eventId,
  initialName,
  initialDescription,
  palette,
  receptionDesign,
  saveAction,
  readAction,
  applyIntentAction,
  onJump,
}: Props) {
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── the reading ────────────────────────────────────────────────────────
  const [reading, setReading] = useState<ThemeTextReading | null>(null);
  const [readState, setReadState] = useState<'idle' | 'reading' | 'error'>('idle');
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  // The chips the couple has REMOVED. Kept as ids rather than by rebuilding
  // `reading`, so removing a chip never mutates the reading we're showing.
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  function scheduleSave(nextName: string, nextDescription: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus('saving');
    saveTimer.current = setTimeout(() => {
      startTransition(async () => {
        try {
          await saveAction(eventId, { name: nextName, description: nextDescription });
          setStatus('saved');
          setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
        } catch {
          setStatus('error');
        }
      });
    }, SAVE_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function onNameChange(v: string) {
    setName(v);
    scheduleSave(v, description);
  }
  function onDescriptionChange(v: string) {
    setDescription(v);
    scheduleSave(name, v);
    // The old reading described a sentence that no longer exists. Drop it
    // rather than leave stale chips sitting under a rewritten description.
    if (reading) {
      setReading(null);
      setApplyMessage(null);
      setDropped(new Set());
    }
  }

  function onSuggest() {
    const suggestion = suggestMoodboardTheme(palette, receptionDesign);
    if (!suggestion) return;
    setName(suggestion.name);
    setDescription(suggestion.description);
    scheduleSave(suggestion.name, suggestion.description);
  }

  async function onRead() {
    if (description.trim().length === 0 || readState === 'reading') return;
    setReadState('reading');
    setApplyMessage(null);
    setDropped(new Set());
    try {
      setReading(await readAction(description));
      setReadState('idle');
    } catch {
      setReadState('error');
    }
  }

  const isDropped = (id: string) => dropped.has(id);
  const drop = (id: string) => setDropped((prev) => new Set(prev).add(id));

  const keptMoods = (reading?.moods ?? []).filter((m) => !isDropped(`mood:${m}`));
  const keptFamilies = (reading?.families ?? []).filter((f) => !isDropped(`family:${f}`));
  const keptColours = (reading?.colours ?? []).filter((c) => !isDropped(`colour:${c.hex}`));
  const keptMotifs = (reading?.motifs ?? []).filter((m) => !isDropped(`motif:${motifId(m)}`));
  const keptAnything =
    keptMoods.length > 0 ||
    keptFamilies.length > 0 ||
    keptColours.length > 0 ||
    keptMotifs.length > 0;

  async function onUseThese() {
    if (!reading || applying || !keptAnything) return;
    setApplying(true);
    try {
      const result = await applyIntentAction(eventId, {
        moods: keptMoods,
        families: keptFamilies,
        colours: keptColours,
        motifs: keptMotifs.map(motifId),
      });
      const parts: string[] = [];
      if (result.filledPaletteRoles.length > 0) parts.push('your reception colours');
      if (result.filledReceptionZones.length > 0) {
        parts.push(
          `${result.filledReceptionZones.length} reception ${result.filledReceptionZones.length === 1 ? 'detail' : 'details'}`,
        );
      }
      setApplyMessage(
        parts.length > 0
          ? `Filled in ${parts.join(' and ')}. Everything you'd already chosen was left alone.`
          : 'Your board already had all of that — nothing was changed. Showing themes that match instead.',
      );
      onJump?.({ mood: keptMoods[0] ?? null, family: keptFamilies[0] ?? null });
    } catch {
      setApplyMessage('Could not apply that — try again.');
    } finally {
      setApplying(false);
    }
  }

  const understoodNothing = reading !== null && !keptAnything && dropped.size === 0;

  return (
    <section id="theme" className="sn-tile scroll-mt-24 space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          Overall theme
        </p>
        <button
          type="button"
          onClick={onSuggest}
          className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 px-3 py-1 text-xs font-medium text-terracotta-700 transition hover:bg-terracotta/10"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Suggest for me
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Name your theme — e.g. “Blush &amp; Gold Garden Reception”"
        maxLength={80}
        className="w-full border-0 bg-transparent p-0 text-2xl font-semibold text-ink placeholder:text-ink/30 focus:outline-none sm:text-3xl"
      />
      {/* ⚠ THE PLACEHOLDER IS A PROMISE. The old one — "Describe the feel in a
          sentence or two — the colors, the mood, what makes it yours" — asked
          for exactly the sentence the field then ignored. This one says what
          pressing the button below actually does. */}
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Say the feeling in your own words — e.g. “christmas vibe with a hint of classy elegance”. Tap Read my description and we’ll pull out the mood, colours and details we recognise."
        maxLength={280}
        rows={3}
        className="w-full resize-none border-0 bg-transparent p-0 text-sm text-ink/70 placeholder:text-ink/30 focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void onRead()}
          disabled={description.trim().length === 0 || readState === 'reading'}
          className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 bg-terracotta/[0.06] px-3.5 py-1.5 text-xs font-semibold text-terracotta-700 transition hover:bg-terracotta/10 disabled:opacity-40"
        >
          <Wand2 className="h-3.5 w-3.5" aria-hidden />
          {readState === 'reading' ? 'Reading…' : 'Read my description'}
        </button>
        <p aria-live="polite" className="text-xs text-ink/45">
          {status === 'saving'
            ? 'Saving…'
            : status === 'saved'
              ? 'Saved'
              : status === 'error'
                ? 'Could not save — try again.'
                : readState === 'error'
                  ? 'We couldn’t read that just now — try again.'
                  : ''}
        </p>
      </div>

      {/* ── the reading, shown BEFORE anything changes ───────────────── */}
      {reading ? (
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-cream/40 p-4">
          {understoodNothing ? (
            <p className="text-sm text-ink/70">
              We couldn’t place any of that yet — nothing on your board has changed. Try a colour,
              a feeling (“cosy”, “engrande”, “classy”) or a detail (“capiz”, “fairy lights”).
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">
                Here’s what we understood — remove anything that isn’t right.
              </p>

              {keptMoods.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                    Feeling
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {keptMoods.map((m) => (
                      <Chip
                        key={m}
                        label={MOOD_LABELS[m] ?? m}
                        onRemove={() => drop(`mood:${m}`)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {keptFamilies.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                    Setting
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {keptFamilies.map((f) => (
                      <Chip
                        key={f}
                        label={STYLE_FAMILY_LABELS[f] ?? f}
                        onRemove={() => drop(`family:${f}`)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {keptColours.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                    Colours
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {keptColours.map((c) => (
                      <Chip
                        key={c.hex}
                        label={c.name}
                        swatch={c.hex}
                        onRemove={() => drop(`colour:${c.hex}`)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {keptMotifs.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                    Details
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {keptMotifs.map((m) => (
                      <Chip
                        key={motifId(m)}
                        label={m.label}
                        onRemove={() => drop(`motif:${motifId(m)}`)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}

          {/* 🔑 WHAT WE DID NOT UNDERSTAND IS PART OF THE ANSWER — a reader
              that quietly drops half a sentence looks exactly like one that
              understood all of it. */}
          {reading.unrecognised.length > 0 ? (
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                We didn’t understand
              </p>
              <div className="flex flex-wrap gap-1.5">
                {reading.unrecognised.map((w) => (
                  <Chip key={w} label={w} tone="unknown" />
                ))}
              </div>
              <p className="text-xs text-ink/50">
                These didn’t match anything we stock — they’re still in your description for your
                suppliers to read.
              </p>
            </div>
          ) : null}

          {reading.excluded.length > 0 ? (
            <p className="text-xs text-ink/60">
              You ruled out: {reading.excluded.join(', ')} — we left those out.
            </p>
          ) : null}

          {reading.conflicts.map(([a, b]) => (
            <p key={`${a}-${b}`} className="text-xs text-ink/60">
              You asked for both {MOOD_LABELS[a] ?? a} and {MOOD_LABELS[b] ?? b}. We kept both —
              remove one if you’d rather lean a single way.
            </p>
          ))}

          {reading.notes.map((n) => (
            <p key={n} className="text-xs text-ink/60">
              {n}
            </p>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void onUseThese()}
              disabled={!keptAnything || applying}
              className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 bg-terracotta/[0.06] px-3.5 py-1.5 text-xs font-semibold text-terracotta-700 transition hover:bg-terracotta/10 disabled:opacity-40"
            >
              {applying ? 'Applying…' : 'Use these'}
            </button>
            <button
              type="button"
              onClick={() => {
                setReading(null);
                setApplyMessage(null);
                setDropped(new Set());
              }}
              className="sn-press text-[12px] font-bold text-ink/60 underline underline-offset-2 hover:text-ink"
            >
              Dismiss
            </button>
            <p className="text-xs text-ink/50">
              Nothing is changed until you press <span className="font-medium">Use these</span>.
            </p>
          </div>

          {applyMessage ? (
            <p aria-live="polite" className="text-xs font-medium text-ink/75">
              {applyMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
