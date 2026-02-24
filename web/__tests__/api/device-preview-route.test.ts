/**
 * @jest-environment node
 */
import { POST } from "@/app/api/device/preview/route";
import { prisma } from "@/lib/prisma";
import { uploadAndPersistDevicePreview } from "@/lib/device-preview";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    device: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(async () => true),
}));

jest.mock("@/lib/device-preview", () => ({
  uploadAndPersistDevicePreview: jest.fn(),
}));

describe("/api/device/preview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.device.findUnique as jest.Mock).mockResolvedValue({
      id: "device-1",
      user: { isActive: true },
    });
    (uploadAndPersistDevicePreview as jest.Mock).mockResolvedValue({
      ok: true,
      url: "https://blob.example.com/device-previews/device-1/latest.jpg",
    });
  });

  it("uploads preview through dedicated endpoint", async () => {
    const formData = new FormData();
    formData.set("device_token", "token-1");
    formData.set("preview", new File(["abc"], "latest.jpg", { type: "image/jpeg" }));

    const response = await POST(
      new Request("http://localhost/api/device/preview", {
        method: "POST",
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    expect(uploadAndPersistDevicePreview).toHaveBeenCalledWith(
      "device-1",
      expect.any(File)
    );
  });

  it("rejects missing preview file", async () => {
    const formData = new FormData();
    formData.set("device_token", "token-1");

    const response = await POST(
      new Request("http://localhost/api/device/preview", {
        method: "POST",
        body: formData,
      })
    );

    expect(response.status).toBe(400);
    expect(uploadAndPersistDevicePreview).not.toHaveBeenCalled();
  });
});

