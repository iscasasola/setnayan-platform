# Catch-up shots: #7993 after merging origin/main (2d92d6f09), 19 Nov 2026

390 px wide, deviceScaleFactor 2, full page, rendered with `next dev` (E2E_LABS=1, dummy Supabase env), animations frozen.

| Screen | Lab URL | Light | Dark |
|---|---|---|---|
| Couple Home | `/dev/home-lab` | `home-light-390.jpg` | `home-dark-390.jpg` |
| Clients (supplier) | `/dev/clients-lab` | `clients-light-390.jpg` | `clients-dark-390.jpg` |
| Today v2 (supplier) | `/dev/supplier-lab?easy=normal&sup=caterer&v2=1` | `today-light-390.jpg` | `today-dark-390.jpg` |

- **Light, main vs this branch: 0 app pixels differ** on all three screens (same page heights). On Home, 218 pixels differ, all inside the Next dev overlay's issue counter ("4 Issues" vs "3 Issues"), which is not app UI.
- **Dark was forced in the capture** (`html.dark` added after load), because labs are not on `DARK_READY`. In this PR only the couple's event Home, Budget, Guests and Schedule open in dark. **Clients and Today stay Light in the product**: their dark shots show how the tokens read, not what a supplier sees. Supplier dark is #7997 (parked).
- The red "N · Issues" pill at the bottom left is the Next dev overlay, not the app.
