import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import { photoDigest } from "@/domain/photos";
import { ProfileError } from "@/domain/profiles";
function root() {
  const value = process.env.MEDIA_STORAGE_ROOT;
  if (!value || !path.isAbsolute(value))
    throw new Error(
      "Configure an absolute durable MEDIA_STORAGE_ROOT outside public/ and the checkout.",
    );
  const result = path.resolve(value);
  if (
    result === process.cwd() ||
    result.startsWith(process.cwd() + path.sep) ||
    result.split(path.sep).includes("public")
  )
    throw new Error("Media storage must be outside the checkout and public/.");
  return result;
}
function location(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id))
    throw new ProfileError("Photo not found.", 404);
  return path.join(root(), id + ".png");
}
export async function storePhoto(id: string, bytes: Buffer) {
  await mkdir(root(), { recursive: true, mode: 0o700 });
  const handle = await open(location(id), "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function storedPhoto(id: string, digest: string) {
  try {
    const bytes = await readFile(location(id));
    if (photoDigest(bytes) !== digest) throw new Error("Integrity");
    return bytes;
  } catch {
    throw new ProfileError(
      "Photo unavailable: integrity verification failed. Refresh before reviewing.",
      503,
    );
  }
}
