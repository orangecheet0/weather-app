/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Prevent ESLint errors from failing builds (useful during refactors)
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
