import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'static.four.meme' },
      { protocol: 'https', hostname: 'i.imgflip.com' },
      { protocol: 'https', hostname: 'supermeme.ai' },
      { protocol: 'https', hostname: 'cdn.supermeme.ai' },
      { protocol: 'https', hostname: '*.modelslab.com' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
}

export default nextConfig
