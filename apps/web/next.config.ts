import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Tell Next that the monorepo root is two levels up so it stops picking up the
  // unrelated package-lock.json in the user's home directory.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
