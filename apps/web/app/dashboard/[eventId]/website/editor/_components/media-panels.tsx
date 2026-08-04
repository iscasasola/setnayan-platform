'use client';

import { useFormStatus } from 'react-dom';
import { FileUpload } from '@/app/_components/file-upload';

/**
 * Media + choice panels for the unified editor (PR-6) — the WYSIWYG push.
 *
 * Owner 2026-07-25: *"they should not need to jump to multiple pages to edit a
 * single website … like any WYSIWYG website editor but focused on their event."*
 * These panels bring the picture-and-sound settings INTO the rail, beside the
 * live preview, instead of sending the couple to a separate page each time.
 *
 * Every panel is a plain `<form action={serverAction}>` posting to the SAME
 * action its old sub-page used — the single write layer is untouched — plus the
 * hidden `return_to` that brings the couple back to the editor with the row open
 * (lib/editor-return.ts). `<FileUpload>` is the shared uploader those pages
 * already used, with identical bucket / prefix / MIME / size settings, so the R2
 * path and validation behaviour are unchanged.
 */

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav'];

function ReturnTo({ eventId, rowKey }: { eventId: string; rowKey: string }) {
  return (
    <input
      type="hidden"
      name="return_to"
      value={`/dashboard/${eventId}/website/editor?open=${rowKey}`}
    />
  );
}

function SaveButton({ label = 'Save' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-ink/90 disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

const PANEL = 'border-t border-dashed border-ink/10 bg-cream/40 p-3';

/** Hero photo — the picture at the top of the page. */
export function HeroPhotoPanel({
  action,
  eventId,
  currentRef,
  displayUrls,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  currentRef: string | null;
  displayUrls?: Record<string, string>;
}) {
  return (
    <form action={action} className={PANEL}>
      <input type="hidden" name="event_id" value={eventId} />
      <ReturnTo eventId={eventId} rowKey="hero" />
      <FileUpload
        bucket="media"
        pathPrefix={`events/${eventId}/landing-page-hero`}
        name="hero_image_url"
        multiple={false}
        maxSizeMB={10}
        acceptedTypes={IMAGE_TYPES}
        currentValue={currentRef}
        initialDisplayUrls={displayUrls}
        label="Hero photo"
        help="Shown at the top of your page. JPG, PNG or WebP up to 10 MB."
      />
      <SaveButton />
    </form>
  );
}

/** Photo gallery — the couple's own shots (Website Pro). */
export function GalleryPanel({
  action,
  eventId,
  currentRefs,
  displayUrls,
  maxFiles,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  currentRefs: string[];
  displayUrls?: Record<string, string>;
  maxFiles: number;
}) {
  return (
    <form action={action} className={PANEL}>
      <ReturnTo eventId={eventId} rowKey="gallery" />
      <FileUpload
        bucket="media"
        pathPrefix={`events/${eventId}/our-photos`}
        name="photos"
        multiple
        maxFiles={maxFiles}
        maxSizeMB={10}
        acceptedTypes={IMAGE_TYPES}
        currentValue={currentRefs}
        initialDisplayUrls={displayUrls}
        label="Your photos"
        help={`Engagement or pre-wedding shots — up to ${maxFiles}.`}
      />
      <SaveButton />
    </form>
  );
}

/**
 * Background music (Website Pro) + the hero video, which share one action.
 * ⚠ Both controls must post together: `updateSiteChrome` writes a column only
 * when the form carried its field (the omit-when-untouched hardening from PR
 * #3642), so rendering just one here would leave the other untouched — correct,
 * but the couple would not see it. We render both, matching the sub-page.
 */
export function SiteChromePanel({
  action,
  eventId,
  musicRef,
  musicEnabled,
  musicDisplay,
  videoRef,
  videoDisplay,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  musicRef: string | null;
  musicEnabled: boolean;
  musicDisplay?: Record<string, string>;
  videoRef: string | null;
  videoDisplay?: Record<string, string>;
}) {
  return (
    <form action={action} className={PANEL}>
      <ReturnTo eventId={eventId} rowKey="music" />
      <FileUpload
        bucket="media"
        pathPrefix={`events/${eventId}/site-music`}
        name="bg_music_url"
        multiple={false}
        maxSizeMB={20}
        acceptedTypes={AUDIO_TYPES}
        currentValue={musicRef}
        initialDisplayUrls={musicDisplay}
        label="Background music"
        help="Plays only when a guest taps the speaker — never on its own."
      />
      <label className="mt-2 flex items-center gap-2 text-xs text-ink/70">
        <input
          type="checkbox"
          name="bg_music_enabled"
          defaultChecked={musicEnabled}
          className="h-3.5 w-3.5 rounded border-ink/30"
        />
        Play music on my website
      </label>
      <div className="mt-3 border-t border-ink/10 pt-3">
        <FileUpload
          bucket="media"
          pathPrefix={`events/${eventId}/landing-page-hero-video`}
          name="hero_video_url"
          multiple={false}
          maxSizeMB={100}
          acceptedTypes={['video/mp4', 'video/quicktime', 'video/webm']}
          currentValue={videoRef}
          initialDisplayUrls={videoDisplay}
          label="Hero video (free)"
          help="Plays in place of the hero photo when set."
        />
      </div>
      <SaveButton />
    </form>
  );
}

/** Who can view — the visibility choice, inline. */
export function VisibilityPanel({
  action,
  eventId,
  visibility,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  visibility: 'public' | 'unlisted' | 'private';
}) {
  return (
    <form action={action} className={PANEL}>
      <input type="hidden" name="event_id" value={eventId} />
      <ReturnTo eventId={eventId} rowKey="visibility" />
      <fieldset>
        <legend className="mb-1.5 text-[0.7rem] font-semibold text-ink/60">
          Who can open your website
        </legend>
        {(
          [
            ['private', 'Private', 'Only you and your hosts.'],
            ['unlisted', 'Unlisted', 'Anyone with the link — not listed publicly.'],
            ['public', 'Public', 'Anyone can find and open it.'],
          ] as const
        ).map(([value, label, hint]) => (
          <label
            key={value}
            className="mb-1 flex cursor-pointer items-start gap-2 rounded-lg bg-white px-2.5 py-2"
          >
            <input
              type="radio"
              name="visibility"
              value={value}
              defaultChecked={visibility === value}
              className="mt-0.5 h-3.5 w-3.5"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-ink">{label}</span>
              <span className="block text-[0.7rem] text-ink/50">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <SaveButton />
    </form>
  );
}

/** Open browsing — the five-tab master switch, flipped inline (owner 2026-07-25). */
export function OpenBrowsePanel({
  action,
  eventId,
  on,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  on: boolean;
}) {
  return (
    <form action={action} className={PANEL}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="open_browse" value={on ? '0' : '1'} />
      <ReturnTo eventId={eventId} rowKey="open-browse" />
      <p className="text-xs text-ink/60">
        {on
          ? 'Guests can browse every page of your site from day one — the five-tab site.'
          : 'Guests currently see only the page for the current moment (invitation, day-of, after).'}
      </p>
      <SaveButton label={on ? 'Turn off open browsing' : 'Turn on open browsing'} />
    </form>
  );
}
