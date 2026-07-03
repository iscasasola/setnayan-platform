'use client';

// ============================================================================
// Editorial editor (iteration 0046) — one page where the couple controls their
// post-event "front-page story": the words, which photos/inputs to bring in,
// and which features show. Wires to the existing piece-editors (living hero,
// photos, thank-you note) and writes content + section visibility to draft_json.
// ============================================================================

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, ChevronDown, ChevronUp, Eye, EyeOff, Film, Lock } from 'lucide-react';
import {
  saveEditorial,
  setStoryShowcase,
  type EditorialEditorInput,
} from '../actions';
import type {
  ChapterCard,
  ChapterOverride,
  EditorialSections,
} from '@/app/[slug]/_components/editorial/data';
import { ShareButtons } from '@/app/realstories/_components/share-buttons';
import { useToast } from '@/app/_components/toast/toast-provider';

type LandingVisibility = 'public' | 'unlisted' | 'private';

const SECTIONS: Array<{ key: keyof EditorialSections; label: string; help: string }> = [
  { key: 'byTheNumbers', label: 'By the Numbers', help: 'Your day in stats — guests, vendors, time saved.' },
  { key: 'gallery', label: 'Photo gallery', help: 'The shared photos from the day.' },
  { key: 'reviews', label: 'Guest wishes', help: 'What your guests, vendors, and you said.' },
  { key: 'team', label: 'Vendor team', help: 'The suppliers who made the day.' },
  { key: 'fromVendors', label: 'From your vendors', help: 'Day-of photos & clips your recommended vendor shared.' },
  { key: 'poweredBy', label: 'Powered by Setnayan', help: 'The Setnayan services you used.' },
  { key: 'liveWall', label: 'Live Photo Wall', help: 'The day’s candid photo wall, if you have it.' },
  { key: 'videoGuestbook', label: 'Video guestbook', help: 'Your guests’ 5-second video greetings (Pabati), if you have it.' },
  { key: 'watchFilm', label: 'Watch the film', help: 'Your Live Studio broadcast replay, if you streamed the day.' },
  { key: 'kwento', label: 'What they whispered', help: 'Your guests’ best wishes (Kwento), captured on the day.' },
  { key: 'fromTheCouple', label: 'From the couple', help: 'Your thank-you note to guests.' },
  { key: 'vendorsWeLoved', label: 'Vendors we loved', help: 'The vendors you recommended — your endorsements, shown to future couples.' },
];

// The 10 canonical LOCKED moments (Editorial_Experience_Spec §3). Offered as a
// datalist so the couple can pick a familiar name in one tap — while still typing
// any free text (the input is not constrained to the list).
const CANONICAL_MOMENTS = [
  'Bridal March',
  'Exchange of Vows',
  'Veil & Cord (Yugal)',
  'First Kiss',
  'Leaving the Church',
  'Cocktail Hour',
  'Newlywed Entrance',
  'First Dance',
  'Cake Cutting',
  'Money Dance (Pera-Pera)',
] as const;

// Soft cap for the per-moment write-up — a live counter warns past this, but the
// textarea never hard-blocks typing (the server hard-caps at 600).
const WRITEUP_SOFT_CAP = 400;

// One editable chapter row in the curation panel — a card (thumb/time/leadId)
// plus the couple's working title / write-up / hidden state. `order` is the
// couple's chosen position; reorder buttons swap it.
type ChapterRow = {
  card: ChapterCard;
  title: string;
  writeUp: string;
  hidden: boolean;
};

type FieldProps = {
  label: string;
  help?: string;
  children: React.ReactNode;
};
function Field({ label, help, children }: FieldProps) {
  return (
    <label className="block">
      <span className="font-display text-base italic text-ink">{label}</span>
      {help ? <span className="mt-0.5 block text-xs text-ink/55">{help}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-burgundy/50';

export function EditorialEditor({
  eventId,
  slug,
  initial,
  chapterCards = [],
  chapterOverrides = [],
  shareUrl = null,
  showcaseOptedIn = false,
  landingVisibility = 'public',
  isWedding = true,
}: {
  eventId: string;
  slug: string | null;
  initial: EditorialEditorInput;
  /** Auto-built "As the Day Unfolded" chapters (unfiltered, timeline order). */
  chapterCards?: ChapterCard[];
  /** The couple's current per-chapter overrides (draft_json.chapterOverrides). */
  chapterOverrides?: ChapterOverride[];
  /** Absolute canonical URL of the public story — what the couple shares. */
  shareUrl?: string | null;
  /** Whether this couple has already opted into the Real Stories showcase. */
  showcaseOptedIn?: boolean;
  /** Landing-page visibility — a private page can't be featured publicly. */
  landingVisibility?: LandingVisibility;
  /** Real Stories only aggregates weddings (loadPublishedShowcases filters
   *  event_type='wedding'), so the opt-in toggle is wedding-only — a non-wedding
   *  couple toggling it would set consent that never surfaces. */
  isWedding?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<EditorialEditorInput>(initial);

  // ── "As the Day Unfolded" curation rows ──────────────────────────────────
  // Build the couple's working rows by applying their saved overrides on top of
  // the auto cards, MIRRORING the public loader's order: overridden chapters
  // first (in override-array order), then the rest in timeline order. Stale
  // overrides (leadId no longer a live card) are ignored. Computed once.
  const initialRows = useMemo<ChapterRow[]>(() => {
    const byLead = new Map(chapterCards.map((c) => [c.leadId, c] as const));
    const rows: ChapterRow[] = [];
    const taken = new Set<string>();
    for (const ov of chapterOverrides) {
      const card = byLead.get(ov.leadId);
      if (!card || taken.has(ov.leadId)) continue;
      taken.add(ov.leadId);
      rows.push({
        card,
        title: typeof ov.title === 'string' ? ov.title : '',
        writeUp: typeof ov.writeUp === 'string' ? ov.writeUp : '',
        hidden: ov.hidden === true,
      });
    }
    for (const card of chapterCards) {
      if (taken.has(card.leadId)) continue;
      rows.push({ card, title: '', writeUp: '', hidden: false });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The canonical (auto) order — used to detect whether the couple reordered.
  const defaultOrder = useMemo(() => chapterCards.map((c) => c.leadId), [chapterCards]);
  const [rows, setRows] = useState<ChapterRow[]>(initialRows);
  const [phase, setPhase] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  // Real Stories showcase opt-in — local mirror of the per-user consent flag.
  const [featured, setFeatured] = useState(showcaseOptedIn);
  const [featuring, setFeaturing] = useState(false);
  // Unsaved-changes flag, so opening a sub-editor can save first — kills the old
  // "save your text here first, then open one" footgun where typed words were lost.
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof EditorialEditorInput>(k: K, v: EditorialEditorInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const toggle = (k: keyof EditorialSections) => {
    setForm((f) => ({ ...f, sections: { ...f.sections, [k]: !f.sections[k] } }));
    setDirty(true);
  };

  // ── Chapter-row mutations ────────────────────────────────────────────────
  const patchRow = (leadId: string, patch: Partial<Omit<ChapterRow, 'card'>>) => {
    setRows((rs) => rs.map((r) => (r.card.leadId === leadId ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const moveRow = (index: number, dir: -1 | 1) => {
    setRows((rs) => {
      const j = index + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = rs.slice();
      const moved = next[index];
      if (!moved) return rs;
      next.splice(index, 1);
      next.splice(j, 0, moved);
      return next;
    });
    setDirty(true);
  };

  // Compute the chapterOverrides to persist. Send an ordered row per chapter ONLY
  // when the couple changed something (reordered, renamed, wrote a story, or hid
  // one) — otherwise `[]`, which reverts to pure auto. Because the loader front-
  // loads overridden chapters in array order, ANY change sends the FULL ordered
  // set (bare `{ leadId }` rows hold position for untouched chapters).
  const buildChapterOverrides = (): ChapterOverride[] => {
    const reordered = rows.some((r, i) => r.card.leadId !== defaultOrder[i]);
    const edited = rows.some((r) => r.title.trim() || r.writeUp.trim() || r.hidden);
    if (!reordered && !edited) return [];
    return rows.map((r) => {
      const title = r.title.trim();
      const writeUp = r.writeUp.trim();
      return {
        leadId: r.card.leadId,
        ...(title ? { title } : {}),
        ...(writeUp ? { writeUp } : {}),
        ...(r.hidden ? { hidden: true } : {}),
      };
    });
  };

  const persist = async (publish: boolean): Promise<boolean> => {
    setPhase('saving');
    setError(null);
    try {
      const r = await saveEditorial(eventId, {
        ...form,
        chapterOverrides: buildChapterOverrides(),
        publish,
      });
      if (!r.ok) throw new Error(r.error);
      // Direct setForm (not `set`) so the publish flag doesn't re-mark dirty.
      setForm((f) => ({ ...f, publish }));
      setDirty(false);
      setPhase('done');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setPhase('error');
      return false;
    }
  };
  const onSave = (publish: boolean) => {
    void persist(publish);
  };
  // Save the couple's words as a draft BEFORE navigating into a sub-editor, so
  // nothing typed here is lost. Only navigates if the save succeeds.
  const openPiece = async (href: string) => {
    const ok = await persist(false);
    if (ok) router.push(href);
  };

  // Toggle the Real Stories showcase opt-in (per-user consent). Optimistic with
  // rollback on failure; the public-page caveat is surfaced separately below.
  const toggleFeatured = async () => {
    if (featuring) return;
    const next = !featured;
    setFeatured(next);
    setFeaturing(true);
    try {
      const r = await setStoryShowcase(eventId, next);
      if (!r.ok) throw new Error(r.error);
      toast.success(
        next
          ? 'Your story can now be featured in Real Stories.'
          : 'Removed from Real Stories.',
      );
    } catch (e) {
      setFeatured(!next); // rollback
      toast.error(e instanceof Error ? e.message : 'Could not update.');
    } finally {
      setFeaturing(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied.');
    } catch {
      toast.error('Could not copy — long-press the link to copy it.');
    }
  };

  const card = 'rounded-2xl border border-ink/10 bg-cream/40 p-5 sm:p-6';
  const linkCard =
    'flex items-center justify-between gap-3 rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm transition hover:border-burgundy/40 hover:bg-burgundy/5';

  return (
    <div className="space-y-6">
      {/* Bring-in inputs (existing piece-editors) */}
      <section className={card}>
        <h2 className="font-display text-lg italic text-ink">What goes in</h2>
        <p className="mt-0.5 text-sm text-ink/60">
          The pieces below have their own editors. Open any — we&rsquo;ll save your words
          here first, so nothing&rsquo;s lost.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {[
            { href: `/dashboard/${eventId}/website/living-hero`, label: 'Living hero', sub: 'Boomerang or photo' },
            { href: `/dashboard/${eventId}/website/our-photos`, label: 'Photos', sub: 'The gallery' },
            { href: `/dashboard/${eventId}/website/special-message`, label: 'Thank-you note', sub: 'From the couple' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={linkCard}
              onClick={(e) => {
                // Plain click with unsaved words → save a draft first, then go,
                // so nothing typed here is lost. Modifier-clicks (open in a new
                // tab/window) pass through — this tab keeps its state.
                if (dirty && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
                  e.preventDefault();
                  void openPiece(l.href);
                }
              }}
            >
              <span>
                <span className="block font-medium text-ink">{l.label}</span>
                <span className="block text-xs text-ink/55">{l.sub}</span>
              </span>
              <ArrowUpRight aria-hidden className="h-4 w-4 flex-none text-ink/40" strokeWidth={1.75} />
            </Link>
          ))}
        </div>
      </section>

      {/* Words */}
      <section className={card}>
        <h2 className="font-display text-lg italic text-ink">The words</h2>
        <p className="mt-0.5 text-sm text-ink/60">
          These are written from your wedding details. Edit anything — or clear a field to let us
          rewrite it for you.
        </p>
        <div className="mt-4 space-y-4">
          <Field label="Eyebrow" help="The small line above the headline.">
            <input
              className={inputCls}
              value={form.superKicker}
              onChange={(e) => set('superKicker', e.target.value)}
              placeholder="A big-hearted celebration"
            />
          </Field>
          <Field label="Headline">
            <input
              className={inputCls}
              value={form.headline}
              onChange={(e) => set('headline', e.target.value)}
              placeholder="Maria & Juan Are Married"
            />
          </Field>
          <Field label="Sub-headline" help="The italic line under the headline.">
            <input
              className={inputCls}
              value={form.deck}
              onChange={(e) => set('deck', e.target.value)}
              placeholder="After seven years together, married at last…"
            />
          </Field>
          <Field label="Your story" help="Your front-page write-up. Leave blank to keep it photo-led.">
            <textarea
              className={`${inputCls} min-h-[120px] resize-y`}
              value={form.leadParagraphs}
              onChange={(e) => set('leadParagraphs', e.target.value)}
              placeholder="Write in a few short paragraphs — leave a blank line between each."
            />
          </Field>
          <Field label="Pull quote" help="One line, set large in the story.">
            <input
              className={inputCls}
              value={form.pullQuote}
              onChange={(e) => set('pullQuote', e.target.value)}
              placeholder="And on the day, everything was just set."
            />
          </Field>
          <Field label="Byline">
            <input
              className={inputCls}
              value={form.byline}
              onChange={(e) => set('byline', e.target.value)}
              placeholder="By the Setnayan Desk"
            />
          </Field>
        </div>
      </section>

      {/* As the Day Unfolded — per-chapter curation. Hidden entirely when the
          event has no Papic timeline media (nothing to curate). */}
      {rows.length ? (
        <section className={card}>
          <h2 className="font-display text-lg italic text-ink">As the day unfolded</h2>
          <p className="mt-0.5 text-sm text-ink/60">
            We built these moments from your day&rsquo;s photos and clips, in the order they
            happened. Name a moment, add a short story, reorder them, or hide any you&rsquo;d
            rather not show. Leave a moment untouched and it keeps its clock time.
          </p>

          {/* Shared datalist of the canonical moments — offered to every row's
              name input while still allowing any free text. */}
          <datalist id="editorial-canonical-moments">
            {CANONICAL_MOMENTS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>

          <ol className="mt-4 space-y-3">
            {rows.map((r, i) => {
              const leadId = r.card.leadId;
              const count = r.writeUp.length;
              const over = count > WRITEUP_SOFT_CAP;
              return (
                <li
                  key={leadId}
                  className={`rounded-xl border border-ink/10 bg-white p-3 transition ${r.hidden ? 'opacity-60' : ''}`}
                >
                  <div className="flex gap-3">
                    {/* Thumbnail — the lead's still, or a film glyph for a
                        posterless clip. Presigned URL, plain <img> (never
                        next/image on this surface). */}
                    <div className="relative h-16 w-16 flex-none overflow-hidden rounded-lg bg-ink/10">
                      {r.card.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.card.thumbUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-ink/40">
                          <Film aria-hidden className="h-6 w-6" strokeWidth={1.75} />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink/50">
                          {r.card.time ?? 'A moment from the day'}
                          {r.card.isClip ? ' · clip' : ''}
                        </span>
                        {/* Reorder + hide controls */}
                        <span className="flex flex-none items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveRow(i, -1)}
                            disabled={i === 0}
                            aria-label="Move moment earlier"
                            className="rounded-md border border-ink/15 bg-cream p-1 text-ink/65 transition hover:bg-cream/70 disabled:opacity-40"
                          >
                            <ChevronUp aria-hidden className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRow(i, 1)}
                            disabled={i === rows.length - 1}
                            aria-label="Move moment later"
                            className="rounded-md border border-ink/15 bg-cream p-1 text-ink/65 transition hover:bg-cream/70 disabled:opacity-40"
                          >
                            <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => patchRow(leadId, { hidden: !r.hidden })}
                            aria-pressed={r.hidden}
                            aria-label={r.hidden ? 'Show this moment' : 'Hide this moment'}
                            className={`rounded-md border p-1 transition ${
                              r.hidden
                                ? 'border-burgundy/25 bg-burgundy/10 text-burgundy'
                                : 'border-ink/15 bg-cream text-ink/65 hover:bg-cream/70'
                            }`}
                          >
                            {r.hidden ? (
                              <EyeOff aria-hidden className="h-4 w-4" strokeWidth={2} />
                            ) : (
                              <Eye aria-hidden className="h-4 w-4" strokeWidth={2} />
                            )}
                          </button>
                        </span>
                      </div>

                      <input
                        className={`${inputCls} mt-2`}
                        value={r.title}
                        list="editorial-canonical-moments"
                        onChange={(e) => patchRow(leadId, { title: e.target.value })}
                        placeholder="Name this moment (e.g. First Kiss)"
                        aria-label="Moment name"
                      />

                      <textarea
                        className={`${inputCls} mt-2 min-h-[64px] resize-y`}
                        value={r.writeUp}
                        onChange={(e) => patchRow(leadId, { writeUp: e.target.value })}
                        placeholder="Add a short story for this moment (optional)."
                        aria-label="Moment write-up"
                      />
                      <span
                        className={`mt-1 block text-right text-xs ${over ? 'text-burgundy' : 'text-ink/45'}`}
                      >
                        {count}/{WRITEUP_SOFT_CAP}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {/* Features */}
      <section className={card}>
        <h2 className="font-display text-lg italic text-ink">What shows</h2>
        <p className="mt-0.5 text-sm text-ink/60">
          Turn any feature off to keep it off your editorial. The masthead, headline, and hero always show.
        </p>
        <div className="mt-4 space-y-1.5">
          {SECTIONS.map((s) => {
            const on = form.sections[s.key] !== false;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={on}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 text-left transition hover:border-ink/25"
              >
                <span>
                  <span className="block text-sm font-medium text-ink">{s.label}</span>
                  <span className="block text-xs text-ink/55">{s.help}</span>
                </span>
                <span
                  className={`relative h-6 w-11 flex-none rounded-full transition ${on ? 'bg-burgundy' : 'bg-ink/20'}`}
                  aria-hidden
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Save bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {phase === 'done' ? (
            <span className="font-medium text-green-700">
              Saved{form.publish ? ' & published' : ' as a draft'}.
            </span>
          ) : phase === 'error' ? (
            <span className="font-medium text-red-700">{error ?? 'Could not save.'}</span>
          ) : slug ? (
            <Link
              href={`/${slug}?phase=editorial`}
              className="text-ink/60 underline-offset-4 hover:text-burgundy hover:underline"
              target="_blank"
            >
              Preview your editorial ↗
            </Link>
          ) : null}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={phase === 'saving'}
            onClick={() => onSave(false)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-5 text-sm font-medium text-ink/75 transition hover:bg-cream disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={phase === 'saving'}
            onClick={() => onSave(true)}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-burgundy/20 bg-burgundy px-5 text-sm font-semibold text-cream transition hover:bg-burgundy/90 disabled:opacity-50"
          >
            {phase === 'saving' ? 'Saving…' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Share your story — shown once published. Co-locates sharing + the Real
          Stories opt-in so the couple never has to hunt for them on the privacy
          page. The published page's OG card shows the story, so a shared link
          previews beautifully on Facebook/Messenger/Viber. */}
      {form.publish ? (
        <section className={card}>
          <h2 className="font-display text-lg italic text-ink">Share your story</h2>
          <p className="mt-0.5 text-sm text-ink/60">
            Your editorial is published. Share the link — it shows your story as the
            preview card.
          </p>

          {shareUrl ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink/70">
                  {shareUrl.replace(/^https?:\/\//, '')}
                </span>
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="flex-none rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 transition hover:bg-cream/70"
                >
                  Copy link
                </button>
              </div>
              <ShareButtons url={shareUrl} title="Our wedding story on Setnayan" />
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink/55">
              Set your website link first, then come back to share.
            </p>
          )}

          {/* Real Stories opt-in (RA 10173 explicit consent). Wedding-only —
              the public gallery aggregates weddings, so a non-wedding couple
              toggling it would set consent that never surfaces. */}
          {isWedding ? (
          <div className="mt-5 border-t border-ink/10 pt-5">
            <button
              type="button"
              onClick={toggleFeatured}
              disabled={featuring}
              aria-pressed={featured}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 text-left transition hover:border-ink/25 disabled:opacity-60"
            >
              <span>
                <span className="block text-sm font-medium text-ink">
                  Feature our story in Real Stories
                </span>
                <span className="block text-xs text-ink/55">
                  Add our wedding to the public Real Stories gallery, 30 days after
                  the day. You can turn this off anytime.
                </span>
              </span>
              <span
                className={`relative h-6 w-11 flex-none rounded-full transition ${featured ? 'bg-burgundy' : 'bg-ink/20'}`}
                aria-hidden
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${featured ? 'left-[22px]' : 'left-0.5'}`}
                />
              </span>
            </button>

            {featured && landingVisibility === 'private' ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-none" strokeWidth={1.75} />
                <span>
                  Your website is <strong>Private</strong>, so it won&rsquo;t appear in Real
                  Stories yet. Make it Public or Unlisted in{' '}
                  <Link
                    href={`/dashboard/${eventId}/website/privacy`}
                    className="underline underline-offset-2 hover:text-burgundy"
                  >
                    Privacy settings
                  </Link>
                  .
                </span>
              </p>
            ) : null}
          </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
