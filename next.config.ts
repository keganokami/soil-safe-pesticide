import type { NextConfig } from "next";

// GitHub Pages（https://<user>.github.io/<repo>/）向けの静的書き出し
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
