import { actor } from "./access";
import { ProfileError } from "@/domain/profiles";
import { MAX_PHOTO_BYTES } from "@/domain/photos";
export function photoFailure(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof ProfileError
          ? error.message
          : "Photo request could not be confirmed. Refresh current status before retrying.",
    },
    {
      status: error instanceof ProfileError ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function photoActor(request: Request, write = false) {
  if (
    write &&
    request.headers.get("origin") !==
      new URL(process.env.BETTER_AUTH_URL!).origin
  )
    throw new ProfileError("Untrusted request origin.", 403);
  const current = await actor(request.headers);
  if (!current) throw new ProfileError("Sign in required.", 401);
  return current;
}
export async function photoBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES)
    throw new ProfileError("Choose an image up to 5 MiB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ProfileError("Choose an image.");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_PHOTO_BYTES) {
      await reader.cancel();
      throw new ProfileError("Choose an image up to 5 MiB.", 413);
    }
    parts.push(part.value);
  }
  return Buffer.concat(parts);
}
export function photoResponse(bytes: Buffer) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": 'inline; filename="player-photo.png"',
    },
  });
}
