import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MAX_MEDIA_UPLOAD_SIZE_BYTES } from "@/lib/media-upload-policy";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getServerSession(authOptions);
        if (!session) {
          throw new Error('Unauthorized');
        }
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'],
          maximumSizeInBytes: MAX_MEDIA_UPLOAD_SIZE_BYTES,
          tokenPayload: JSON.stringify({
            userId: session.user.id,
          }),
        };
      },
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
