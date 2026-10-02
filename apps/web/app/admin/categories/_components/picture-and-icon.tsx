'use client';

/**
 * picture-and-icon.tsx — the "Picture & icon" section of a category (or a
 * group): the card exactly as couples see it, beside the two controls that
 * change it. Icon ▾ saves on pick (setCategoryIcon; "Group default" clears
 * it); the photo uploads to the samples bucket and saves with Save photo
 * (setCategoryPhoto; Clear removes it). Both are the shipped actions.
 */
import { useState, useTransition } from 'react';
import { Circle, ImageIcon } from 'lucide-react';
import { getLucideIcon } from '@/lib/nav-icons';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FileUpload } from '@/app/_components/file-upload';
import { SubmitButton } from '@/app/_components/submit-button';
import { setCategoryIcon, setCategoryPhoto } from '../actions';

function Icon({ name, fallback, className }: { name: string | null; fallback: string | null; className: string }) {
  const C = getLucideIcon(name) ?? getLucideIcon(fallback) ?? Circle;
  return <C className={className} strokeWidth={1.75} aria-hidden />;
}

export function PictureAndIcon({
  id,
  label,
  iconName,
  defaultIcon,
  photoRaw,
  photoUrl,
  iconNames,
  back,
}: {
  id: string;
  label: string;
  iconName: string | null;
  /** The icon couples see when none is set (the group's). */
  defaultIcon: string | null;
  photoRaw: string | null;
  photoUrl: string | null;
  iconNames: readonly string[];
  back: Record<string, string>;
}) {
  const [icon, setIcon] = useState(iconName);
  const [photo, setPhoto] = useState(photoUrl);
  const [pending, start] = useTransition();
  const hidden = Object.entries(back).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start" data-picture-and-icon="">
      <div className="w-full max-w-[200px] shrink-0 overflow-hidden rounded-2xl bg-white" aria-label={`${label} as couples see it`}>
        <div className="flex h-24 items-center justify-center bg-cream">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed preview of our own upload
            <img src={photo} alt="" className="h-full w-full object-cover" aria-hidden />
          ) : (
            <Icon name={icon} fallback={defaultIcon} className="h-9 w-9 text-terracotta" />
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Icon name={icon} fallback={defaultIcon} className="h-4 w-4 shrink-0 text-ink/70" />
          <span className="truncate text-sm font-semibold text-ink">{label}</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className={`flex items-center gap-2 ${pending ? 'opacity-60' : ''}`}>
          <span className="w-14 shrink-0 text-xs font-medium text-ink/70">Icon</span>
          <PickMenu
            label="Icon"
            value={icon ?? ''}
            buttonText={icon ?? 'Group default'}
            options={[
              { key: '', label: 'Group default' },
              ...iconNames.map((n) => ({ key: n, label: n, icon: <Icon name={n} fallback={null} className="h-4 w-4" /> })),
            ]}
            compact
            className="border border-ink/15"
            onPick={(key) => {
              setIcon(key || null);
              const fd = new FormData();
              for (const [k, v] of Object.entries(back)) fd.set(k, v);
              fd.set('category_id', id);
              fd.set('icon_name', key);
              start(async () => {
                await setCategoryIcon(fd);
              });
            }}
          />
        </div>

        {/* ONE photo_ref per form. The Studio carried the stored ref in a hidden
            input placed BEFORE the uploader's own, so FormData.get() always
            returned the OLD value and a new upload (or Clear) saved nothing.
            The uploader now carries the current ref itself, and Clear is its
            own form. */}
        <form action={setCategoryPhoto} className="space-y-2" data-photo-form="">
          {hidden}
          <input type="hidden" name="category_id" value={id} />
          <div className="flex items-start gap-2">
            <span className="w-14 shrink-0 pt-1 text-xs font-medium text-ink/70">Photo</span>
            <div className="min-w-0 flex-1">
              <FileUpload
                bucket="samples"
                pathPrefix={`taxonomy/${id}`}
                name="photo_ref"
                currentValue={photoRaw}
                initialDisplayUrls={photoRaw && photoUrl ? { [photoRaw]: photoUrl } : undefined}
                unsavedHint="press Save photo"
                maxSizeMB={5}
                acceptedTypes={['image/webp', 'image/jpeg', 'image/png']}
                variant="square"
                onChange={(v) => {
                  if (typeof v === 'string') setPhoto(v);
                }}
              />
            </div>
            {!photo ? <ImageIcon className="mt-1 h-4 w-4 shrink-0 text-ink/30" aria-hidden /> : null}
          </div>
          <div className="pl-16">
            <SubmitButton className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream" pendingLabel="Saving…">
              Save photo
            </SubmitButton>
          </div>
        </form>
        {photoRaw ? (
          <form action={setCategoryPhoto} className="pl-16">
            {hidden}
            <input type="hidden" name="category_id" value={id} />
            <input type="hidden" name="photo_ref" value="" />
            <SubmitButton className="text-xs font-medium text-ink/70 underline hover:text-ink" pendingLabel="Clearing…">
              Clear photo
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}
