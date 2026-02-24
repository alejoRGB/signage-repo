import type { NextConfig } from "next";

function buildContentSecurityPolicy() {
  const isProduction = process.env.NODE_ENV === "production";
  const isVercelPreview = process.env.VERCEL_ENV === "preview";
  const allowVercelLive = !isProduction || isVercelPreview;

  const scriptSrc = [
    "'self'",
    // TODO(security): replace with nonce-based CSP to remove unsafe-inline.
    "'unsafe-inline'",
    "https://www.googletagmanager.com",
    ...(allowVercelLive ? ["https://vercel.live"] : []),
    ...(isProduction ? [] : ["'unsafe-eval'"]),
  ];

  const connectSrc = [
    "'self'",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://stats.g.doubleclick.net",
    ...(allowVercelLive ? ["https://vercel.live", "wss://vercel.live"] : []),
  ];

  const frameSrc = [
    "'self'",
    ...(allowVercelLive ? ["https://vercel.live"] : []),
  ];

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors ${allowVercelLive ? "'self' https://vercel.live" : "'none'"}`,
    `form-action 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    `script-src-attr 'none'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https:`,
    `media-src 'self' blob: data: https:`,
    `connect-src ${connectSrc.join(" ")}`,
    `font-src 'self' data:`,
    `frame-src ${frameSrc.join(" ")}`,
    `worker-src 'self' blob:`,
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    const csp = buildContentSecurityPolicy();

    return [
      {
        // Keep static CSP for public/marketing pages. Protected app surfaces receive nonce-based CSP from `proxy.ts`.
        source: "/((?!admin(?:/|$)|dashboard(?:/|$)).*)",
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
