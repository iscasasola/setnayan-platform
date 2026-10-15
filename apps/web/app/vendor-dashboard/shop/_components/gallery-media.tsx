'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Images } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { useToast } from '@/app/_components/toast/toast-provider';
import { InstagramConnectCard } from '@/app/vendor-dashboard/_components/instagram-connect-card';
import { VideoLinksEditor } from '@/app/vendor-dashboard/_components/video-links-editor';
import type { VendorIgConnectionStatus, VendorIgMediaRow } from '@/lib/vendor-instagram-status';
import { updateVendorProfileField } from '../../actions';
import { CouldNotLoad } from './could-not-load';

/*
 * GALLERY & MEDIA — MOVED, NOT REWRITTEN, out of `website-editor.tsx` (simpler supplier dashboard step 5,
 * 2026-10-14). The website editor's curation controls became Your page's parts (`website/_components/page-parts.tsx`,
 * a draft and one Apply); the three media editors — portfolio photos, featured videos, Instagram — are what a
 * supplier ADDS, so they are Your collections' "Add photos" (`#gallery-media`, the Instagram callback's landing).
 * Each keeps its own Save: an upload is storing a photo, not publishing the page — whether the gallery shows is the
 * page's Photos switch.
 */
/* ─── Gallery & media (ALL TIERS) ───────────────────────────────────────────
 * The three editors relocated from the retired /vendor-dashboard/profile page
 * (2026-07-05): portfolio photos, featured videos, and Instagram. Every vendor
 * (Free included) can curate their gallery — these are NOT tier-gated.
 *
 * Portfolio + videos persist via the single-field `updateVendorProfileField`
 * action (the SAME parse/tier-cap/QR-guard/repost-hash the retired full form
 * used), each with an inline Save button that appears when the field is dirty
 * (matches the About/address save pattern in this editor). Instagram keeps its
 * own OAuth connect/callback/sync routes UNCHANGED. */
export function GalleryMedia({
  vendorProfileId,
  portfolioRefs,
  portfolioDisplayMap,
  portfolioMax,
  galleryVideoLinks,
  igConfigured,
  igConnection,
  igUnavailable,
  igMedia,
  igFlash,
}: {
  vendorProfileId: string;
  portfolioRefs: string[];
  portfolioDisplayMap: Record<string, string>;
  portfolioMax: number;
  galleryVideoLinks: string[];
  igConfigured: boolean;
  igConnection: VendorIgConnectionStatus | null;
  /* `connection: null` is ALSO what "never connected" looks like, so the card
     cannot tell the two apart on its own. */
  igUnavailable?: boolean;
  igMedia: VendorIgMediaRow[];
  igFlash: { kind: 'ok' | 'error'; message: string } | null;
}) {
  const toast = useToast();

  return (
    <section
      className="space-y-5"
    >
      <div className="flex items-center gap-1.5">
        <Images
          className="h-4 w-4"
          strokeWidth={1.75}
          aria-hidden
          style={{ color: 'var(--m-orange-2)' }}
        />
        <h3 className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          Gallery &amp; media
        </h3>
      </div>

      {/* Portfolio photos — same <FileUpload> the retired /profile page used
          (multiple · tier maxFiles · watermark · qrGuard). */}
      <GalleryForm
        field="portfolio"
        toast={toast}
        successToast="Portfolio saved."
        title="Portfolio photos"
        hint={`up to ${portfolioMax >= 999 ? 'unlimited' : portfolioMax}, 5 MB each`}
      >
        <FileUpload
          bucket="media"
          pathPrefix={`vendors/${vendorProfileId}/portfolio`}
          name="portfolio_r2_keys"
          unsavedHint="press Save below"
          currentValue={portfolioRefs}
          initialDisplayUrls={portfolioDisplayMap}
          multiple
          maxFiles={portfolioMax}
          maxSizeMB={5}
          acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
          variant="wide"
          watermark
          qrGuard
        />
      </GalleryForm>

      {/* Featured videos — same <VideoLinksEditor> (all tiers · gallery_video_links).
          Paste YouTube/Vimeo (inline players) or Instagram/Facebook/TikTok (link-out). */}
      <GalleryForm
        field="gallery_videos"
        toast={toast}
        successToast="Videos saved."
        title="Featured videos"
        hint="YouTube, Vimeo, Instagram, Facebook or TikTok"
      >
        <VideoLinksEditor name="gallery_video_links" initial={galleryVideoLinks} />
      </GalleryForm>

      {/* Instagram — same card + OAuth flow (unchanged routes under
          /api/vendor/instagram/**). Inert ("Coming soon") until the Meta App
          env is set. Synced posts flow into the SAME unified public gallery. */}
      <div className="border-t pt-4" style={{ borderColor: 'var(--m-line)' }}>
        {igUnavailable ? <CouldNotLoad what="your Instagram connection" /> : null}
        <InstagramConnectCard
          configured={igConfigured}
          connection={igConnection}
          media={igMedia}
          flash={igFlash}
        />
      </div>
    </section>
  );
}

/**
 * One relocated media editor wrapped in a save form. Uses `updateVendorProfileField`
 * (single-column patch — never nulls the other fields). Toasts the result and
 * only shows the Save button once the child inputs are dirty (tracked by
 * comparing the serialized FormData snapshot on input).
 */
function GalleryForm({
  field,
  title,
  hint,
  successToast,
  toast,
  children,
}: {
  field: 'portfolio' | 'gallery_videos';
  title: string;
  hint?: string;
  successToast: string;
  toast: ReturnType<typeof useToast>;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(updateVendorProfileField, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);

  // Toast the action result. On success, the field is clean again (the server
  // is now the source of truth for what was just saved).
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(successToast);
      setDirty(false);
    } else {
      toast.error(state.error);
    }
  }, [state, successToast, toast]);

  return (
    <Row title={title} hint={hint}>
      <form
        ref={formRef}
        action={formAction}
        onInput={() => setDirty(true)}
        onChange={() => setDirty(true)}
        className="space-y-3"
      >
        <input type="hidden" name="field" value={field} />
        {children}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!dirty || pending}
            className="rounded-md px-3 py-1 text-xs font-medium transition-opacity disabled:opacity-40"
            style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Row>
  );
}

/* ─── Flat, hairline-divided section ────────────────────────────────────── */
function Row({
  title,
  hint,
  tight,
  children,
}: {
  title: string;
  hint?: string;
  tight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={tight ? '' : 'border-t pt-4'}
      style={tight ? undefined : { borderColor: 'var(--m-line)' }}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          {title}
        </h3>
        {hint ? (
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

