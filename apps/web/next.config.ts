import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes is intentionally OFF until all aspirational nav links
  // (Landing Page, Schedule, Suppliers, Gallery, Settings, More) have real
  // page.tsx files. Re-enable when those work orders ship.
  typedRoutes: false,
  // Tell Next that the monorepo root is two levels up so it stops picking up the
  // unrelated package-lock.json in the user's home directory.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
