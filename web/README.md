This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Contact Form Email Integration

The contact form endpoint (`POST /api/contact`) can deliver leads by SMTP email and/or webhook.
Default destination inbox is `info.senaldigital@gmail.com`.

### Required SMTP variables

Set these in Vercel Project Settings -> Environment Variables:

- `CONTACT_SMTP_PASS` (Google app password / SMTP password)

With defaults, the endpoint uses:
- `CONTACT_SMTP_HOST=smtp.gmail.com`
- `CONTACT_SMTP_PORT=465`
- `CONTACT_SMTP_USER=info.senaldigital@gmail.com`
- `CONTACT_TO_EMAIL=info.senaldigital@gmail.com`

### Optional SMTP variables

- `CONTACT_SMTP_HOST`
- `CONTACT_SMTP_PORT`
- `CONTACT_SMTP_USER`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL` (default: `CONTACT_SMTP_USER`)
- `CONTACT_SMTP_SECURE` (`true`/`false`; if omitted, `465` implies secure)

### Optional webhook fallback

- `CONTACT_WEBHOOK_URL`

Behavior:

- If SMTP is configured, leads are sent to email.
- If webhook is configured, leads are forwarded as JSON.
- If both are configured, both are attempted.
- If neither is configured, API returns `202` and logs a warning.
