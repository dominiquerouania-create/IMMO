import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Export statique pour l'app desktop (Tauri) : NEXT_OUTPUT=export.
  // Sur Vercel, sortie gérée par la plateforme ; ailleurs (Docker) : standalone.
  output: process.env.NEXT_OUTPUT === 'export' ? 'export' : process.env.VERCEL ? undefined : 'standalone',
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
