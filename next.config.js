/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  // Static export only for production (GitHub Pages)
  ...(isProd && {
    output: 'export',
    trailingSlash: true,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
    assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
  }),
  images: {
    unoptimized: true,
  },
  devIndicators: false,
}

module.exports = nextConfig
