import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === 'true';
const repo = 'exif-lens';

const basePath = isGithubPages ? `/${repo}` : '';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // GitHub Pages serves from /<repo>/ subpath, Vercel serves from /
  ...(isGithubPages ? {
    basePath,
    assetPrefix: `${basePath}/`,
  } : {}),
};

export default nextConfig;
