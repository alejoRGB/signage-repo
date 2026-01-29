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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline';",
              "style-src 'self' 'unsafe-inline';",
              "img-src 'self' blob: data: https:;",
              "media-src 'self' blob: data: https:;",
              "connect-src 'self' https:;",
              "font-src 'self' data:;",
              "frame-src 'self';"
            ].join(' '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
