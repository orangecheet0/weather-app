import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to complete even if there are ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['openweathermap.org'], // Allow images from this domain
  },
};

export default nextConfig;
