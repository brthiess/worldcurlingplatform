import { createHash } from "node:crypto";
import sharp from "sharp";
import { ProfileError, claimDecision } from "./profiles";
export function mayPreviewPhoto(
  actor: string,
  owner: string,
  globalAdmin: boolean,
) {
  return actor === owner || globalAdmin;
}
export function mayPublishPhoto(
  status: string,
  currentAssetId: string | null,
  assetId: string,
) {
  return status === "approved" && currentAssetId === assetId;
}
export function photoReviewDecision(
  current: {
    status: string;
    digest: string;
    currentAssetId: string | null;
    reviewedBy: string | null;
    reason: string | null;
  },
  input: {
    decision: string;
    digest: string;
    currentAssetId: string | null;
    reason: string;
  },
  actor: string,
) {
  if (current.digest !== input.digest)
    throw new ProfileError(
      "The reviewed image does not match this request.",
      409,
    );
  const decision = claimDecision(current.status, input.decision);
  if (decision === "replay") {
    if (current.reviewedBy !== actor || current.reason !== input.reason)
      throw new ProfileError(
        "This review differs from the recorded decision.",
        409,
      );
  } else if (current.currentAssetId !== input.currentAssetId)
    throw new ProfileError(
      "The public photo changed. Refresh the comparison before reviewing.",
      409,
    );
  return decision;
}
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export function photoDigest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
export async function processPhoto(bytes: Buffer, type: string) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES)
    throw new ProfileError("Choose an image up to 5 MiB.", 413);
  if (!["image/png", "image/jpeg", "image/webp"].includes(type))
    throw new ProfileError("Choose a PNG, JPEG or WebP image.");
  try {
    const image = sharp(bytes, {
      limitInputPixels: 16_000_000,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (
      `image/${meta.format}` !== type ||
      (meta.pages ?? 1) !== 1 ||
      !meta.width ||
      !meta.height ||
      meta.width < 64 ||
      meta.height < 64
    )
      throw new Error("Invalid image");
    const result = await image
      .rotate()
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: result.data,
      digest: photoDigest(result.data),
      width: result.info.width,
      height: result.info.height,
    };
  } catch {
    throw new ProfileError(
      "Image could not be decoded. Use a single image, 64px or larger, up to 16 megapixels.",
    );
  }
}
