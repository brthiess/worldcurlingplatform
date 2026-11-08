import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  processPhoto,
  photoReviewDecision,
  mayPreviewPhoto,
  mayPublishPhoto,
} from "../src/domain/photos";

test("photo processing decodes a real PNG, strips metadata and creates bounded immutable PNG bytes", async () => {
  const input = await sharp({
    create: { width: 1600, height: 800, channels: 3, background: "#006080" },
  })
    .png()
    .toBuffer();
  const result = await processPhoto(input, "image/png");
  assert.equal(result.width, 1200);
  assert.equal(result.height, 600);
  assert.equal((await sharp(result.bytes).metadata()).format, "png");
  assert.match(result.digest, /^[a-f0-9]{64}$/);
});

test("rejects deceptive types, corrupt decoders, tiny, oversized and animated input", async () => {
  const png = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#eeeeee" },
  })
    .png()
    .toBuffer();
  for (const [bytes, type] of [
    [png, "image/jpeg"],
    [png, "image/svg+xml"],
    [Buffer.from("fake image"), "image/png"],
    [png.subarray(0, 40), "image/png"],
    [Buffer.alloc(0), "image/png"],
    [Buffer.alloc(5 * 1024 * 1024 + 1), "image/png"],
  ] as const)
    await assert.rejects(() => processPhoto(bytes, type));
  const tiny = await sharp({
    create: { width: 63, height: 64, channels: 3, background: "#eeeeee" },
  })
    .png()
    .toBuffer();
  await assert.rejects(() => processPhoto(tiny, "image/png"));
});

test("JPEG and WebP are decoded and re-encoded without EXIF", async () => {
  for (const format of ["jpeg", "webp"] as const) {
    const bytes = await sharp({
      create: { width: 100, height: 80, channels: 3, background: "#eeeeee" },
    })
      .withMetadata()
      .toFormat(format)
      .toBuffer();
    const photo = await processPhoto(bytes, "image/" + format),
      meta = await sharp(photo.bytes).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.exif, undefined);
    assert.equal(photo.width, 100);
    assert.equal(photo.height, 80);
  }
});

test("photo reviews bind exact content and current comparison; final decisions replay only for their actor and reason", () => {
  const current = {
    status: "pending",
    digest: "a".repeat(64),
    currentAssetId: "old",
    reviewedBy: null,
    reason: null,
  };
  const input = {
    decision: "approved",
    digest: "a".repeat(64),
    currentAssetId: "old",
    reason: "Verified geometry",
  };
  assert.equal(photoReviewDecision(current, input, "staff"), "apply");
  assert.throws(() =>
    photoReviewDecision(current, { ...input, digest: "b".repeat(64) }, "staff"),
  );
  assert.throws(() =>
    photoReviewDecision(current, { ...input, currentAssetId: null }, "staff"),
  );
  const approved = {
    ...current,
    status: "approved",
    reviewedBy: "staff",
    reason: "Verified geometry",
  };
  assert.equal(photoReviewDecision(approved, input, "staff"), "replay");
  assert.throws(() =>
    photoReviewDecision(approved, { ...input, decision: "rejected" }, "staff"),
  );
  assert.throws(() => photoReviewDecision(approved, input, "other-staff"));
  assert.throws(() =>
    photoReviewDecision(
      approved,
      { ...input, reason: "Different reason" },
      "staff",
    ),
  );
});

test("private previews require ownership or global administration; public projection requires current approved content", () => {
  assert.equal(mayPreviewPhoto("owner", "owner", false), true);
  assert.equal(mayPreviewPhoto("staff", "owner", true), true);
  assert.equal(mayPreviewPhoto("stranger", "owner", false), false);
  assert.equal(mayPublishPhoto("pending", "asset", "asset"), false);
  assert.equal(mayPublishPhoto("rejected", "asset", "asset"), false);
  assert.equal(mayPublishPhoto("approved", "old", "asset"), false);
  assert.equal(mayPublishPhoto("approved", "asset", "asset"), true);
});
