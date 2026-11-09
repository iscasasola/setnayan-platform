/**
 * 📂 What the ONE portfolio uploader needs to draw its free room and price a save, carried to an Upload door outside
 * Portfolio (Today's hero · Shop's hero · Shop › Cover / Logo menus — owner 9 Nov: "Upload is upload on files not go
 * to a page"). Read on the server beside the page's other reads (`portfolio-upload-facts.server.ts`) — the same three
 * reads Portfolio's own page makes (`collections-data.ts`): the stored list, the shop's allowance, the shop wallet.
 */
export type PortfolioUploadFacts = {
  vendorProfileId: string;
  /** `vendor_profiles.portfolio_r2_keys` as stored — the save replaces the list, so these ride along unchanged. */
  storedRefs: string[];
  /** The free room (`portfolioPhotoCap`: the plan's base, lifted by the shop's own allowance). */
  free: number;
  /** The allowance could not be read: the uploader says so, never "50 free" in its place. */
  allowanceUnread: boolean;
  /** The shop wallet. `null` = unread — never 0. */
  walletBalance: number | null;
};
