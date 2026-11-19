/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'bullmq', 'ioredis', 'puppeteer-core', 'archiver', 'bcryptjs'],
  },
};

export default nextConfig;
