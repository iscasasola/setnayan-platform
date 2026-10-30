'use client';

/**
 * picture-and-icon.tsx — the "Look" fold of a category: the card exactly as couples see it, beside the two controls
 * that change it. Icon ▾ saves on pick ("Group default" clears it); the photo SAVES THE MOMENT IT IS CHOSEN (owner
 * 2026-10-29 panels approved — no "Save photo" button), Clear removes it. Both through the shipped actions
 * (`setCategoryIcon` · `setCategoryPhoto`), answered in place (`mapWriteForm`), each with Undo.
 */
import { useState } from 'react';
import { Circle } from 'lucide-react';
import { getLucideIcon } from '@/lib/nav-icons';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { FileUpload } from '@/app/_components/file-upload';
import { Row, postForm, useInPlace } from './drawer-kit';

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
}: {
  id: string;
  label: string;
  iconName: string | null;
  /** The icon couples see when none is set (the group's). */
  defaultIcon: string | null;
  photoRaw: string | null;
  photoUrl: string | null;
  iconNames: readonly string[];
}) {
  const [icon, setIcon] = useState(iconName);
  const [photo, setPhoto] = useState(photoUrl);
  const [ref, setRef] = useState(photoRaw);
  const iconRun = useInPlace();
  const photoRun = useInPlace();
  const saveIcon = (key: string) => postForm('icon', { category_id: id, icon_name: key });
  const save = (r: string) => postForm('photo', { category_id: id, photo_ref: r });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start" data-picture-and-icon="">
      <div className="w-full max-w-[200px] shrink-0 overflow-hidden rounded-2xl bg-raised shadow-[0_0_0_1px_rgb(var(--color-ink)/0.08)]" aria-label={`${label} as couples see it`}>
        <div className="flex h-24 items-center justify-center bg-ink/5">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed preview of our own upload
            <img src={photo} alt="" className="h-full w-full object-cover" aria-hidden />
          ) : (
            <Icon name={icon} fallback={defaultIcon} className="h-9 w-9 text-terracotta" />
          )}
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Icon name={icon} fallback={defaultIcon} className="h-4 w-4 shrink-0 text-ink/70" />
          <span className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">{label}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Row label="Icon">
          <span className={iconRun.pending ? 'opacity-60' : undefined}>
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
                const before = icon ?? '';
                if (key === before) return;
                setIcon(key || null);
                iconRun.run(() => saveIcon(key), {
                  what: 'Icon',
                  said: `Icon — ${key || 'group default'}`,
                  undo: async () => {
                    setIcon(before || null);
                    return saveIcon(before);
                  },
                  onDone: (r) => {
                    if (!r.ok) setIcon(before || null);
                  },
                });
              }}
            />
          </span>
        </Row>
        <div className={photoRun.pending ? 'opacity-60' : undefined} data-photo-form="">
          <Row label="Photo">
            <FileUpload
              bucket="samples"
              pathPrefix={`taxonomy/${id}`}
              name="photo_ref"
              currentValue={ref}
              initialDisplayUrls={photoRaw && photoUrl ? { [photoRaw]: photoUrl } : undefined}
              unsavedHint={null}
              maxSizeMB={5}
              acceptedTypes={['image/webp', 'image/jpeg', 'image/png']}
              variant="square"
              onChange={(v) => {
                if (typeof v !== 'string' || v === ref) return;
                const before = ref ?? '';
                setRef(v);
                setPhoto(v);
                photoRun.run(() => save(v), { what: 'Photo', said: 'Photo saved', undo: () => save(before) });
              }}
            />
          </Row>
          {ref ? (
            <div className="pl-[112px] sm:pl-[140px]">
              <button
                type="button"
                onClick={() => {
                  const before = ref;
                  setRef(null);
                  setPhoto(null);
                  photoRun.run(() => save(''), { what: 'Photo', said: 'Photo cleared', undo: () => save(before) });
                }}
                className="sn-press inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm font-semibold text-ink"
              >
                Clear photo
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
