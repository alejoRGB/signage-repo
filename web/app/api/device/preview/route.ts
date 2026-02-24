import { POST as HEARTBEAT_POST } from "@/app/api/device/heartbeat/route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const response = await HEARTBEAT_POST(request);
    response.headers.set("X-Deprecated-Endpoint", "/api/device/preview");
    response.headers.set("X-Use-Instead", "/api/device/heartbeat");
    return response;
}
