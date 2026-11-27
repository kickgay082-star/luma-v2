import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@luma/shared'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
