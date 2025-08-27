/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true // important if using static export
  }
};

module.exports = nextConfig;
