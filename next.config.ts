import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM database drivers must not be bundled by the server compiler.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // Keep Turbopack anchored to this app when a parent folder also has a lockfile.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
