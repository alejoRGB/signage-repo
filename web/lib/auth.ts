import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                // 1. Check Admin Table first
                const admin = await prisma.admin.findUnique({
                    where: { email: credentials.username }, // Admin uses email as username
                });

                if (admin) {
                    const isAdminPasswordValid = await bcrypt.compare(
                        credentials.password,
                        admin.password
                    );

                    if (isAdminPasswordValid) {
                        return {
                            id: admin.id,
                            username: admin.email,
                            email: admin.email,
                            name: admin.name || "Admin",
                            role: "ADMIN",
                            isActive: true,
                        };
                    }
                    // If admin found but password wrong, return null (don't fall through to User)
                    return null;
                }

                // 2. Fallback to User Table
                const user = await prisma.user.findUnique({
                    where: { username: credentials.username },
                });

                if (!user) {
                    return null;
                }

                if (!user.isActive) {
                    throw new Error("Account is inactive.");
                }

                const isPasswordValid = await bcrypt.compare(
                    credentials.password,
                    user.password
                );

                if (!isPasswordValid) {
                    return null;
                }

                return {
                    id: user.id,
                    username: user.username || "", // Handle null username
                    email: user.email,
                    name: user.name,
                    role: user.role, // This should be "USER" based on schema default, but schema has Enum.
                    isActive: user.isActive,
                };
            },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async session({ session, token }) {
            // Check for explicit expiry error from JWT callback
            if (token.error === "AdminSessionExpired") {
                // Return an empty/invalid session to force sign-out
                return {} as any;
            }

            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as "USER" | "ADMIN";
                session.user.isActive = token.isActive as boolean;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.isActive = user.isActive;
                token.loginTimestamp = Date.now(); // Record login time
            }

            // Enforce 1-hour session for Admins
            if (token.role === 'ADMIN') {
                const maxAge = 60 * 60 * 1000; // 1 hour in ms
                const now = Date.now();
                const loginTime = (token.loginTimestamp as number) || 0;

                if (now - loginTime > maxAge) {
                    return { ...token, error: "AdminSessionExpired" };
                }
            }

            return token;
        },
    },
};
