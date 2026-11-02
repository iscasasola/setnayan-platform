## 2026-09-21 · fix(invitation): Share and Report get a place at the bottom

Owner: "make a place at the bottom for report and share." The floating
Share | Report pill is now a quiet footer, the last thing on the invitation
page, after the guest's own section. It no longer covers anything, so it needs
no spacer, and it carries room for the bottom menu bar so the bar never sits
on it. Same gates: never on a private page, Share only once the page is
public. Mounted from page.tsx because SiteBody is not the end of a guest's
page. Guard: the footer test in bottom-edge.test.ts.

SPEC IMPACT: None.
