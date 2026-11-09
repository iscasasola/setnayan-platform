'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Crop, Eye, Images, Upload, type LucideIcon } from 'lucide-react';
import { PhotoViewer } from '@/app/_components/gallery/photo-viewer';
import type { BusinessProfileItem } from '@/lib/vendor-profile';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';
import { PhotoPickLabel, PortfolioUploadBody } from '../../_components/portfolio-upload';
import { ProfileChecklistEditor } from './profile-checklist-editor';
import type { ProfileFieldData } from './editable-row';

/**
 * 📷 SHOP › COVER PHOTO AND LOGO — ONE SHORT ACTION MENU EACH (owner, 9 Nov, on Facebook's cover / profile photo:
 * *"We want to apply the same. It just opens the same menu. See cover photo/profile photo. Upload photo (opens apple
 * photos or the mobile's gallery or opens files on explorer or finder)"*).
 *
 *   See … photo   → the current picture full-screen in the shared viewer (`PhotoViewer`), ✕ to close. Quiet, with
 *                   the honest reason, while there is none yet.
 *   Upload photo  → the device's picker IN PLACE (`PhotoPickLabel`), then the shipped uploader: the cover's is
 *                   Portfolio's own (`PortfolioUploadBody`, the new photo pre-picked as Your page's draft cover); the
 *                   logo's is the shipped logo row with its framer (drag to move, pinch to zoom).
 *   Choose cover photo → Your page's shipped "Pick from Portfolio" (`#cover`), unchanged.
 *   Adjust profile photo → the shipped logo row as the sheet drew it before (Replace photo · the framer). There is no
 *                   shipped "pick a logo from Portfolio", so the logo menu does not pretend to one.
 *
 * Rows are the shipped bottom sheet's (the chat (+) sheet: a 40 px round icon and the word, a 56 px press) — no
 * paragraph. One muted line under the cover's says when a cover goes live (Your page's Apply, as shipped).
 * 🔒 `app/vendor-dashboard/no-upload-door-goes-to-a-page.test.ts`.
 */
// 📦 The viewer is a STATIC import on purpose (Shop only, ~4 KB gz). Loaded on demand it was a chunk shared with
// Library and Memories, and an on-demand load turns every chunk it names into an entry of the webpack runtime that ships
// on EVERY page — measured over the 202.3 KB shared-bundle lock (Build 3 integration, #7416). Same call as `portfolio-upload.tsx`.

const ROW = 'flex min-h-[56px] w-full items-center gap-3.5 py-2 text-left';

function RowLead({ icon: Icon, quiet = false }: { icon: LucideIcon; quiet?: boolean }) {
  return (
    <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${quiet ? 'bg-ink/[0.04] text-ink/30' : 'bg-ink/[0.05] text-sn-accent'}`}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </span>
  );
}

function RowWord({ children, quiet = false, line = null }: { children: ReactNode; quiet?: boolean; line?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className={`block truncate text-[15px] font-semibold leading-tight ${quiet ? 'text-ink/40' : 'text-ink'}`}>{children}</span>
      {line ? <span className="mt-0.5 block text-[13px] text-ink/60">{line}</span> : null}
    </span>
  );
}

/** "See … photo": the viewer, or — with nothing to see — a quiet row that says why. */
function SeeRow({ word, url, none, album, data }: { word: string; url: string | null; none: string; album: string; data: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li data-photo-menu-row={data}>
      {url ? (
        <button type="button" className={`sn-press ${ROW}`} onClick={() => setOpen(true)}>
          <RowLead icon={Eye} />
          <RowWord>{word}</RowWord>
        </button>
      ) : (
        <span role="button" aria-disabled="true" tabIndex={0} className={ROW}>
          <RowLead icon={Eye} quiet />
          <RowWord quiet line={none}>
            {word}
          </RowWord>
        </span>
      )}
      {open && url ? (
        <PhotoViewer photo={{ src: url, kind: 'photo', label: album }} at={0} total={1} album={album} onMove={() => {}} onClose={() => setOpen(false)} actions={[]} />
      ) : null}
    </li>
  );
}

function UploadRow({ onPick, data }: { onPick: (files: File[]) => void; data: string }) {
  return (
    <li data-photo-menu-row={data}>
      <PhotoPickLabel onPick={onPick} className={`sn-press ${ROW}`} data={`${data}-pick`}>
        <RowLead icon={Upload} />
        <RowWord>Upload photo</RowWord>
      </PhotoPickLabel>
    </li>
  );
}

export function CoverPhotoMenu({ coverUrl, facts, chooseHref }: { coverUrl: string | null; facts: PortfolioUploadFacts; chooseHref: string }) {
  const [files, setFiles] = useState<File[] | null>(null);
  if (files) return <PortfolioUploadBody facts={facts} files={files} coverPick />;
  return (
    <div data-photo-menu="cover">
      <ul>
        <SeeRow word="See cover photo" url={coverUrl} none="No cover yet — your first Portfolio photo becomes it" album="Cover photo" data="cover-see" />
        <UploadRow onPick={setFiles} data="cover-upload" />
        <li data-photo-menu-row="cover-choose">
          <Link href={chooseHref} className={`sn-press ${ROW}`}>
            <RowLead icon={Images} />
            <RowWord>Choose cover photo</RowWord>
          </Link>
        </li>
      </ul>
      <p className="pt-2 text-[12.5px] text-ink/55">Your cover goes live when you Apply on Your page.</p>
    </div>
  );
}

export function LogoPhotoMenu({
  logoUrl,
  logoItem,
  logoFields,
  isVerified,
}: {
  logoUrl: string | null;
  logoItem: BusinessProfileItem | null;
  logoFields: ProfileFieldData;
  isVerified: boolean;
}) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [editing, setEditing] = useState(false);
  if ((files || editing) && logoItem) {
    return (
      <div className="space-y-3" data-photo-menu="logo-frame">
        <p className="text-[13px] text-ink/65">Your logo · shows on your page, cards and chat. Drag to move, pinch to zoom.</p>
        <ProfileChecklistEditor items={[logoItem]} data={logoFields} isVerified={isVerified} showProgress={false} flat pickedLogo={files} />
      </div>
    );
  }
  return (
    <div data-photo-menu="logo">
      <ul>
        <SeeRow word="See profile photo" url={logoUrl} none="No logo yet" album="Your logo" data="logo-see" />
        {logoItem ? <UploadRow onPick={setFiles} data="logo-upload" /> : null}
        {logoItem ? (
          <li data-photo-menu-row="logo-adjust">
            <button type="button" className={`sn-press ${ROW}`} onClick={() => setEditing(true)}>
              <RowLead icon={Crop} />
              <RowWord>Adjust profile photo</RowWord>
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
