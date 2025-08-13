import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: ['openweathermap.org'], // Allow images from this domain
  },
};

export default nextConfig;
