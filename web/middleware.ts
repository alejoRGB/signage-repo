
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    // `withAuth` augments your `Request` with the user's token.
    function middleware(req) {
        const token = req.nextauth.token;
        const isAdminPath = req.nextUrl.pathname.startsWith("/admin");
        const isDashboardPath = req.nextUrl.pathname.startsWith("/dashboard");
        const isLoginPage = req.nextUrl.pathname === "/login";
        const isAdminLoginPage = req.nextUrl.pathname === "/admin/login";

        // 1. Unauthenticated Handling
        if (!token) {
            // Allow access to login pages (Prevent Loop)
            if (isLoginPage || isAdminLoginPage) {
                return NextResponse.next();
            }

            if (isAdminPath) {
                return NextResponse.redirect(new URL("/admin/login", req.url));
            }
            if (isDashboardPath) {
                return NextResponse.redirect(new URL("/login", req.url));
            }
            // For other public routes, do nothing (allow access)
            return NextResponse.next();
        }

        // 2. Authenticated But Wrong Role Handling
        if (isAdminPath && token.role !== "ADMIN") {
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        if (isDashboardPath && token.role === "ADMIN") {
            return NextResponse.redirect(new URL("/admin", req.url));
        }

        // 3. Authenticated Users Accessing Login Pages (Redirect to their respective home)
        if (isLoginPage) {
            // If User, send to dashboard.
            if (token.role !== 'ADMIN') {
                return NextResponse.redirect(new URL("/dashboard", req.url));
            }
            // If Admin, ALLOW access to /login so they can switch accounts
            return NextResponse.next();
        }
        if (isAdminLoginPage && token.role === "ADMIN") {
            return NextResponse.redirect(new URL("/admin", req.url));
        }
    },
    {
        callbacks: {
            // Return true here to let the middleware function handle the logic.
            // If false, it redirects to signIn page automatically, which matches generic /login.
            // We want custom redirects, so we always authorized here and handle redirects above.
            authorized: ({ token }) => true,
        },
    }
);

export const config = { matcher: ["/admin/:path*", "/dashboard/:path*"] };
