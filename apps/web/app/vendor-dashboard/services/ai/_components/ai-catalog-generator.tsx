'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  Camera,
  CheckCircle2,
  Loader2,
  Mic,
  PencilLine,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@/lib/vendors';
import type { GeneratedCatalogEntry } from '@/lib/anthropic-catalog';
import {
  generateCatalog,
  generateCatalogFromPhotos,
  generateCatalogFromVoice,
  publishGeneratedCatalog,
} from '../actions';
import { PhotoOcrInput } from './photo-ocr-input';
import { VoiceInput } from './voice-input';

type Props = {
  vendorProfileId: string;
};

type Step = 'input' | 'preview' | 'confirmation';

/**
 * Three input modes for Step 1. All three are now enabled (Text via PR #37,
 * Photo via PR #40 / Claude vision, Voice via PR #41 / OpenAI Whisper).
 * Each input mode produces text that feeds the same Claude catalog
 * generation flow — the shared `entries` / `step` state below doesn't care
 * which mode produced the draft.
 */
type InputMode = 'text' | 'photo' | 'voice';

type EditableEntry = GeneratedCatalogEntry & { id: string };

type PublishSummary = {
  created: number;
  skipped: number;
  errors: string[];
};

const EXAMPLE_DESCRIPTION =
  "I'm a Tagaytay wedding caterer offering 3 packages — bronze for 100 guests at ₱150,000, silver for 150 at ₱220,000, gold for 200 at ₱300,000. Each includes 4 mains, 4 sides, dessert table.";

/**
 * Three-step flow:
 *   1. INPUT — vendor picks a mode (text / photo / voice) and provides input.
 *   2. PREVIEW — vendor reviews/edits cards side-by-side with their input.
 *   3. CONFIRMATION — vendor sees "X services added" and a link back.
 *
 * Names surface in the preview as a sanity-check hint but are not persisted
 * (existing `vendor_services` schema has no `name` column — see the comment
 * in lib/anthropic-catalog.ts).
 *
 * Input modes coordinate by sharing the same `entries` / `step` /
 * `publishSummary` state — once Claude produces a catalog draft, the rest of
 * the flow doesn't care which input mode produced it. Per-mode state
 * (description, photoR2Keys, etc.) lives at this level too so a vendor can
 * flip back to the input step without losing what they typed.
 */
export function AiCatalogGenerator({ vendorProfileId }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [inputMode, setInputMode] = useState<InputMode>('text');

  // Text-mode state.
  const [description, setDescription] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');

  // Photo-mode state. Stores r2://setnayan-media/... refs emitted by
  // FileUpload after each photo finishes uploading.
  const [photoR2Keys, setPhotoR2Keys] = useState<string[]>([]);

  const [entries, setEntries] = useState<EditableEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [publishSummary, setPublishSummary] = useState<PublishSummary | null>(
    null,
  );
  const [isGenerating, startGenerating] = useTransition();
  const [isPublishing, startPublishing] = useTransition();

  const handleGenerate = () => {
    setError(null);
    const trimmed = description.trim();
    if (trimmed.length === 0) {
      setError('Please describe your services first.');
      return;
    }
    startGenerating(async () => {
      const result = await generateCatalog(trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntries(
        result.entries.map((e, idx) => ({
          ...e,
          id: `gen-${idx}-${Date.now()}`,
        })),
      );
      setOriginalDescription(trimmed);
      setStep('preview');
    });
  };

  const handleGenerateFromPhotos = () => {
    setError(null);
    if (photoR2Keys.length === 0) {
      setError('Upload at least one menu photo first.');
      return;
    }
    startGenerating(async () => {
      const result = await generateCatalogFromPhotos(
        vendorProfileId,
        photoR2Keys,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntries(
        result.entries.map((e, idx) => ({
          ...e,
          id: `ocr-${idx}-${Date.now()}`,
        })),
      );
      // Use a synthetic "description" so the preview's left panel still has
      // useful context. Doesn't affect publish.
      setOriginalDescription(
        `Extracted from ${photoR2Keys.length} menu photo${photoR2Keys.length === 1 ? '' : 's'}.`,
      );
      setStep('preview');
    });
  };

  const handleGenerateFromVoice = (transcript: string) => {
    setError(null);
    if (!transcript.trim()) {
      setError('Record and transcribe before generating.');
      return;
    }
    startGenerating(async () => {
      const result = await generateCatalogFromVoice(vendorProfileId, transcript);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntries(
        result.entries.map((e, idx) => ({
          ...e,
          id: `voice-${idx}-${Date.now()}`,
        })),
      );
      setOriginalDescription(transcript);
      setStep('preview');
    });
  };

  const handleUseExample = () => {
    setDescription(EXAMPLE_DESCRIPTION);
  };

  const updateEntry = (id: string, patch: Partial<EditableEntry>) => {
    setEntries((curr) =>
      curr.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  };

  const deleteEntry = (id: string) => {
    setEntries((curr) => curr.filter((e) => e.id !== id));
  };

  const addBlankEntry = () => {
    setEntries((curr) => [
      ...curr,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: 'New service',
        category: 'misc',
        starting_price_php: 0,
        is_active: true,
      },
    ]);
  };

  const handlePublish = () => {
    setError(null);
    if (entries.length === 0) {
      setError('Add at least one service before publishing.');
      return;
    }
    // Strip the client-only `id` field before sending to the server action.
    const payload: GeneratedCatalogEntry[] = entries.map(
      ({ id: _id, ...rest }) => rest,
    );
    startPublishing(async () => {
      const result = await publishGeneratedCatalog(payload);
      setPublishSummary({
        created: result.created,
        skipped: result.skipped,
        errors: result.errors,
      });
      if (result.ok || result.created > 0) {
        setStep('confirmation');
      } else {
        setError(
          result.errors.length > 0
            ? result.errors.join(' ')
            : 'Could not publish services.',
        );
      }
    });
  };

  const handleStartOver = () => {
    setStep('input');
    setEntries([]);
    setError(null);
    setPublishSummary(null);
    setOriginalDescription('');
    setPhotoR2Keys([]);
    // Keep the user's last `description` and `inputMode` so re-entering the
    // flow doesn't wipe their work; only clear what the new run will replace.
  };

  if (step === 'input') {
    return (
      <div className="space-y-4">
        {/* 3-tab toggle. All three modes are live as of PR #41. */}
        <div
          role="tablist"
          aria-label="Catalog input mode"
          className="inline-flex rounded-xl border border-ink/10 bg-cream p-1"
        >
          <TabButton
            mode="text"
            active={inputMode === 'text'}
            disabled={isGenerating}
            onSelect={() => {
              setInputMode('text');
              setError(null);
            }}
            icon={<PencilLine aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Text"
          />
          <TabButton
            mode="photo"
            active={inputMode === 'photo'}
            disabled={isGenerating}
            onSelect={() => {
              setInputMode('photo');
              setError(null);
            }}
            icon={<Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Photo"
          />
          <TabButton
            mode="voice"
            active={inputMode === 'voice'}
            disabled={isGenerating}
            onSelect={() => {
              setInputMode('voice');
              setError(null);
            }}
            icon={<Mic aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Voice"
          />
        </div>

        {inputMode === 'text' ? (
          <div className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
            <div className="space-y-1">
              <label
                htmlFor="ai-description"
                className="block text-sm font-medium text-ink"
              >
                Tell me about your services in plain English
              </label>
              <p className="text-xs text-ink/60">
                Mention what you offer, your packages, pricing, and what&rsquo;s
                included. The more detail you give, the better the draft.
              </p>
            </div>

            <textarea
              id="ai-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              placeholder={EXAMPLE_DESCRIPTION}
              className="input-field w-full resize-y font-sans text-sm leading-relaxed"
              maxLength={4000}
              disabled={isGenerating}
            />

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleUseExample}
                disabled={isGenerating}
                className="text-xs text-ink/60 underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
              >
                Use example
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
                {description.length} / 4000
              </span>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
              >
                {error}
              </p>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || description.trim().length === 0}
                className="button-primary inline-flex items-center gap-2"
                aria-busy={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2
                      aria-hidden
                      className="h-4 w-4 animate-spin"
                      strokeWidth={2.25}
                    />
                    Generating&hellip;
                  </>
                ) : (
                  <>
                    <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    Generate catalog
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}

        {inputMode === 'photo' ? (
          <PhotoOcrInput
            vendorProfileId={vendorProfileId}
            photoR2Keys={photoR2Keys}
            onChange={setPhotoR2Keys}
            onGenerate={handleGenerateFromPhotos}
            isGenerating={isGenerating}
            error={error}
          />
        ) : null}

        {inputMode === 'voice' ? (
          <VoiceInput
            vendorProfileId={vendorProfileId}
            disabled={isGenerating}
            onSubmit={handleGenerateFromVoice}
          />
        ) : null}
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          {/* Left — vendor's original description (read-only). */}
          <aside className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Your description
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
              {originalDescription}
            </p>
            <button
              type="button"
              onClick={handleStartOver}
              className="text-xs text-ink/55 underline-offset-4 hover:text-ink hover:underline"
            >
              Edit description
            </button>
          </aside>

          {/* Right — editable cards. */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                Draft catalog ({entries.length})
              </h2>
              <button
                type="button"
                onClick={addBlankEntry}
                className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/75 hover:border-ink/30 hover:text-ink"
              >
                <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Add service
              </button>
            </div>

            {entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-8 text-center text-sm text-ink/60">
                No services in this draft. Add one manually or{' '}
                <button
                  type="button"
                  onClick={handleStartOver}
                  className="underline underline-offset-4 hover:text-ink"
                >
                  rewrite your description
                </button>
                .
              </div>
            ) : (
              <ul className="space-y-3">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className={`space-y-3 rounded-2xl border bg-cream p-4 ${
                      entry.is_active ? 'border-ink/10' : 'border-ink/10 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) =>
                            updateEntry(entry.id, { name: e.target.value })
                          }
                          className="input-field w-full font-semibold text-ink"
                          aria-label="Service name"
                          maxLength={120}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteEntry(entry.id)}
                        aria-label="Delete service"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink/5 text-ink/70 hover:bg-terracotta/10 hover:text-terracotta"
                      >
                        <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="block text-xs font-medium text-ink/70">
                          Category
                        </span>
                        <select
                          value={entry.category}
                          onChange={(e) =>
                            updateEntry(entry.id, {
                              category: e.target.value as VendorCategory,
                            })
                          }
                          className="input-field"
                        >
                          {VENDOR_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {VENDOR_CATEGORY_LABEL[c]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block space-y-1">
                        <span className="block text-xs font-medium text-ink/70">
                          Starting price (PHP)
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={Math.round(entry.starting_price_php / 100)}
                          onChange={(e) => {
                            const pesos = Number(e.target.value);
                            updateEntry(entry.id, {
                              starting_price_php: Number.isFinite(pesos)
                                ? Math.max(0, Math.round(pesos)) * 100
                                : 0,
                            });
                          }}
                          className="input-field"
                          placeholder="e.g. 150000"
                        />
                      </label>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-ink/75">
                      <input
                        type="checkbox"
                        checked={entry.is_active}
                        onChange={(e) =>
                          updateEntry(entry.id, { is_active: e.target.checked })
                        }
                        className="h-4 w-4 cursor-pointer accent-terracotta"
                      />
                      <span>Active (visible in the marketplace)</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
          >
            {error}
          </p>
        ) : null}

        <div className="rounded-md border border-ink/10 bg-cream p-3 text-xs text-ink/60">
          <strong className="font-medium text-ink/80">Note:</strong> The current
          schema allows one service per category. If multiple cards share a
          category, only the lowest-priced one is saved (as the &ldquo;starting
          price&rdquo;) — you can split tiers later from the Services page.
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/vendor-dashboard/services"
            className="text-xs text-ink/55 hover:text-ink"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing || entries.length === 0}
            className="button-primary inline-flex items-center gap-2"
            aria-busy={isPublishing}
          >
            {isPublishing ? (
              <>
                <Loader2
                  aria-hidden
                  className="h-4 w-4 animate-spin"
                  strokeWidth={2.25}
                />
                Publishing&hellip;
              </>
            ) : (
              <>Publish all ({entries.length})</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // step === 'confirmation'
  const summary = publishSummary ?? { created: 0, skipped: 0, errors: [] };
  return (
    <div className="space-y-5 rounded-2xl border border-emerald-300/50 bg-emerald-50 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 aria-hidden className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <h2 className="text-xl font-semibold text-emerald-900">
          {summary.created === 0
            ? 'No new services published'
            : `${summary.created} service${summary.created === 1 ? '' : 's'} added to your catalog`}
        </h2>
      </div>

      {summary.skipped > 0 || summary.errors.length > 0 ? (
        <div className="space-y-1 rounded-md border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900">
          {summary.skipped > 0 ? (
            <p>
              {summary.skipped} service
              {summary.skipped === 1 ? '' : 's'} skipped (you already had that
              category — edit it on the Services page).
            </p>
          ) : null}
          {summary.errors.map((e, i) => (
            <p key={i} className="text-xs">
              {e}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/vendor-dashboard/services"
          className="button-primary text-center"
        >
          View my services
        </Link>
        <button
          type="button"
          onClick={handleStartOver}
          className="button-secondary text-center"
        >
          Generate another
        </button>
      </div>
    </div>
  );
}

/**
 * Single-tab pill used in the 3-tab input-mode toggle. Kept as a small
 * sibling component (rather than a `tab` prop on the parent) so the Voice
 * tab's `disabled + comingSoon` styling stays declarative.
 */
function TabButton(props: {
  mode: InputMode;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  comingSoon?: boolean;
}) {
  const { active, disabled, onSelect, icon, label, comingSoon } = props;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors ${
        active
          ? 'bg-terracotta text-cream'
          : disabled
            ? 'cursor-not-allowed text-ink/35'
            : 'text-ink/65 hover:text-ink'
      }`}
    >
      {icon}
      <span>{label}</span>
      {comingSoon ? (
        <span className="ml-1 rounded-full bg-ink/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/55">
          Soon
        </span>
      ) : null}
    </button>
  );
}
