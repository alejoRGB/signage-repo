import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function isDebugEndpointEnabled() {
    return process.env.ENABLE_DEBUG_API_ROUTES?.trim().toLowerCase() === "true";
}

export async function requireDebugEndpointAccess() {
    if (!isDebugEndpointEnabled()) {
        // Hide endpoint existence unless explicitly enabled.
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.user.isActive === false) {
        return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }

    return null;
}
