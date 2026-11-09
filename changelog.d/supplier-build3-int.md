## 2026-11-09 · feat(supplier): Build 3 integrated — lanes A–E in one branch, Upload opens the device picker, Shop's Cover and Logo are one photo menu (Supplier Build 3 · integration)

This branch merges lanes A → B → C → D → E and origin/main twice. It supersedes #7408, #7410, #7414, #7411 and #7412. Each lane's own fragment (`supplier-build3-a…e`) carries its feature notes. This fragment covers only what the integration added.

- **Lanes A × B in one chat.**
  - The picked 📎 panel lists Files only. Lane B retired the Decisions view.
  - B's head-tools row sits under A's host strip.
  - The pinned stack owns the single 4/9 cap. The pins' own second cap is gone (`the-pinned-stack-keeps-five-ninths.test.ts`).
- **🔒 A private line has one proven writer.**
  - Lane B's tripwire forbade any code that names `chat_messages.recipient_user_id`, and lane A's private composer is that code. The tripwire now proves lane A's path instead of forbidding it, in `lib/a-private-message-never-reaches-a-third-person.test.ts`:
    - the line is words only;
    - the AI is never woken;
    - `notifyOtherParty` tells the recipient only, then returns before the fan-out.
  - The scanner now also counts the `CHAT_PRIVATE_RECIPIENT_COLUMN` constant.
  - Both proofs were sabotage-checked red.
- **🔒 The admin's demo-shop thread read is filtered.** `/admin/demo-vendors/inquiries/[threadId]` reads through the service role, so the restrictive policy cannot bind it. It now keeps the shop's own view: shared lines, plus private lines the shop sent or received. A host ↔ host private line is never shown. The guard checks that this is the only service-role caller of `fetchMessages`.
- **📂 Upload opens the device's picker, never a page.** Owner, 9 Nov: *"Upload is upload on files not go to a page. Mobile is the phone's gallery"*.
  - Today's hero, Shop's cover and the dev lab no longer link to `collections#gallery-media`. Pressing Upload opens a native `<input type="file" accept="image/*">`: the file dialog on desktop, the photo library on a phone.
  - The chosen photos go to the shipped `PortfolioForm`, in add-only mode, through a new `FileUpload` `pickedFiles` prop. The watermark, QR guard, compression, the room count and the `updateVendorProfileField` `portfolio` save are all unchanged. It adds no server action. `PortfolioForm` moved, unchanged, into its own file (`shop/_components/portfolio-form.tsx`); Portfolio's page still draws it, and the doors import it statically (see the bundle entry below).
  - A photo uploaded from Shop's cover is pre-picked as the cover in Your page's draft. It still goes live only with Your page's Apply.
  - Guard: `app/vendor-dashboard/no-upload-door-goes-to-a-page.test.ts`, sabotage-checked red.
- **🖼 Shop's Cover and Logo sheets are each one short menu** (owner, 9 Nov, after Facebook's cover/profile photo menus). Each is rows of a round icon and a word, with no paragraph:
  - See cover/profile photo: full-screen, or disabled with an honest line when there is none.
  - Upload photo.
  - Choose cover photo, which opens Your page's cover picker. For the logo, this row is "Adjust profile photo", which opens the shipped crop.
  - One muted line keeps "goes live when you Apply on Your page". The logo keeps the shipped drag/pinch crop after an upload.
- **🌙 The supplier hero band stays espresso in dark mode.** A new `--m-espresso: #2C2A29` that never flips. `--m-ink` turned paper-light in `html.dark`, which made the hero band light and the white Upload pill's word white on white.
- **📦 The shared bundle stays inside 202.3 KB without raising it.** CI on `fb5c509abf` failed the bundle check: the webpack runtime went from 5.1 KB to 5.2 KB. The runtime ships on every page and holds one entry for every chunk that an on-demand load can name. Measured locally with CI's dummy env, in gzip bytes against the 207,155 B budget:
  - `origin/main`: runtime 5,254, total 207,120.
  - This branch before the fix: runtime 5,350, total 207,216, which is 61 B over.
  - After the fix: runtime 5,284, total 207,150, which is 5 B under.
  - **What did it.** The photo doors loaded `PortfolioForm` and `PhotoViewer` on demand. Every chunk that load named became a runtime entry: `next/image`, a date helper and the Library viewer's chunk. That was true whether the load came from `gallery-media.tsx`, from a `photo-parts` chunk or from `picked-pages`, and all three were measured.
  - **The fix:**
    - `PortfolioForm` moved, unchanged, to `portfolio-form.tsx`, so a door no longer carries the Instagram card or the video editor.
    - The doors import it statically. That adds about 6 KB gzipped to the first load of Today and Shop.
    - Shop's photo menus import `PhotoViewer` statically. That adds about 4 KB gzipped to Shop.
  - **Guard:** `no-upload-door-goes-to-a-page.test.ts` fails on any `import(` in the two door files, or any door import of `gallery-media`. Sabotage-checked.
  - **Re-pointed guards:** five guards that read `PortfolioForm` in `gallery-media.tsx` now read it in `portfolio-form.tsx`. Each asserts the same thing as before. Their own "re-point this guard" notes asked for exactly this.
- **🧪 A lab that 404s adds nothing to production.** `/dev/chat-cards-lab`, `/dev/chat-cards-c-lab` and `/dev/date-sheet-lab` import their parts only inside the branch that a production build folds away (`NODE_ENV` is a build-time constant). Their bodies moved to `lab.tsx`. Before, the c-lab imported lane C's cards statically while production loads them lazily, and that gave it split chunks of its own.
- **Upload sheet gutters:** the sheet's body is padded 16 px on both sides. It measured 0 px at 390 px.
- **Empty modes (the go-live gate's "empty modes included", 9 Nov).** 74 lab shots, light and dark at 390 px, of a new shop, an empty client, a refused read and an empty chat:
  - **Analytics says one thing when it has nothing.** A refused read showed "Couldn't load" beside grey bars and a "—", and a new shop showed bars and "3 of 3 placed". `CardFace` now takes `quiet`: the title and the one honest line in the picture's place, with no chart. All five faces pass it (refused, nothing booked, no quotes sent, no band, nothing placed). Price's dashed placeholder rail is gone. The dev lab's `&none=1` now hands the cards a new shop's reads instead of a busy shop's numbers. Guard: `performance/an-analytics-face-with-nothing-draws-one-line.test.ts`.
  - **Portfolio's counts agree with its albums.** The lab's counts and albums now come from one source, as `collections-data.ts` does, so a new shop no longer reads "0 photos" and "about 216 photos" on one screen.
  - **Dark mode uses the tokens.** The analytics face read `var(--m-card,#fff)`, a token defined nowhere; it is `--m-paper` now. The picked page's body (the chat area) and Get verified's two boxes were `bg-white`; they are `--m-paper` (still white in light). `Fold`'s pinned head copied its ground once, so a head pinned in light stayed white after the theme flipped (Today's open setup step); it now reads its ground again on a theme change.
  - **Analytics gutters:** measured 26 px left and right of the centred card at 320 and 390 px. The cut-off card in the first shots was Chromium's full-page capture catching the snap track mid-re-snap; the shots now use a tall viewport instead.
  - **"Needs you today" draws no "0 · 12 MN – 12 MN".** The window shows only beside a real count; the empty row under it already says "Nothing waiting on you".
  - **The Logo menu offers no "See" or "Adjust profile photo" without a logo.** Upload only, until one exists.
- **Two reads follow the live taxonomy** (owner: "make sure the services are not hard coded … should live based on the taxonomy"):
  - `lib/supplier-hero.server.ts`: the placeholder's service→category lookup reads `getTaxonomy().map`, the same live snapshot its photos come from, not the `TAXONOMY_MAP` constant.
  - `lib/chat-cards.ts`: the Log-a-payment coordinator Agree asks `isCoordinatorTrade` (`lib/coordinator-trade.ts`, TS = SQL = taxonomy) instead of a `'planner_coordinator'` literal. Of that list, only `planner_coordinator` is a `vendor_category` enum value, so every existing booking answers as before.
  - Guard: `lib/build3-reads-the-live-taxonomy.test.ts`.
- **Regenerated:** the screens map, admin jobs/map, the migrations manifest, the exposure baseline, the FK behaviour file, the port-control baseline and the no-card baseline. The no-card count fell.

SPEC IMPACT: None. The Upload/menu behaviour follows the owner's 9 Nov rulings already recorded for Build 3. No corpus file changes. One gap is flagged for the owner in the PR: there is no shipped "logo from Portfolio" picker, so the Logo menu's third row adjusts the logo rather than choosing one.
