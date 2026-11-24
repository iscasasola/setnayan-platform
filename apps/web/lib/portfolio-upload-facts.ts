/**
 * 📂 What the ONE portfolio uploader needs, carried to an Upload door outside Portfolio (Today's hero · Shop's hero ·
 * Shop › Cover / Logo menus — owner 9 Nov: "Upload is upload on files not go to a page"): the shop and the list on the
 * page now, because a save replaces the list.
 *
 * 🔓 No free room, allowance or wallet since 2026-11-23 (owner: the 50-photo portfolio cap is dropped — storage is the
 * only limit), so a door no longer reads or carries them.
 */
export type PortfolioUploadFacts = {
  vendorProfileId: string;
  /** `vendor_profiles.portfolio_r2_keys` as stored — the save replaces the list, so these ride along unchanged. */
  storedRefs: string[];
};
