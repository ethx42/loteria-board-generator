/**
 * Image Upload API Route (DEPRECATED)
 *
 * ⚠️ **DEPRECATED**: This endpoint passes files through the serverless function,
 * which can cause timeouts and memory issues in Netlify.
 *
 * **Use `/api/images/presigned` instead** for direct client-to-R2 uploads.
 *
 * This endpoint is kept for backward compatibility or server-side uploads only.
 *
 * @route POST /api/images/upload
 * @deprecated Use `/api/images/presigned` with client-side upload instead
 * @see docs/IMAGE_STORAGE_STRATEGY.md
 */

import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME, isR2Configured } from "@/lib/storage/r2-client";

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed image MIME types
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/avif",
];

export async function POST(request: NextRequest) {
  // Check if R2 is configured
  if (!isR2Configured() || !r2Client) {
    return NextResponse.json(
      { error: "Image storage not configured" },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const deckId = formData.get("deckId") as string | null;
    const itemId = formData.get("itemId") as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { error: "Missing file" },
        { status: 400 }
      );
    }

    if (!deckId || !itemId) {
      return NextResponse.json(
        { error: "Missing deckId or itemId" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Invalid file type",
          allowedTypes: ALLOWED_TYPES,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File too large",
          maxSize: MAX_FILE_SIZE,
          actualSize: file.size,
        },
        { status: 400 }
      );
    }

    // TODO: Add authentication check here
    // const session = await getSession(request);
    // if (!session) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Determine file extension from MIME type
    const extension = file.type.split("/")[1] || "png";
    const key = `decks/${deckId}/${itemId}.${extension}`;

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
        // Optional: Add metadata
        Metadata: {
          uploadedAt: new Date().toISOString(),
          originalName: file.name,
        },
      })
    );

    // Return public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      key,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload image",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET endpoint to check upload status
export async function GET() {
  return NextResponse.json({
    configured: isR2Configured(),
    maxFileSize: MAX_FILE_SIZE,
    allowedTypes: ALLOWED_TYPES,
  });
}

