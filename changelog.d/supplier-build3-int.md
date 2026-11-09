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
  - The chosen photos go to the shipped `PortfolioForm`, in add-only mode, through a new `FileUpload` `pickedFiles` prop. The watermark, QR guard, compression, the room count and the `updateVendorProfileField` `portfolio` save are all unchanged. It adds no server action, and the form is lazy-loaded in its own chunk.
  - A photo uploaded from Shop's cover is pre-picked as the cover in Your page's draft. It still goes live only with Your page's Apply.
  - Guard: `app/vendor-dashboard/no-upload-door-goes-to-a-page.test.ts`, sabotage-checked red.
- **🖼 Shop's Cover and Logo sheets are each one short menu** (owner, 9 Nov, after Facebook's cover/profile photo menus). Each is rows of a round icon and a word, with no paragraph:
  - See cover/profile photo: full-screen, or disabled with an honest line when there is none.
  - Upload photo.
  - Choose cover photo, which opens Your page's cover picker. For the logo, this row is "Adjust profile photo", which opens the shipped crop.
  - One muted line keeps "goes live when you Apply on Your page". The logo keeps the shipped drag/pinch crop after an upload.
- **🌙 The supplier hero band stays espresso in dark mode.** A new `--m-espresso: #2C2A29` that never flips. `--m-ink` turned paper-light in `html.dark`, which made the hero band light and the white Upload pill's word white on white.
- **Regenerated:** the screens map, admin jobs/map, the migrations manifest, the exposure baseline, the FK behaviour file, the port-control baseline and the no-card baseline. The no-card count fell.

SPEC IMPACT: None. The Upload/menu behaviour follows the owner's 9 Nov rulings already recorded for Build 3. No corpus file changes. One gap is flagged for the owner in the PR: there is no shipped "logo from Portfolio" picker, so the Logo menu's third row adjusts the logo rather than choosing one.
