/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'media.rawg.io' },
      { hostname: 'images.igdb.com' },
    ],
  },
}
module.exports = nextConfig
