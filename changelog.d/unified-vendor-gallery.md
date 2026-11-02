## 2026-07-05 · feat(vendors): unified premium portfolio gallery (photos + videos)

Merged the two separate public-profile media sections — the photo portfolio
(`vendor_profiles.portfolio_r2_keys`) and the just-shipped "Featured videos"
section (`vendor_profiles.gallery_video_links`) — into ONE "Portfolio" gallery on
the public vendor page (`apps/web/app/v/[slug]/page.tsx`). Photos render first as
4:3 tiles, then videos in the same responsive grid: YouTube/Vimeo mount as inline
16:9 players (spanning two columns as the section's one signature moment),
IG/FB/TikTok/other render as play-badge click-through cards. Governed by the
vendor's existing Portfolio visibility toggle; auto-hidden when empty. The vendor
editor (`apps/web/app/vendor-dashboard/profile/page.tsx`) now groups the photo
uploader + video-link repeater under one boxed "Portfolio" heading so the vendor
sees a single gallery. Reuses `lib/video-embed.ts` `parseVideoLink` and the
existing `video-links-editor.tsx` repeater. No schema change — both underlying
storage arrays persist unchanged. Verification-page portfolio slot and the
Enterprise "Films" rack are untouched.

SPEC IMPACT: None
