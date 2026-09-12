/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for small production images.
  output: 'standalone',
  // Compile shared workspace packages from source (they ship TS, not built JS).
  transpilePackages: ['@vicinity/ui', '@vicinity/shared'],
  eslint: {
    // Lint is run separately in CI; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
