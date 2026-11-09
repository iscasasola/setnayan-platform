'use client';

import { lazy, Suspense, useId, useState, type ReactNode } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { useToast } from '@/app/_components/toast/toast-provider';
import { ActionButton } from '@/components/action-button';
import { draftStorageKey, parseStoredDraft } from '@/lib/supplier-page-draft';
import type { PortfolioUploadFacts } from '@/lib/portfolio-upload-facts';

/**
 * 📂 UPLOAD OPENS THE DEVICE'S PICKER, IN PLACE (owner, 9 Nov: *"When on desktop. Upload is upload on files not go to a
 * page. Mobile is the phone's gallery"* — and, on Facebook's cover / profile photo menus, *"Upload photo (opens apple
 * photos or the mobile's gallery or opens files on explorer or finder)"*).
 *
 *   · The door IS a `<label>` around a real `<input type="file" accept="image/*">`: the press opens the browser's own
 *     file dialog on a computer and the photo library on a phone — natively, inside the tap, with no script between
 *     (a phone opens a picker only from a user gesture).
 *   · What was picked goes into THE SHIPPED PORTFOLIO UPLOADER — `PortfolioForm` (`shop/_components/gallery-media.tsx`:
 *     `<FileUpload multiple>` with the watermark, the QR guard and the compression, saved by `updateVendorProfileField`
 *     with `field=portfolio`), fed the files through `FileUpload`'s `pickedFiles`. Never a second uploader: the photo
 *     lands in Portfolio exactly as an upload there would, priced by the same free room and wallet.
 *   · The uploader's code is its OWN chunk (`lazy`), fetched on the first press — never in a page's first load, never
 *     in the shared bundle (Build 3 rulings: about 20 B of headroom).
 * 🔒 `app/vendor-dashboard/no-upload-door-goes-to-a-page.test.ts`.
 */
// ⚖ NO chunk of its own: every chunk id is an entry in the webpack runtime's chunk map, which IS in the shared bundle
// (202.3 KB, no headroom), so the photo doors ride the supplier dashboard's EXISTING on-demand chunk (`picked-pages`,
// the picked client's pages) — zero new runtime entries. Two chunks of their own, then one named `photo-parts`, each
// measured over the budget (Build 3 integration, #7416).
export const loadPortfolioForm = () => import(/* webpackChunkName: "picked-pages" */ '../shop/_components/gallery-media');
const PortfolioForm = lazy(() => loadPortfolioForm().then((m) => ({ default: m.PortfolioForm })));

/** Every photo door's picker: any image — iOS and Android then offer the photo library (and the camera). */
export const PHOTO_PICK_ACCEPT = 'image/*';

/**
 * The cover the door just uploaded becomes Your page's DRAFT cover — the same draft Your page's own "Use as cover"
 * writes (`use-page-draft.ts`, one key per shop). It still goes live with Your page's Apply, exactly as shipped.
 */
export function pickCoverInDraft(vendorProfileId: string, key: string): boolean {
  try {
    const storageKey = draftStorageKey(vendorProfileId);
    const cur = parseStoredDraft(window.localStorage.getItem(storageKey));
    window.localStorage.setItem(storageKey, JSON.stringify({ ...cur, hero: key }));
    return true;
  } catch {
    return false; // storage refused (private window): the photo is still in Portfolio; Choose cover photo picks it
  }
}

/** The picker itself — a label around the file input. The children are the door's look (a pill, a menu row). */
export function PhotoPickLabel({
  onPick,
  multiple = false,
  className,
  children,
  data,
}: {
  onPick: (files: File[]) => void;
  multiple?: boolean;
  className?: string;
  children: ReactNode;
  /** The door's own marker (`data-<data>=""`). */
  data: string;
}) {
  return (
    <label
      className={`cursor-pointer ${className ?? ''}`}
      {...{ [`data-${data}`]: '' }}
      data-photo-pick=""
      // ⚡ The uploader's chunk starts on the press, while the dialog is open — never with the page.
      onPointerDown={() => void loadPortfolioForm().catch(() => {})}
    >
      {children}
      <input
        type="file"
        accept={PHOTO_PICK_ACCEPT}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          if (files.length > 0) onPick(files);
        }}
      />
    </label>
  );
}

/**
 * What a pick opens: the shipped Portfolio uploader with those files already in it (its framer, its Save that names
 * the charge BEFORE the tap). `coverPick` = the Cover menu: once saved, the first new photo is Your page's draft cover.
 */
export function PortfolioUploadBody({
  facts,
  files,
  coverPick = false,
  onSaved,
}: {
  facts: PortfolioUploadFacts;
  files: File[];
  coverPick?: boolean;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState(false);
  return (
    <div className="space-y-3" data-portfolio-upload-body="">
      <p className="text-[13px] text-ink/65">From your files or your phone’s photos · it joins your Portfolio</p>
      <Suspense
        fallback={
          <p className="py-4 text-[13px] text-ink/60" role="status">
            Opening your photos…
          </p>
        }
      >
        <PortfolioForm
          vendorProfileId={facts.vendorProfileId}
          storedRefs={facts.storedRefs}
          displayMap={{}}
          free={facts.free}
          allowanceUnread={facts.allowanceUnread}
          walletBalance={facts.walletBalance}
          toast={toast}
          addOnly
          pickedFiles={files}
          onSaved={(added) => {
            if (coverPick && added[0]) setPicked(pickCoverInDraft(facts.vendorProfileId, added[0]));
            onSaved?.();
          }}
        />
      </Suspense>
      {picked ? (
        <div className="space-y-2" data-portfolio-upload-cover-picked="">
          <p className="text-[13px] text-ink/65">Picked as your cover · it goes live when you Apply on Your page</p>
          <ActionButton tone="brand" main href="/vendor-dashboard/website#cover" icon={ImageIcon} label="Open Your page" className="w-full" />
        </div>
      ) : null}
    </div>
  );
}

/** A hero's Upload pill (Today · Shop): the picker, then the uploader in a sheet over the same screen. */
export function PortfolioUploadDoor({
  facts,
  className,
  children,
  data,
  coverPick = false,
}: {
  facts: PortfolioUploadFacts;
  className?: string;
  children: ReactNode;
  data: string;
  coverPick?: boolean;
}) {
  const headingId = useId();
  const [files, setFiles] = useState<File[] | null>(null);
  const [round, setRound] = useState(0);
  return (
    <>
      <PhotoPickLabel
        multiple
        className={className}
        data={data}
        onPick={(f) => {
          setFiles(f);
          setRound((r) => r + 1);
        }}
      >
        {children}
      </PhotoPickLabel>
      {files ? (
        <Sheet open onClose={() => setFiles(null)} labelledById={headingId} title="Upload photo">
          <h2 id={headingId} className="sr-only">
            Upload photo
          </h2>
          {/* The house sheet draws its body edge to edge; Shop's ParamSheet pads its own — so the 16 px gutters live HERE
              (measured at 390 px: the body touched both edges without them). */}
          <div className="px-4 pb-4">
            <PortfolioUploadBody
              key={round}
              facts={facts}
              files={files}
              coverPick={coverPick}
              // The hero under the sheet wears the new photo with the save's own render: the `portfolio` write
              // revalidates Shop, Your page, Portfolio and Today (`updateVendorProfileField`) — no refresh here.
            />
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
