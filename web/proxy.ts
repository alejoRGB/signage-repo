
import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionExpiredToken } from "@/lib/admin-session";

function generateCspNonce() {
    return crypto.randomUUID().replace(/-/g, "");
}

function buildProtectedRouteCsp(nonce: string) {
    const isProduction = process.env.NODE_ENV === "production";
    const directives = [
        `default-src 'self'`,
        `base-uri 'self'`,
        `object-src 'none'`,
        `frame-ancestors 'none'`,
        `form-action 'self'`,
        `script-src 'self' 'nonce-${nonce}'${isProduction ? "" : " 'unsafe-eval'"}`,
        `script-src-attr 'none'`,
        // Next App Router still injects inline styles in multiple flows.
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' blob: data: https:`,
        `media-src 'self' blob: data: https:`,
        `connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://stats.g.doubleclick.net`,
        `font-src 'self' data:`,
        `frame-src 'self'`,
        `worker-src 'self' blob:`,
        ...(isProduction ? ["upgrade-insecure-requests"] : []),
    ];

    return directives.join("; ");
}

function nextWithProtectedCsp(req: NextRequest, nonce: string) {
    const csp = buildProtectedRouteCsp(nonce);
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-csp-nonce", nonce);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
    response.headers.set("Content-Security-Policy", csp);
    return response;
}

function redirectWithProtectedCsp(url: URL, nonce: string) {
    const response = NextResponse.redirect(url);
    response.headers.set("Content-Security-Policy", buildProtectedRouteCsp(nonce));
    return response;
}

export default withAuth(
    // `withAuth` augments your `Request` with the user's token.
    function middleware(req) {
        const nonce = generateCspNonce();
        const token = req.nextauth.token;
        const isAdminPath = req.nextUrl.pathname.startsWith("/admin");
        const isDashboardPath = req.nextUrl.pathname.startsWith("/dashboard");
        const isLoginPage = req.nextUrl.pathname === "/login";
        const isAdminLoginPage = req.nextUrl.pathname === "/admin/login";
        const isExpiredAdminSession = isAdminSessionExpiredToken(token);

        // 1. Unauthenticated Handling
        if (!token || isExpiredAdminSession) {
            // Allow access to login pages (Prevent Loop)
            if (isLoginPage || isAdminLoginPage) {
                return nextWithProtectedCsp(req, nonce);
            }

            if (isAdminPath || (isDashboardPath && token?.role === "ADMIN")) {
                return redirectWithProtectedCsp(new URL("/admin/login", req.url), nonce);
            }
            if (isDashboardPath) {
                return redirectWithProtectedCsp(new URL("/login", req.url), nonce);
            }
            // For other public routes, do nothing (allow access)
            return nextWithProtectedCsp(req, nonce);
        }

        // 2. Authenticated But Wrong Role Handling
        if (isAdminPath && token.role !== "ADMIN") {
            return redirectWithProtectedCsp(new URL("/dashboard", req.url), nonce);
        }

        if (isDashboardPath && token.role === "ADMIN") {
            return redirectWithProtectedCsp(new URL("/admin", req.url), nonce);
        }

        // 3. Authenticated Users Accessing Login Pages (Redirect to their respective home)
        if (isLoginPage) {
            // If User, send to dashboard.
            if (token.role !== "ADMIN") {
                return redirectWithProtectedCsp(new URL("/dashboard", req.url), nonce);
            }
            // If Admin, ALLOW access to /login so they can switch accounts
            return nextWithProtectedCsp(req, nonce);
        }
        if (isAdminLoginPage && token.role === "ADMIN") {
            return redirectWithProtectedCsp(new URL("/admin", req.url), nonce);
        }

        return nextWithProtectedCsp(req, nonce);
    },
    {
        callbacks: {
            // Return true here to let the middleware function handle the logic.
            // If false, it redirects to signIn page automatically, which matches generic /login.
            // We want custom redirects, so we always authorized here and handle redirects above.
            authorized: () => true,
        },
    }
);

export const config = { matcher: ["/login", "/admin/:path*", "/dashboard/:path*"] };
