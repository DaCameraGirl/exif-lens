import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === 'true';
const repo = 'nextjs-boilerplate';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // GitHub Pages serves from /<repo>/ subpath, Vercel serves from /
  ...(isGithubPages ? {
    basePath: `/${repo}`,
    assetPrefix: `/${repo}/`,
  } : {}),
};

export default nextConfig;
