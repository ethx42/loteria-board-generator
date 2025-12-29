/**
 * Presigned URL API Route
 *
 * Generates presigned URLs for direct client-to-R2 uploads.
 * This avoids passing files through the Next.js serverless function,
 * preventing timeouts and memory limits in Netlify.
 *
 * @route POST /api/images/presigned
 * @see docs/IMAGE_STORAGE_STRATEGY.md
 */

import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME, isR2Configured } from "@/lib/storage/r2-client";

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
    const body = await request.json();
    const { filename, fileType, deckId, itemId } = body;

    // Validate required fields
    if (!filename || !fileType || !deckId || !itemId) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["filename", "fileType", "deckId", "itemId"],
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json(
        {
          error: "Invalid file type",
          allowedTypes: ALLOWED_TYPES,
        },
        { status: 400 }
      );
    }

    // TODO: Add authentication check here
    // const session = await getSession(request);
    // if (!session) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Determine file extension from MIME type
    const extension = fileType.split("/")[1] || "png";
    const key = `decks/${deckId}/${itemId}.${extension}`;

    // Create PutObject command (but don't execute it)
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      CacheControl: "public, max-age=31536000, immutable",
      // Optional: Add metadata
      Metadata: {
        uploadedAt: new Date().toISOString(),
        originalName: filename,
      },
    });

    // Generate presigned URL (valid for 60 seconds)
    const signedUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 60, // URL expires in 60 seconds
    });

    // Return presigned URL and final public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({
      uploadUrl: signedUrl,
      key,
      finalUrl: publicUrl,
    });
  } catch (error) {
    console.error("Presigned URL generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate upload URL",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Optional: Add GET endpoint to check configuration
export async function GET() {
  return NextResponse.json({
    configured: isR2Configured(),
    allowedTypes: ALLOWED_TYPES,
  });
}

