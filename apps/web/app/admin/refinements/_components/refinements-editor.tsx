'use client';

/**
 * RefinementsEditor — the admin CRUD UI for the onboarding "what kind of X?"
 * refinements (owner 2026-06-09). A collapsible card per leaf; expand to edit the
 * leaf (label · description · status · main photo) and its options (emoji · label ·
 * photo · status · add/remove). Each editable unit is its own `<form action={…}>`
 * bound to a server action. Photos upload to R2 via <FileUpload> (the seeded photos
 * stay as /public paths until replaced); getOnboardingRefinements resolves the refs.
 */
import { useState } from 'react';
import { ChevronDown, Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { updateLeaf, updateOption, addOption, removeOption } from '../actions';

export type EditorOption = {
  optionKey: string;
  emoji: string;
  label: string;
  status: string;
  photoRaw: string | null;
  photoUrl: string | null;
};
export type EditorLeaf = {
  leafKey: string;
  label: string;
  description: string;
  status: string;
  dynamic: boolean;
  /** Projectable leaf (catering / photo_video) — its option keys feed vendor matching,
   *  so the option SET is fixed (label/emoji/photo are editable, add/remove are not). */
  isProjectable: boolean;
  mainPhotoRaw: string | null;
  mainPhotoUrl: string | null;
  options: EditorOption[];
};

const IMG_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="h-16 w-[5.33rem] shrink-0 rounded-md object-cover ring-1 ring-ink/10" />
  ) : (
    <div className="flex h-16 w-[5.33rem] shrink-0 items-center justify-center rounded-md bg-ink/5 text-ink/30 ring-1 ring-ink/10">
      <ImageIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
    </div>
  );
}

export function RefinementsEditor({ leaves }: { leaves: EditorLeaf[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2.5">
      {leaves.map((leaf) => (
        <LeafCard
          key={leaf.leafKey}
          leaf={leaf}
          open={open === leaf.leafKey}
          onToggle={() => setOpen((o) => (o === leaf.leafKey ? null : leaf.leafKey))}
        />
      ))}
    </div>
  );
}

function LeafCard({ leaf, open, onToggle }: { leaf: EditorLeaf; open: boolean; onToggle: () => void }) {
  const activeOpts = leaf.options.filter((o) => o.status === 'active').length;
  return (
    <div className={`rounded-2xl border bg-cream/40 ${leaf.status === 'retired' ? 'border-ink/10 opacity-60' : 'border-ink/10'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <Thumb url={leaf.mainPhotoUrl} alt={leaf.label} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">{leaf.label}</span>
            {leaf.status === 'retired' ? (
              <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink/50">retired</span>
            ) : null}
            {leaf.dynamic ? (
              <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-terracotta">faith-adaptive</span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink/55">
            <code className="font-mono">{leaf.leafKey}</code> · {leaf.dynamic ? 'options come from the faith picker' : `${activeOpts} option${activeOpts === 1 ? '' : 's'}`}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink/40 transition ${open ? 'rotate-180' : ''}`} strokeWidth={1.75} aria-hidden />
      </button>

      {open ? (
        <div className="space-y-5 border-t border-ink/10 px-5 py-5">
          {/* Leaf fields */}
          <form action={updateLeaf.bind(null, leaf.leafKey)} className="space-y-3">
            <input type="hidden" name="main_photo_current" value={leaf.mainPhotoRaw ?? ''} />
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-ink">Label</span>
              <input name="label_en" required defaultValue={leaf.label} className="input-field" />
            </label>
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-ink">Description <span className="text-ink/45">(shown under the main photo)</span></span>
              <input name="description_en" defaultValue={leaf.description} className="input-field" placeholder="e.g. The centerpiece sweet of your reception." />
            </label>
            <div className="flex items-start gap-4">
              <div className="space-y-1">
                <span className="block text-xs font-medium text-ink">Main photo</span>
                <Thumb url={leaf.mainPhotoUrl} alt={leaf.label} />
              </div>
              <div className="flex-1">
                <FileUpload
                  bucket="samples"
                  pathPrefix={`refinements/${leaf.leafKey}`}
                  name="main_photo_url"
                  maxSizeMB={5}
                  acceptedTypes={IMG_TYPES}
                  variant="wide"
                  label="Replace main photo"
                  help="WEBP/JPG/PNG, 4:3 looks best. Leave empty to keep the current one."
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="status" value="retired" defaultChecked={leaf.status === 'retired'} className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta" />
              Hide this service from onboarding (retire)
            </label>
            <SubmitButton className="button-primary inline-flex items-center gap-2" pendingLabel="Saving…">Save service</SubmitButton>
          </form>

          {/* Options */}
          {leaf.dynamic ? (
            <p className="rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-xs text-ink/55">
              This service is <strong>faith-adaptive</strong> — its options (church / mosque / temple / garden / beach / civil …) come from the couple’s faith pick, with photos from the shared <code className="font-mono">/onboarding/prefs</code> set. Edit the label / description / main photo above.
            </p>
          ) : (
            <div className="space-y-2.5">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">Options</h3>
              {leaf.options.map((o) => (
                <OptionRow key={o.optionKey} leafKey={leaf.leafKey} option={o} canDelete={!leaf.isProjectable} />
              ))}
              {leaf.isProjectable ? (
                <p className="rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-xs text-ink/55">
                  These options are <strong>reserved</strong> — their keys drive vendor matching, so the set is fixed. You can edit each option’s label, emoji, and photo above, but can’t add or remove options here.
                </p>
              ) : (
              /* Add option */
              <form action={addOption.bind(null, leaf.leafKey)} className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-ink/20 p-3">
                <label className="space-y-1">
                  <span className="block text-[11px] font-medium text-ink/70">Emoji</span>
                  <input name="emoji" maxLength={4} className="input-field w-16 text-center" placeholder="🎂" />
                </label>
                <label className="flex-1 space-y-1" style={{ minWidth: 160 }}>
                  <span className="block text-[11px] font-medium text-ink/70">New option label</span>
                  <input name="label_en" className="input-field" placeholder="e.g. Glazed" />
                </label>
                <div className="space-y-1">
                  <span className="block text-[11px] font-medium text-ink/70">Photo (optional)</span>
                  <FileUpload bucket="samples" pathPrefix={`refinements/${leaf.leafKey}`} name="photo_url" maxSizeMB={5} acceptedTypes={IMG_TYPES} variant="square" />
                </div>
                <SubmitButton className="button-secondary inline-flex items-center gap-1.5" pendingLabel="Adding…">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Add
                </SubmitButton>
              </form>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OptionRow({ leafKey, option, canDelete }: { leafKey: string; option: EditorOption; canDelete: boolean }) {
  return (
    <div className={`rounded-xl border border-ink/10 bg-white p-3 ${option.status === 'retired' ? 'opacity-60' : ''}`}>
      <form action={updateOption.bind(null, leafKey, option.optionKey)} className="flex flex-wrap items-end gap-2.5">
        <input type="hidden" name="photo_current" value={option.photoRaw ?? ''} />
        <Thumb url={option.photoUrl} alt={option.label} />
        <label className="space-y-1">
          <span className="block text-[11px] font-medium text-ink/70">Emoji</span>
          <input name="emoji" maxLength={4} defaultValue={option.emoji} className="input-field w-16 text-center" />
        </label>
        <label className="flex-1 space-y-1" style={{ minWidth: 140 }}>
          <span className="block text-[11px] font-medium text-ink/70">Label</span>
          <input name="label_en" required defaultValue={option.label} className="input-field" />
        </label>
        <div className="space-y-1">
          <span className="block text-[11px] font-medium text-ink/70">Replace photo</span>
          <FileUpload bucket="samples" pathPrefix={`refinements/${leafKey}`} name="photo_url" maxSizeMB={5} acceptedTypes={IMG_TYPES} variant="square" />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink/70">
          <input type="checkbox" name="status" value="retired" defaultChecked={option.status === 'retired'} className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta" />
          Retire
        </label>
        <SubmitButton className="button-primary !px-3 !py-1.5 text-xs" pendingLabel="…">Save</SubmitButton>
      </form>
      {canDelete ? (
        <form action={removeOption.bind(null, leafKey, option.optionKey)} className="mt-1.5 text-right">
          <SubmitButton className="inline-flex items-center gap-1 text-[11px] text-ink/45 hover:text-red-600" pendingLabel="Deleting…">
            <Trash2 className="h-3 w-3" strokeWidth={1.75} aria-hidden /> Delete option
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
