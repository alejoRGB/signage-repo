import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;",
              "style-src 'self' 'unsafe-inline';",
              "img-src 'self' blob: data: https:;",
              "media-src 'self' blob: data: https:;",
              "connect-src 'self' https: wss://vercel.live;",
              "font-src 'self' data:;",
              "frame-src 'self' https://vercel.live;"
            ].join(' '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
